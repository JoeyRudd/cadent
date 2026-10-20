"""The spike's acceptance checks that do not need claude.ai: the full OAuth flow, then 401s."""

import base64
import hashlib
import json
import secrets
from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
import server

REDIRECT = "https://claude.ai/api/mcp/auth_callback"
MCP_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    app = server.app()
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=server.BASE_URL) as c,
    ):
        yield c


def rpc(method: str, params: dict[str, object], id_: int = 1) -> dict[str, object]:
    return {"jsonrpc": "2.0", "id": id_, "method": method, "params": params}


def last_event(response: httpx.Response) -> dict[str, object]:
    if response.headers["content-type"].startswith("application/json"):
        return response.json()
    data = [line[5:] for line in response.text.splitlines() if line.startswith("data:")]
    return json.loads(data[-1])


async def sign_in(client: httpx.AsyncClient) -> str:
    """Discovery, dynamic registration, PKCE authorize, login, token. Returns an access token."""
    unauthorized = await client.post("/mcp", headers=MCP_HEADERS, json=rpc("ping", {}))
    assert unauthorized.status_code == 401
    assert "resource_metadata=" in unauthorized.headers["www-authenticate"]

    prm = (await client.get("/.well-known/oauth-protected-resource/mcp")).json()
    assert prm["authorization_servers"] == [server.BASE_URL]
    meta = (await client.get("/.well-known/oauth-authorization-server")).json()
    assert "S256" in meta["code_challenge_methods_supported"]

    reg = await client.post(
        meta["registration_endpoint"],
        json={
            "redirect_uris": [REDIRECT],
            "token_endpoint_auth_method": "none",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "client_name": "test",
        },
    )
    assert reg.status_code == 201, reg.text
    client_id = reg.json()["client_id"]

    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=")
    authorize = await client.get(
        meta["authorization_endpoint"],
        params={
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": REDIRECT,
            "code_challenge": challenge.decode(),
            "code_challenge_method": "S256",
            "state": "xyz",
            "resource": f"{server.BASE_URL}/mcp",
        },
    )
    assert authorize.status_code == 302, authorize.text
    login_url = urlparse(authorize.headers["location"])
    txn = parse_qs(login_url.query)["txn"][0]
    assert (await client.get(f"/login?txn={txn}")).status_code == 200

    wrong = await client.post("/login", data={"txn": txn, "username": "joey", "password": "x"})
    assert wrong.status_code == 401
    login = await client.post(
        "/login", data={"txn": txn, "username": "joey", "password": server.TEST_PASSWORD}
    )
    assert login.status_code == 302
    callback = parse_qs(urlparse(login.headers["location"]).query)
    assert callback["state"] == ["xyz"]

    token = await client.post(
        meta["token_endpoint"],
        data={
            "grant_type": "authorization_code",
            "code": callback["code"][0],
            "redirect_uri": REDIRECT,
            "client_id": client_id,
            "code_verifier": verifier,
        },
    )
    assert token.status_code == 200, token.text
    return token.json()["access_token"]


async def call_ping(client: httpx.AsyncClient, access: str) -> httpx.Response:
    headers = {**MCP_HEADERS, "Authorization": f"Bearer {access}"}
    init = await client.post(
        "/mcp",
        headers=headers,
        json=rpc(
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "0"},
            },
        ),
    )
    if init.status_code != 200:
        return init
    session = (
        {"mcp-session-id": init.headers["mcp-session-id"]}
        if "mcp-session-id" in init.headers
        else {}
    )
    await client.post(
        "/mcp",
        headers={**headers, **session},
        json={"jsonrpc": "2.0", "method": "notifications/initialized"},
    )
    return await client.post(
        "/mcp",
        headers={**headers, **session},
        json=rpc("tools/call", {"name": "ping", "arguments": {}}, id_=2),
    )


@pytest.mark.anyio
async def test_signed_in_user_can_call_ping(client: httpx.AsyncClient) -> None:
    access = await sign_in(client)
    response = await call_ping(client, access)
    assert response.status_code == 200, response.text
    result = last_event(response)["result"]
    assert result["structuredContent"] == {"user": server.TEST_USER_ID}  # type: ignore[index]


@pytest.mark.anyio
async def test_no_token_is_401(client: httpx.AsyncClient) -> None:
    response = await client.post("/mcp", headers=MCP_HEADERS, json=rpc("initialize", {}))
    assert response.status_code == 401


@pytest.mark.anyio
async def test_unknown_token_is_401(client: httpx.AsyncClient) -> None:
    assert (await call_ping(client, "not-a-real-token")).status_code == 401


@pytest.mark.anyio
async def test_expired_token_is_401(client: httpx.AsyncClient) -> None:
    access = await sign_in(client)
    server.provider.access_tokens[access].expires_at = 0
    assert (await call_ping(client, access)).status_code == 401
