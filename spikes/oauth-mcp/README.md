# OAuth 2.1 + MCP spike

Throwaway, see `specs/oauth-mcp-spike.md`. Candidate 1: the MCP Python SDK's own auth server
(`mcp` 2.x, `MCPServer(auth_server_provider=...)`). We write only storage and a login page.

```bash
uv sync
uv run pytest -q          # full OAuth flow + ping, and the 401 checks
```

Against claude.ai:

1. `cloudflared tunnel --url http://localhost:8000` and copy the `https://….trycloudflare.com` URL.
2. `BASE_URL=https://….trycloudflare.com uv run python server.py`
3. claude.ai → Settings → Connectors → Add custom connector → `https://….trycloudflare.com/mcp`.
4. Sign in as `joey` / `spike-password` (or `TEST_PASSWORD`), then ask Claude to "call ping".
