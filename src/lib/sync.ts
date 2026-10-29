// Runs the Garmin sync on demand: the same script host cron runs (docs/home-server.md), from the
// app's working directory. Server-only. In the container that is /app, next to sync/.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Garmin's API is slow; past this something is wrong (e.g. Garmin asking for an MFA code). */
const TIMEOUT_MS = 120_000;

// Cron keeps the full history; a tap only needs yesterday and today (about 7 Garmin requests, not 25).
const ARGS = [
  "run",
  "--no-dev",
  "--project",
  "sync",
  "python",
  "sync/cadent_sync.py",
  "--days",
  "1",
  "--wellness-days",
  "1",
];

let running: Promise<string | undefined> | undefined;

/**
 * Pulls the latest from Garmin; resolves to an error message, or undefined on success.
 * Joins a sync already running so taps never stack up Garmin requests.
 */
export function syncGarmin(): Promise<string | undefined> {
  running ??= runSync().finally(() => {
    running = undefined;
  });
  return running;
}

async function runSync(): Promise<string | undefined> {
  try {
    const sync = run("uv", ARGS, { timeout: TIMEOUT_MS });
    // No one can type an MFA code here: close stdin so a login prompt fails fast instead of waiting.
    sync.child.stdin?.end();
    await sync;
    return undefined;
  } catch (error) {
    console.error("Garmin sync failed", error);
    return "Couldn't sync with Garmin. Try again later, or run the sync by hand.";
  }
}
