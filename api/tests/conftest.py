"""API test fixtures on real Postgres 16 (Testcontainers). They need Docker: never skipped."""

import uuid
from collections.abc import Iterator
from datetime import date, timedelta
from pathlib import Path
from typing import Any, cast

import httpx
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, func, select, text
from sqlalchemy.orm import Session as DbSession
from testcontainers.community.postgres import PostgresContainer

from cadent_api.main import app
from cadent_db.models import Base, Plan, PlanWeek, RuleFinding, Session, User

ALEMBIC_INI = Path(__file__).parents[2] / "db" / "alembic.ini"
PLAN_TABLES: tuple[type[Base], ...] = (Plan, PlanWeek, Session, RuleFinding)

PlanDict = dict[str, Any]


# --- database


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    with PostgresContainer("postgres:16-alpine", driver="psycopg") as pg:
        url = pg.get_connection_url()
        config = Config(str(ALEMBIC_INI))
        config.set_main_option("sqlalchemy.url", url)
        command.upgrade(config, "head")
        yield url


@pytest.fixture(scope="session")
def engine(database_url: str) -> Iterator[Engine]:
    engine = create_engine(database_url)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[DbSession]:
    """A session on an empty database: every table is truncated before the test."""
    names = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE TABLE {names} CASCADE"))
    with DbSession(engine, expire_on_commit=False) as session:
        yield session


def add_user(db: DbSession, email: str, role: str) -> User:
    user = User(id=uuid.uuid4(), email=email, password_hash="!", timezone="UTC", role=role)
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def owner(db: DbSession) -> User:
    return add_user(db, "owner@example.com", "owner")


@pytest.fixture
def other(db: DbSession) -> User:
    return add_user(db, "other@example.com", "user")


def row_counts(engine: Engine) -> dict[str, int]:
    """Rows in each table an import writes to."""
    with DbSession(engine) as session:
        return {
            model.__tablename__: session.scalar(select(func.count()).select_from(model)) or 0
            for model in PLAN_TABLES
        }


# --- typed client


class Api:
    """A TestClient acting as one user at a time. Starlette's client is untyped under strict
    Pyright, so the types are pinned once here (as in test_health.py)."""

    def __init__(self, client: TestClient) -> None:
        self.client = client
        self.user: User | None = None

    def act_as(self, user: User) -> None:
        self.user = user

    def get(self, path: str) -> httpx.Response:
        return cast(httpx.Response, self.client.get(path))  # pyright: ignore[reportUnknownMemberType]

    def post(self, path: str, body: object = None) -> httpx.Response:
        if body is None:
            return cast(httpx.Response, self.client.post(path))  # pyright: ignore[reportUnknownMemberType]
        return cast(httpx.Response, self.client.post(path, json=body))  # pyright: ignore[reportUnknownMemberType]

    def import_plan(self, plan: PlanDict) -> dict[str, Any]:
        response = self.post("/plans/import", plan)
        assert response.status_code == 200, response.text
        return cast(dict[str, Any], response.json())

    def plan(self, plan_id: str) -> dict[str, Any]:
        response = self.get(f"/plans/{plan_id}")
        assert response.status_code == 200, response.text
        return cast(dict[str, Any], response.json())

    def accept(self, plan_id: str, finding_id: str, body: object = None) -> httpx.Response:
        return self.post(f"/plans/{plan_id}/findings/{finding_id}/accept", body)

    def activate(self, plan_id: str) -> httpx.Response:
        return self.post(f"/plans/{plan_id}/activate")


@pytest.fixture
def api(engine: Engine, owner: User, other: User) -> Iterator[Api]:
    """The app on the test database, acting as the owner until `act_as` switches user."""
    # Imported here so test_health.py still collects without the plans feature.
    from cadent_api.db import get_db  # noqa: PLC0415
    from cadent_api.users import current_user  # noqa: PLC0415

    client = Api(TestClient(app))
    client.act_as(owner)

    def test_db() -> Iterator[DbSession]:
        with DbSession(engine) as session:
            yield session

    def test_user() -> User:
        assert client.user is not None
        return client.user

    app.dependency_overrides[get_db] = test_db
    app.dependency_overrides[current_user] = test_user
    yield client
    app.dependency_overrides.clear()


# --- cadent.plan/v1 builders (metres and seconds)

MONDAY = date(2026, 11, 2)


def run(day: date, type_: str, distance_m: int, **extra: Any) -> PlanDict:
    return {
        "date": day.isoformat(),
        "kind": "run",
        "type": type_,
        "distance_m": distance_m,
        **extra,
    }


def lift(day: date, name: str = "Full-body A") -> PlanDict:
    return {"date": day.isoformat(), "kind": "lift", "name": name}


def week(
    index: int, start: date, *sessions: PlanDict, cutback: bool = False, phase: str = "base"
) -> PlanDict:
    return {
        "index": index,
        "start": start.isoformat(),
        "phase": phase,
        "cutback": cutback,
        "sessions": list(sessions),
    }


def plan_file(*weeks: PlanDict, name: str = "Test plan") -> PlanDict:
    return {
        "schema": "cadent.plan/v1",
        "name": name,
        "race": {"date": "2027-05-02", "distance_m": 21097, "goal_time_s": 6600},
        "zones": {"z1": [126, 142], "z2": [142, 158], "z4": [173, 189]},
        "settings": {"min_run_m": 5000, "long_run_cap_m": 24000, "rest_day": "floating"},
        "weeks": list(weeks),
    }


def day(offset: int) -> date:
    return MONDAY + timedelta(days=offset)


def clean_plan(name: str = "Clean") -> PlanDict:
    """No Findings: one easy run of exactly 5 km and no long run."""
    return plan_file(week(20, MONDAY, run(day(1), "easy", 5000)), name=name)


def warning_plan() -> PlanDict:
    """One LONG_RUN_SPIKE Warning: a long run with no runs before it."""
    return plan_file(week(20, MONDAY, run(day(5), "long", 10000)))


def error_plan() -> PlanDict:
    """One LONG_RUN_SPIKE Error: a 15 km long run four days after a 5 km easy run."""
    return plan_file(week(20, MONDAY, run(day(1), "easy", 5000), run(day(5), "long", 15000)))


def min_run_plan() -> PlanDict:
    """One MIN_RUN Warning: a 4 km easy run."""
    return plan_file(week(20, MONDAY, run(day(1), "easy", 4000)))
