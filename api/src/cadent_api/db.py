"""Database access for requests: one SQLAlchemy session per request, from DATABASE_URL."""

import os
from collections.abc import Iterator
from functools import cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session


@cache
def engine() -> Engine:
    return create_engine(os.environ["DATABASE_URL"])


def get_db() -> Iterator[Session]:
    """FastAPI dependency. Nothing is saved unless the endpoint commits."""
    with Session(engine()) as db:
        yield db
