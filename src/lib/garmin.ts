// Connects Cadent to Garmin from Settings. Server-only. The password goes from the form to the sync
// script's stdin once and is never stored: only the token Garmin hands back is saved (DECISIONS.md).

import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

import { headers } from "next/headers";

import { SCRIPT, TIMEOUT_MS } from "./sync";

export type ConnectState = { step?: "mfa"; connected?: boolean; error?: string };

export type Login = { email: string; password: string } | { code: string };

/** How long a login waits for its MFA code before it's dropped. */
const MFA_MS = 5 * 60_000;

const RESULTS: Record<string, ConnectState> = {
  connected: { connected: true },
  "bad-login": { error: "Garmin didn't accept that email, password or code." },
  "too-many": { error: "Garmin has paused logins after too many tries. Wait a few minutes, then try again." },
};

type Pending = { child: ChildProcessWithoutNullStreams; lines: AsyncIterator<string>; timer?: NodeJS.Timeout };

/** A login Garmin is holding open for its MFA code. One user, so one at a time. */
let waiting: Pending | undefined;
let busy = false;

/** Where the sync script keeps Garmin's token (its tokens_dir). */
export function tokensDir(): string {
  // `||`, not `??`: .env leaves GARMINTOKENS empty to mean the default.
  const dir = process.env.GARMINTOKENS || "~/.garminconnect";
  return dir.replace(/^~(?=\/|$)/, os.homedir());
}

/**
 * The connected Garmin account, or undefined when there's none. The script owns account.json
 * (ACCOUNT_FILE in cadent_sync.py): written after connecting or a sync that signs in, deleted when Garmin
 * rejects the token, so the app never needs the library's token file name.
 */
export function garminAccount(dir = tokensDir()): { name?: string } | undefined {
  try {
    return JSON.parse(readFileSync(/*turbopackIgnore: true*/ path.join(dir, "account.json"), "utf8"));
  } catch {
    return undefined;
  }
}

/** Deletes the saved token, so Cadent can't reach Garmin until it's connected again. Returns an error message on failure. */
export async function disconnectGarmin(): Promise<string | undefined> {
  const denied = await ownerError();
  if (denied) return denied;
  try {
    await promisify(execFile)("uv", [...SCRIPT, "--disconnect"], { timeout: TIMEOUT_MS });
  } catch (error) {
    console.error("Garmin disconnect failed", error);
    return "Couldn't disconnect Garmin. Try again in a moment.";
  }
}

/**
 * Why this request may not change the Garmin connection, or undefined when it may.
 * `tailscale serve` sets Tailscale-User-Login and drops any copy the client sent, so with the port
 * bound to localhost (docker-compose.yml) the header can't be forged.
 */
export async function ownerError(): Promise<string | undefined> {
  const owner = process.env.CADENT_OWNER;
  if (!owner) {
    return process.env.NODE_ENV === "production"
      ? "Set CADENT_OWNER in .env to your Tailscale login to connect Garmin."
      : undefined;
  }
  const login = (await headers()).get("tailscale-user-login");
  return login?.toLowerCase() === owner.toLowerCase() ? undefined : "Only Cadent's owner can change the Garmin connection.";
}

/** Starts a login with email and password, or finishes one with its MFA code. Never logs what was typed. */
export async function connectGarmin(login: Login): Promise<ConnectState> {
  const denied = await ownerError();
  if (denied) return { error: denied };
  if (busy) return { error: "Still connecting to Garmin." };
  busy = true;
  try {
    let pending: Pending | undefined;
    if ("code" in login) {
      pending = takeWaiting();
      if (!pending) return { error: "That code timed out. Enter your email and password again." };
      pending.child.stdin.end(`${login.code}\n`);
    } else {
      pending = startLogin(login);
    }

    const reply = await nextLine(pending);
    if (reply === "mfa") {
      pending.timer = setTimeout(() => takeWaiting()?.child.kill(), MFA_MS);
      waiting = pending;
      return { step: "mfa" };
    }
    pending.child.kill();
    return RESULTS[reply ?? ""] ?? { error: "Couldn't reach Garmin. Try again in a moment." };
  } finally {
    busy = false;
  }
}

function startLogin(login: { email: string; password: string }): Pending {
  takeWaiting()?.child.kill();
  // stdin, not argv or env: other processes on the machine can read those.
  const child = spawn("uv", [...SCRIPT, "--connect"], { stdio: "pipe" });
  child.on("error", (error) => console.error("Garmin connect failed to start", error));
  // Drained but never logged: a traceback could include what was typed.
  child.stderr.resume();
  // A script that already exited closes the pipe; that's reported as no reply, not a crash.
  child.stdin.on("error", () => {});
  // Only these two fields, whatever else the caller's object holds.
  child.stdin.write(`${JSON.stringify({ email: login.email, password: login.password })}\n`);
  return { child, lines: createInterface({ input: child.stdout })[Symbol.asyncIterator]() };
}

function takeWaiting(): Pending | undefined {
  const pending = waiting;
  waiting = undefined;
  clearTimeout(pending?.timer);
  return pending;
}

/** The script's next line, or undefined once it exits or takes as long as a sync may. */
async function nextLine({ child, lines }: Pending): Promise<string | undefined> {
  const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
  try {
    const { value, done } = await lines.next();
    return done ? undefined : value;
  } finally {
    clearTimeout(timer);
  }
}
