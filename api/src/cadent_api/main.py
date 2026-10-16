"""FastAPI application entry point. Run with: uvicorn cadent_api.main:app"""

import logging

import structlog
from fastapi import FastAPI

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)

log = structlog.get_logger()

app = FastAPI(title="Cadent API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check for Docker and uptime monitoring."""
    return {"status": "ok"}


log.info("api.started", version=app.version)
