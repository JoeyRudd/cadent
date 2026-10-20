"""Spike: OAuth 2.1 sign-in for an MCP connector using only the MCP SDK's auth server.

Throwaway. In-memory storage, one hard-coded user. See specs/oauth-mcp-spike.md.

Run:  BASE_URL=https://<tunnel-host> uv run python server.py
"""

import html
import os
import secrets
import time
from urllib.parse import urlparse

import uvicorn
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    RefreshToken,
    TokenError,
    construct_redirect_uri,
)
from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions, RevocationOptions
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse, Response

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
ACCESS_TOKEN_TTL = int(os.environ.get("ACCESS_TOKEN_TTL", "3600"))
CODE_TTL = 300

# The one test user.
TEST_USER_ID = "user-1"
TEST_USERNAME = "joey"
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "spike-password")


class InMemoryProvider:
    """Everything the SDK delegates to us: storage, and what happens at /authorize."""

    def __init__(self) -> None:
        self.clients: dict[str, OAuthClientInformationFull] = {}
        self.pending: dict[str, tuple[str, AuthorizationParams]] = {}  # login txn -> request
        self.codes: dict[str, AuthorizationCode] = {}
        self.access_tokens: dict[str, AccessToken] = {}
        self.refresh_tokens: dict[str, RefreshToken] = {}

    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        return self.clients.get(client_id)

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        assert client_info.client_id is not None
        self.clients[client_info.client_id] = client_info

    async def authorize(
        self, client: OAuthClientInformationFull, params: AuthorizationParams
    ) -> str:
        assert client.client_id is not None
        txn = secrets.token_urlsafe(32)
        self.pending[txn] = (client.client_id, params)
        return f"{BASE_URL}/login?txn={txn}"

    def complete_login(self, txn: str, user_id: str) -> str:
        """Turn a successful login into a code and the client redirect URL."""
        client_id, params = self.pending.pop(txn)
        code = secrets.token_urlsafe(32)
        self.codes[code] = AuthorizationCode(
            code=code,
            scopes=params.scopes or [],
            expires_at=time.time() + CODE_TTL,
            client_id=client_id,
            code_challenge=params.code_challenge,
            redirect_uri=params.redirect_uri,
            redirect_uri_provided_explicitly=params.redirect_uri_provided_explicitly,
            resource=params.resource,
            subject=user_id,
        )
        return construct_redirect_uri(str(params.redirect_uri), code=code, state=params.state)

    async def load_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: str
    ) -> AuthorizationCode | None:
        code = self.codes.get(authorization_code)
        if code is None or code.client_id != client.client_id:
            return None
        return code

    async def exchange_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: AuthorizationCode
    ) -> OAuthToken:
        del self.codes[authorization_code.code]  # single use
        return self._issue(
            client,
            authorization_code.scopes,
            authorization_code.resource,
            authorization_code.subject,
        )

    async def load_refresh_token(
        self, client: OAuthClientInformationFull, refresh_token: str
    ) -> RefreshToken | None:
        token = self.refresh_tokens.get(refresh_token)
        if token is None or token.client_id != client.client_id:
            return None
        return token

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: RefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        if self.refresh_tokens.pop(refresh_token.token, None) is None:  # rotate: single use
            raise TokenError("invalid_grant", "refresh token already used")
        return self._issue(
            client, scopes or refresh_token.scopes, refresh_token.resource, refresh_token.subject
        )

    async def load_access_token(self, token: str) -> AccessToken | None:
        access = self.access_tokens.get(token)
        if access is None:
            return None
        if access.expires_at is not None and access.expires_at < time.time():
            del self.access_tokens[token]
            return None
        return access

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        self.access_tokens.pop(token.token, None)
        self.refresh_tokens.pop(token.token, None)

    def _issue(
        self,
        client: OAuthClientInformationFull,
        scopes: list[str],
        resource: str | None,
        subject: str | None,
    ) -> OAuthToken:
        assert client.client_id is not None
        access = secrets.token_urlsafe(32)
        refresh = secrets.token_urlsafe(32)
        self.access_tokens[access] = AccessToken(
            token=access,
            client_id=client.client_id,
            scopes=scopes,
            expires_at=int(time.time()) + ACCESS_TOKEN_TTL,
            resource=resource,
            subject=subject,
        )
        self.refresh_tokens[refresh] = RefreshToken(
            token=refresh,
            client_id=client.client_id,
            scopes=scopes,
            resource=resource,
            subject=subject,
        )
        return OAuthToken(
            access_token=access,
            token_type="Bearer",
            expires_in=ACCESS_TOKEN_TTL,
            refresh_token=refresh,
            scope=" ".join(scopes) or None,
        )


provider = InMemoryProvider()

server = MCPServer(
    name="cadent-spike",
    auth_server_provider=provider,
    auth=AuthSettings(
        issuer_url=BASE_URL,
        resource_server_url=f"{BASE_URL}/mcp",
        validate_token_resource=True,  # claude.ai sends `resource`; refuse tokens for elsewhere
        client_registration_options=ClientRegistrationOptions(enabled=True),
        revocation_options=RevocationOptions(enabled=True),
    ),
)


@server.tool()
def ping() -> dict[str, str]:
    """Return the id of the signed-in user."""
    token = get_access_token()
    assert token is not None and token.subject is not None
    return {"user": token.subject}


LOGIN_PAGE = """<!doctype html><meta name=viewport content="width=device-width">
<title>Cadent sign in</title>
<form method=post action=/login>
<input type=hidden name=txn value="{txn}">
<p>{error}</p>
<p><label>Username <input name=username autocomplete=username></label></p>
<p><label>Password <input name=password type=password autocomplete=current-password></label></p>
<p><button>Sign in</button></p>
</form>"""


@server.custom_route("/login", methods=["GET", "POST"])
async def login(request: Request) -> Response:
    if request.method == "GET":
        txn = request.query_params.get("txn", "")
        if txn not in provider.pending:
            return HTMLResponse("Unknown or expired sign-in request.", status_code=400)
        return HTMLResponse(LOGIN_PAGE.format(txn=html.escape(txn), error=""))

    form = await request.form()
    txn = str(form.get("txn", ""))
    if txn not in provider.pending:
        return HTMLResponse("Unknown or expired sign-in request.", status_code=400)
    ok_user = secrets.compare_digest(str(form.get("username", "")), TEST_USERNAME)
    ok_pass = secrets.compare_digest(str(form.get("password", "")), TEST_PASSWORD)
    if not (ok_user and ok_pass):
        page = LOGIN_PAGE.format(txn=html.escape(txn), error="Wrong username or password.")
        return HTMLResponse(page, status_code=401)
    return RedirectResponse(provider.complete_login(txn, TEST_USER_ID), status_code=302)


def app():
    host = urlparse(BASE_URL).netloc
    security = TransportSecuritySettings(
        allowed_hosts=[host, "localhost:*", "127.0.0.1:*"],
        allowed_origins=[BASE_URL, "https://claude.ai", "http://localhost:*"],
    )
    return server.streamable_http_app(transport_security=security)


if __name__ == "__main__":
    uvicorn.run(app(), host="127.0.0.1", port=int(os.environ.get("PORT", "8000")))
