# Spike: OAuth 2.1 + MCP sign-in

Timebox: 3 days (week 1). Outcome: a decision recorded in `docs/decisions/009-oauth-library.md`.

## Question

Which established library lets a real MCP client (Claude, via a custom connector) sign in to a
FastAPI app with OAuth 2.1 and call one tool, with the least custom security code?

## Scope

- A throwaway app under `spikes/oauth-mcp/` (not imported by `core` or `api`; delete or keep as
  reference after the decision).
- One MCP tool, `ping`, returning `{"user": <signed-in user id>}`, mounted at `/mcp` using the
  official MCP Python SDK (Streamable HTTP).
- OAuth 2.1 authorization code flow with PKCE, authorization-server metadata discovery, dynamic
  client registration, and a minimal login page with one hard-coded test user.
- Exposed over HTTPS with a temporary tunnel so claude.ai can reach it.

## Out of scope

Real user accounts, the database, refresh-token storage beyond memory, styling, production config.

## Candidates to evaluate

1. The MCP Python SDK's own auth server support, if it covers the authorization server role.
2. Authlib with its FastAPI/Starlette integration.
3. A separate open-source identity server (fallback only; adds a service, see ADR 004 and 010).

## Acceptance

- [ ] Adding the tunnel URL + `/mcp` as a custom connector in claude.ai triggers the login page
- [ ] After login, Claude calls `ping` and gets back the test user's id
- [ ] A request with no token or an expired token gets 401
- [ ] ADR 009 updated: library chosen, why, what it costs, and anything the spike could not prove

## End-to-end check

In a claude.ai chat with the connector enabled, ask "call ping" and see the user id in the reply.
