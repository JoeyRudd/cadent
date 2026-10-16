from typing import cast

import httpx
from fastapi.testclient import TestClient

from cadent_api.main import app


def get(path: str) -> httpx.Response:
    """Starlette's TestClient.get is untyped under strict Pyright; pin the type once here."""
    return cast(httpx.Response, TestClient(app).get(path))  # pyright: ignore[reportUnknownMemberType]


def test_health_reports_ok() -> None:
    response = get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
