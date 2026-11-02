import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { checkAuthorize, claudeConnected, exchange, issueCode, registerClient, revokeAll, validToken, type Tokens } from "./oauth";

const dir = mkdtempSync(path.join(tmpdir(), "cadent-oauth-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const URLS = { issuer: "https://box.ts.net:8443", mcp: "https://box.ts.net:8443/mcp", authorize: "https://box.ts.net/connect" };
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "a-verifier-that-is-long-enough-for-pkce-0123456789";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");

let n = 0;
const fresh = () => path.join(dir, `${n++}.db`);

function register(file: string) {
  const client = registerClient({ client_name: "Claude", redirect_uris: [CALLBACK] }, file);
  if ("error" in client) throw new Error(client.error);
  return client;
}

function request(client_id: string) {
  return {
    response_type: "code",
    client_id,
    redirect_uri: CALLBACK,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    resource: URLS.mcp,
    state: "xyz",
  };
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields);

describe("registerClient", () => {
  it("only accepts Claude's callbacks", () => {
    const file = fresh();
    expect(registerClient({ redirect_uris: ["https://evil.example/cb"] }, file)).toMatchObject({ error: "invalid_redirect_uri" });
    expect(registerClient({ redirect_uris: [CALLBACK, "https://evil.example/cb"] }, file)).toMatchObject({ error: "invalid_redirect_uri" });
    expect(registerClient({}, file)).toMatchObject({ error: "invalid_redirect_uri" });
    expect(register(file).redirect_uris).toEqual([CALLBACK]);
  });

  it("accepts a localhost callback in development only", () => {
    const file = fresh();
    const local = { redirect_uris: ["http://localhost:54321/callback"] };
    expect(registerClient(local, file, false)).toMatchObject({ error: "invalid_redirect_uri" });
    expect(registerClient(local, file, true)).toHaveProperty("client_id");
    expect(registerClient({ redirect_uris: ["http://localhost.evil.example/cb"] }, file, true)).toMatchObject({ error: "invalid_redirect_uri" });
  });

  it("stops registering once 20 clients are waiting", () => {
    const file = fresh();
    for (let i = 0; i < 20; i++) register(file);
    expect(registerClient({ redirect_uris: [CALLBACK] }, file)).toMatchObject({ error: "temporarily_unavailable" });
  });
});

describe("checkAuthorize", () => {
  it("passes Claude's request and refuses a changed one", () => {
    const file = fresh();
    const { client_id } = register(file);
    expect(checkAuthorize(request(client_id), URLS, file)).toHaveProperty("client");
    expect(checkAuthorize({ ...request(client_id), client_id: "nope" }, URLS, file)).toHaveProperty("error");
    expect(checkAuthorize({ ...request(client_id), redirect_uri: "https://claude.com/api/mcp/auth_callback" }, URLS, file)).toHaveProperty("error");
    expect(checkAuthorize({ ...request(client_id), code_challenge_method: "plain" }, URLS, file)).toHaveProperty("error");
    expect(checkAuthorize({ ...request(client_id), resource: "https://other.example/mcp" }, URLS, file)).toHaveProperty("error");
  });
});

describe("exchange", () => {
  function tokens(file: string) {
    const { client_id } = register(file);
    const code = issueCode(request(client_id), file);
    const result = exchange(
      form({ grant_type: "authorization_code", code, code_verifier: VERIFIER, client_id, redirect_uri: CALLBACK, resource: URLS.mcp }),
      URLS,
      file,
    );
    return { client_id, code, result: result as Tokens };
  }

  it("trades a code and its verifier for a working access token", () => {
    const file = fresh();
    const { result } = tokens(file);
    expect(result.token_type).toBe("Bearer");
    expect(validToken(`Bearer ${result.access_token}`, file)).toBe(true);
    expect(validToken(`Bearer ${result.refresh_token}`, file)).toBe(false);
    expect(validToken("Bearer wrong", file)).toBe(false);
    expect(validToken(null, file)).toBe(false);
    expect(claudeConnected(file)).toBe(true);
  });

  it("spends a code on its first try, right or wrong", () => {
    const file = fresh();
    const { client_id } = register(file);
    const code = issueCode(request(client_id), file);
    const base = { grant_type: "authorization_code", code, client_id, redirect_uri: CALLBACK };
    expect(exchange(form({ ...base, code_verifier: "wrong" }), URLS, file)).toMatchObject({ error: "invalid_grant" });
    expect(exchange(form({ ...base, code_verifier: VERIFIER }), URLS, file)).toMatchObject({ error: "invalid_grant" });
  });

  it("refuses a code sent with another client or callback", () => {
    const file = fresh();
    const { client_id } = register(file);
    const other = register(file).client_id;
    const code = issueCode(request(client_id), file);
    expect(
      exchange(form({ grant_type: "authorization_code", code, code_verifier: VERIFIER, client_id: other, redirect_uri: CALLBACK }), URLS, file),
    ).toMatchObject({ error: "invalid_grant" });
  });

  it("rotates refresh tokens, so each works once", () => {
    const file = fresh();
    const { client_id, result } = tokens(file);
    const refresh = form({ grant_type: "refresh_token", refresh_token: result.refresh_token, client_id });
    const next = exchange(refresh, URLS, file) as Tokens;
    expect(validToken(`Bearer ${next.access_token}`, file)).toBe(true);
    expect(exchange(refresh, URLS, file)).toMatchObject({ error: "invalid_grant" });
  });

  it("refuses tokens for another resource", () => {
    const file = fresh();
    expect(exchange(form({ grant_type: "refresh_token", resource: "https://other.example/mcp" }), URLS, file)).toMatchObject({
      error: "invalid_target",
    });
  });

  it("signs Claude out with revokeAll", () => {
    const file = fresh();
    const { result } = tokens(file);
    revokeAll(file);
    expect(validToken(`Bearer ${result.access_token}`, file)).toBe(false);
    expect(claudeConnected(file)).toBe(false);
  });
});
