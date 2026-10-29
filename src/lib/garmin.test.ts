import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

// Stands in for `cadent_sync.py --connect`: same line protocol, no Garmin.
const FAKE_SCRIPT = `
import json, sys
login = json.loads(sys.stdin.readline())
if login["password"] != "right":
    print("bad-login")
    sys.exit(1)
print("mfa", flush=True)
print("connected" if sys.stdin.readline().strip() == "123456" else "bad-login")
`;
vi.mock("node:child_process", async (actual) => {
  const real = await actual<typeof import("node:child_process")>();
  return { ...real, spawn: () => real.spawn("python3", ["-c", FAKE_SCRIPT], { stdio: "pipe" }) };
});

// disconnectGarmin isn't called here: it runs the real script on the real token folder.
const { connectGarmin, garminAccount, ownerError } = await import("./garmin");

const dir = mkdtempSync(path.join(tmpdir(), "cadent-garmin-"));
afterAll(() => rmSync(dir, { recursive: true }));

describe("garminAccount", () => {
  it("is undefined until Settings has connected an account, then names it", () => {
    writeFileSync(path.join(dir, "garmin_tokens.json"), "{}"); // a token saved by hand isn't enough
    expect(garminAccount(dir)).toBeUndefined();
    writeFileSync(path.join(dir, "account.json"), JSON.stringify({ name: "Joey Rudd" }));
    expect(garminAccount(dir)).toEqual({ name: "Joey Rudd" });
  });
});

describe("connectGarmin", () => {
  // Outside production with no owner set, so no Tailscale header is needed.
  beforeEach(() => vi.stubEnv("CADENT_OWNER", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("asks for the MFA code, then connects", async () => {
    expect(await connectGarmin({ email: "joey@example.com", password: "right" })).toEqual({ step: "mfa" });
    expect(await connectGarmin({ code: "123456" })).toEqual({ connected: true });
  });

  it("reports a wrong password or code", async () => {
    expect((await connectGarmin({ email: "joey@example.com", password: "wrong" })).error).toMatch(/didn't accept/);
    await connectGarmin({ email: "joey@example.com", password: "right" });
    expect((await connectGarmin({ code: "000000" })).error).toMatch(/didn't accept/);
  });

  it("needs a login waiting before it takes a code", async () => {
    expect((await connectGarmin({ code: "123456" })).error).toMatch(/timed out/);
  });
});

describe("ownerError", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    requestHeaders.delete("tailscale-user-login");
  });

  it("lets only the owner's Tailscale login through", async () => {
    vi.stubEnv("CADENT_OWNER", "joey@example.com");
    expect(await ownerError()).toBeDefined();
    requestHeaders.set("tailscale-user-login", "someone@example.com");
    expect(await ownerError()).toBeDefined();
    requestHeaders.set("tailscale-user-login", "Joey@Example.com");
    expect(await ownerError()).toBeUndefined();
  });

  it("refuses everyone in production until an owner is set", async () => {
    vi.stubEnv("CADENT_OWNER", "");
    vi.stubEnv("NODE_ENV", "production");
    requestHeaders.set("tailscale-user-login", "joey@example.com");
    expect(await ownerError()).toBeDefined();
  });
});
