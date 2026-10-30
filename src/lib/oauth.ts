// The OAuth server that lets Claude reach Cadent's MCP endpoint (mcp.ts) as a claude.ai connector.
// Server-only. Claude registers itself (RFC 7591), the owner approves it on /connect over the tailnet,
// and Claude trades the code for tokens with PKCE. Only Claude's own callback URLs may register, and
// tokens, codes and refresh tokens are stored as SHA-256 hashes, never as themselves.

import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { dbPath, readTable, writeTable } from "./activities";

/** Claude's OAuth callbacks: claude.ai today, claude.com later (Anthropic's custom connector docs). */
const CLAUDE_CALLBACKS = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"];

/** Claude Code's callback, on this machine: accepted under `next dev` only, to try the connector without Funnel. */
const LOCAL_CALLBACK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s]*$/;

/** Whether `uri` may receive codes: Claude's callbacks, and in development a localhost one. */
function allowedCallback(uri: unknown, dev = process.env.NODE_ENV === "development"): boolean {
  return typeof uri === "string" && (CLAUDE_CALLBACKS.includes(uri) || (dev && LOCAL_CALLBACK.test(uri)));
}

const CODE_MS = 5 * 60_000;
/** Registration is open to the internet, so unused clients expire and only a few may wait at once. */
const UNUSED_CLIENT_MS = 24 * 60 * 60_000;
const MAX_CLIENTS = 20;
const ACCESS_MS = 60 * 60_000;
const REFRESH_MS = 90 * 24 * 60 * 60_000;

/** Trailing slashes off, so "https://host/mcp/" and "https://host/mcp" are the same resource. */
const trim = (url: string) => url.replace(/\/+$/, "");

/** Where Claude reaches Cadent from the internet (Tailscale Funnel) and where the owner approves it (the tailnet). */
export type Urls = { issuer: string; mcp: string; authorize: string };

/**
 * The connector's URLs from CADENT_PUBLIC_URL and CADENT_URL, or undefined while either is unset,
 * which turns the connector off.
 */
