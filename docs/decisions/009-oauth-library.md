# ADR 009: OAuth via an established library, chosen by a spike

Status: Accepted (2026-10-16)

## Context

MCP connectors need an OAuth 2.1 authorization server. Auth is security-critical and complex.

## Decision

Spend up to three days in week 1 getting one real MCP client to sign in to a toy FastAPI app, then pick the library that worked.

## Alternatives considered

Hand-rolled OAuth.

## Consequences

The riskiest unknown is settled first. The chosen library is recorded in an update to this ADR.

## Update (2026-10-20): spike result

**Chosen: the MCP Python SDK's own authorization server** (`mcp` 2.x,
`MCPServer(auth_server_provider=..., auth=AuthSettings(...))`). Candidates 2 (Authlib) and 3 (a
separate identity server) were not needed.

Why: claude.ai signed in through a custom connector and called `ping` on the first try. The SDK
provides discovery (RFC 8414 and 9728 metadata), dynamic client registration, `/authorize` with
PKCE S256 checks, `/token`, revocation, bearer validation and the `WWW-Authenticate` 401. We write
only storage (the provider protocol: clients, codes, tokens) and the login page. The spike's
provider plus login page is about 150 lines (`spikes/oauth-mcp/server.py`).

Cost: the provider is still our code. Codes and tokens must be random (`secrets`), single use,
expiring, and bound to their client; refresh tokens rotate. In production they live in Postgres,
stored hashed. One more dependency, and `mcp` is at 2.x with renames since 1.x (FastMCP is now
`MCPServer`), so pin it and read the changelog on upgrades.

Observed from claude.ai: it registers a public client (`token_endpoint_auth_method: none`), uses
redirect `https://claude.ai/api/mcp/auth_callback`, and sends `resource=<server>/mcp`. So we set
`validate_token_resource=True` and refuse tokens issued for another resource.

Not proven by the spike: refresh-token use by claude.ai (tokens did not expire during the test),
behaviour behind Caddy on the VPS (forwarded host and HTTPS), CSRF protection and rate limiting on
the login form, real user accounts, and clients other than claude.ai.