export function connectorUrls(): Urls | undefined {
  const issuer = process.env.CADENT_PUBLIC_URL && trim(process.env.CADENT_PUBLIC_URL);
  const app = process.env.CADENT_URL && trim(process.env.CADENT_URL);
  if (!issuer || !app) return undefined;
  return { issuer, mcp: `${issuer}/mcp`, authorize: `${app}/connect` };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
  client_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
)`;

/** An OAuth error response body (RFC 6749 §5.2). */
type OAuthError = { error: string; error_description: string };

const fail = (error: string, error_description: string): OAuthError => ({ error, error_description });

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");

const write = <T>(file: string, run: (db: DatabaseSync) => T): T => writeTable(SCHEMA, run, file);

/** Drops spent codes and tokens; run where new ones are minted. */
function prune(db: DatabaseSync): void {
  db.prepare("DELETE FROM oauth_codes WHERE expires_at < ?").run(Date.now());
  db.prepare("DELETE FROM oauth_tokens WHERE expires_at < ?").run(Date.now());
}

type Client = { client_id: string; name: string; redirect_uris: string[] };

/** Registers a client (RFC 7591). Only Claude's callbacks are accepted, so no one else can be sent a code. */
export function registerClient(body: unknown, file = dbPath(), dev?: boolean): (Client & { client_id_issued_at: number }) | OAuthError {
  const meta = (body ?? {}) as { client_name?: unknown; redirect_uris?: unknown };
  const uris = meta.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => allowedCallback(u, dev))) {
    return fail("invalid_redirect_uri", "Only Claude's connector callback can be registered.");
  }
  const client: Client = {
    client_id: secret(),
    name: typeof meta.client_name === "string" ? meta.client_name.slice(0, 100) : "Claude",
    redirect_uris: uris as string[],
  };
  const now = Date.now();
  const full = write(file, (db) => {
    db.prepare(
      "DELETE FROM oauth_clients WHERE created_at < ? AND client_id NOT IN (SELECT client_id FROM oauth_tokens)",
    ).run(new Date(now - UNUSED_CLIENT_MS).toISOString());
    const { count } = db.prepare("SELECT COUNT(*) AS count FROM oauth_clients").get() as { count: number };
    if (count >= MAX_CLIENTS) return true;
    db.prepare("INSERT INTO oauth_clients (client_id, name, redirect_uris, created_at) VALUES (?, ?, ?, ?)").run(
      client.client_id,
      client.name,
      JSON.stringify(client.redirect_uris),
      new Date(now).toISOString(),
    );
    return false;
  });
  if (full) return fail("temporarily_unavailable", "Too many connectors are waiting. Try again tomorrow.");
  return { ...client, client_id_issued_at: Math.floor(now / 1000) };
}

function clientById(id: string, file: string): Client | undefined {
  return readTable(
    "oauth_clients",
    undefined,
    (db) => {
      const row = db.prepare("SELECT client_id, name, redirect_uris FROM oauth_clients WHERE client_id = ?").get(id) as
        | { client_id: string; name: string; redirect_uris: string }
        | undefined;
      return row && { ...row, redirect_uris: JSON.parse(row.redirect_uris) as string[] };
    },
    file,
  );
}

/** An authorization request's query, as /connect receives it. */
export type AuthorizeRequest = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  resource?: string;
  state?: string;
};

/**
 * The client asking, or why the request can't go ahead. Until client_id and redirect_uri check out,
 * an error is shown on the page instead of being sent anywhere (OAuth 2.1 §4.1.2.1).
 */
export function checkAuthorize(req: AuthorizeRequest, urls: Urls, file = dbPath()): { client: Client } | { error: string } {
  const client = req.client_id ? clientById(req.client_id, file) : undefined;
  if (!client) return { error: "Claude isn't registered with Cadent. Remove the connector in Claude and add it again." };
  if (!req.redirect_uri || !client.redirect_uris.includes(req.redirect_uri)) return { error: "That isn't Claude's callback address." };
  if (req.response_type !== "code") return { error: "Cadent only supports the code flow." };
  if (!req.code_challenge || req.code_challenge_method !== "S256") return { error: "Claude must use PKCE (S256)." };
  // RFC 8707: a token for any other resource would be one Cadent hands out for someone else's server.
  if (req.resource && trim(req.resource) !== urls.mcp) return { error: "That connector address isn't this Cadent." };
  return { client };
}

/** A one-time code for an approved request. Call only after checkAuthorize passed and the owner approved. */
export function issueCode(req: AuthorizeRequest, file = dbPath()): string {
  const code = secret();
  write(file, (db) =>
    db
      .prepare("INSERT INTO oauth_codes (code_hash, client_id, redirect_uri, challenge, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(hash(code), req.client_id!, req.redirect_uri!, req.code_challenge!, Date.now() + CODE_MS),
  );
  return code;
}

export type Tokens = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string };

function issueTokens(db: DatabaseSync, client_id: string): Tokens {
  prune(db);
  const access = secret();
  const refresh = secret();
  const insert = db.prepare("INSERT INTO oauth_tokens (token_hash, kind, client_id, expires_at) VALUES (?, ?, ?, ?)");
  insert.run(hash(access), "access", client_id, Date.now() + ACCESS_MS);
  insert.run(hash(refresh), "refresh", client_id, Date.now() + REFRESH_MS);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_MS / 1000, refresh_token: refresh };
}

/** The token endpoint: a code with its PKCE verifier, or a refresh token, for new tokens. A refresh token works once. */
export function exchange(form: URLSearchParams, urls: Urls, file = dbPath()): Tokens | OAuthError {
  const client_id = form.get("client_id") ?? "";
  const resource = form.get("resource");
  if (resource && trim(resource) !== urls.mcp) return fail("invalid_target", "That isn't this Cadent's connector address.");
  const grant = form.get("grant_type");

  if (grant === "authorization_code") {
    const code = form.get("code") ?? "";
    const verifier = form.get("code_verifier") ?? "";
    return write(file, (db) => {
      const row = db
        .prepare("SELECT client_id, redirect_uri, challenge FROM oauth_codes WHERE code_hash = ? AND expires_at >= ?")
        .get(hash(code), Date.now()) as { client_id: string; redirect_uri: string; challenge: string } | undefined;
      // Spent whether or not the rest checks out, so a stolen code can't be tried twice.
      db.prepare("DELETE FROM oauth_codes WHERE code_hash = ?").run(hash(code));
      if (!row || row.client_id !== client_id || row.redirect_uri !== form.get("redirect_uri")) {
        return fail("invalid_grant", "That code is wrong, used or expired.");
      }
      if (createHash("sha256").update(verifier).digest("base64url") !== row.challenge) {
        return fail("invalid_grant", "The PKCE verifier doesn't match.");
      }
      return issueTokens(db, client_id);
    });
  }

  if (grant === "refresh_token") {
    const token = form.get("refresh_token") ?? "";
    return write(file, (db) => {
      const row = db
        .prepare("SELECT client_id FROM oauth_tokens WHERE token_hash = ? AND kind = 'refresh' AND expires_at >= ?")
        .get(hash(token), Date.now()) as { client_id: string } | undefined;
      if (!row || row.client_id !== client_id) return fail("invalid_grant", "That refresh token is wrong, used or expired.");
      // Rotated: Claude is a public client, so each refresh token is good for one use (OAuth 2.1 §4.3.1).
      db.prepare("DELETE FROM oauth_tokens WHERE token_hash = ?").run(hash(token));
      return issueTokens(db, client_id);
    });
  }

  return fail("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

/** Whether `authorization` (the request's header) carries a live access token. */
export function validToken(authorization: string | null, file = dbPath()): boolean {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return false;
  return readTable(
    "oauth_tokens",
    false,
    (db) =>
      db
        .prepare("SELECT 1 FROM oauth_tokens WHERE token_hash = ? AND kind = 'access' AND expires_at >= ?")
        .get(hash(token), Date.now()) !== undefined,
    file,
  );
}

/** Signs Claude out: every token is deleted, so the connector has to be approved again. */
export function revokeAll(file = dbPath()): void {
  write(file, (db) => db.exec("DELETE FROM oauth_tokens; DELETE FROM oauth_codes; DELETE FROM oauth_clients"));
}

/** Whether Claude holds a live refresh token, so the connector still works without approving it again. */
export function claudeConnected(file = dbPath()): boolean {
  return readTable(
    "oauth_tokens",
    false,
    (db) => db.prepare("SELECT 1 FROM oauth_tokens WHERE kind = 'refresh' AND expires_at >= ?").get(Date.now()) !== undefined,
    file,
  );
}
