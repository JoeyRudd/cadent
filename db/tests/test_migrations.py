"""Schema tests on real Postgres 16 (Testcontainers). They need Docker: they fail, never skip."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, delete, func, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession
from testcontainers.community.postgres import PostgresContainer

from cadent_db.models import (
    Activity,
    ActivityLap,
    Base,
    Checkin,
    DailyRecovery,
    DataSourceAccount,
    OAuthClient,
    OAuthCode,
    OAuthToken,
    Plan,
    PlanWeek,
    RuleFinding,
    RunMatch,
    Session,
    User,
    UserProfile,
)

ALEMBIC_INI = Path(__file__).parents[1] / "alembic.ini"
NOT_USER_OWNED = {"users", "oauth_clients"}
NOW = datetime(2026, 10, 20, 7, 0, tzinfo=UTC)


@pytest.fixture(scope="module")
def alembic() -> Iterator[Config]:
    with PostgresContainer("postgres:16-alpine", driver="psycopg") as pg:
        config = Config(str(ALEMBIC_INI))
        config.set_main_option("sqlalchemy.url", pg.get_connection_url())
        command.upgrade(config, "head")
        yield config


@pytest.fixture(scope="module")
def engine(alembic: Config) -> Iterator[Engine]:
    engine = create_engine(alembic.get_main_option("sqlalchemy.url") or "")
    yield engine
    engine.dispose()


def new_id() -> uuid.UUID:
    return uuid.uuid4()


def activity(user_id: uuid.UUID, account_id: uuid.UUID, source_id: str) -> Activity:
    return Activity(
        id=new_id(),
        user_id=user_id,
        data_source_account_id=account_id,
        provider="garmin",
        source_id=source_id,
        started_at=NOW,
        local_date=NOW.date(),
        type="running",
        distance_m=10_000,
        duration_s=3_300,
        raw={},
    )


def add_user(db: DbSession) -> uuid.UUID:
    """A user with one row in every user-owned table. Returns the user's id."""
    user_id, account_id, plan_id, week_id, session_id = (new_id() for _ in range(5))
    client_id = str(new_id())
    run = activity(user_id, account_id, source_id=str(new_id()))
    expires = NOW + timedelta(hours=1)
    callback = "https://claude.ai/api/mcp/auth_callback"
    rows: list[Base] = [
        User(
            id=user_id,
            email=f"{user_id}@example.com",
            password_hash="x",
            timezone="UTC",
            role="owner",
        ),
        OAuthClient(id=new_id(), client_id=client_id, redirect_uris=[callback], metadata_={}),
        UserProfile(id=new_id(), user_id=user_id),
        DataSourceAccount(id=account_id, user_id=user_id, provider="garmin"),
        run,
        ActivityLap(
            id=new_id(),
            user_id=user_id,
            activity_id=run.id,
            index=0,
            distance_m=1_000,
            duration_s=330,
        ),
        DailyRecovery(id=new_id(), user_id=user_id, date=NOW.date()),
        Plan(id=plan_id, user_id=user_id, name="Toronto Half", source="imported", status="active"),
        PlanWeek(id=week_id, user_id=user_id, plan_id=plan_id, index=0),
        Session(
            id=session_id,
            user_id=user_id,
            plan_week_id=week_id,
            date=NOW.date(),
            type="easy",
            distance_m=10_000,
        ),
        RunMatch(
            id=new_id(),
            user_id=user_id,
            session_id=session_id,
            activity_id=run.id,
            match_method="auto",
        ),
        Checkin(id=new_id(), user_id=user_id, activity_id=run.id, rpe=4, soreness=2),
        RuleFinding(
            id=new_id(),
            user_id=user_id,
            plan_id=plan_id,
            week_index=0,
            rule_code="MIN_RUN",
            severity="warning",
            day=NOW.date(),
            message="Run is under 5 km",
        ),
        OAuthCode(
            id=new_id(),
            user_id=user_id,
            client_id=client_id,
            code_hash=str(new_id()),
            redirect_uri=callback,
            code_challenge="c",
            scopes=["mcp"],
            expires_at=expires,
        ),
        OAuthToken(
            id=new_id(),
            user_id=user_id,
            client_id=client_id,
            token_hash=str(new_id()),
            kind="access",
            scopes=["mcp"],
            expires_at=expires,
        ),
    ]
    for row in rows:  # one flush per row: no relationships are mapped, so insert parents first
        db.add(row)
        db.flush()
    return user_id


def test_upgrade_creates_every_table(engine: Engine) -> None:
    tables = set(inspect(engine).get_table_names()) - {"alembic_version"}
    assert tables == set(Base.metadata.tables)
    assert len(tables) == 15


def test_round_trip_matches_the_models(alembic: Config) -> None:
    command.downgrade(alembic, "-1")
    command.upgrade(alembic, "head")
    command.check(alembic)  # raises if any table, column or type differs from the models


def test_every_user_owned_table_has_a_cascading_user_id() -> None:
    for table in Base.metadata.sorted_tables:
        if table.name in NOT_USER_OWNED:
            continue
        user_id = table.c.get("user_id")
        assert user_id is not None, table.name
        assert not user_id.nullable, table.name
        [fk] = user_id.foreign_keys
        assert (fk.target_fullname, fk.ondelete) == ("users.id", "CASCADE"), table.name


def test_same_synced_activity_twice_is_rejected(engine: Engine) -> None:
    with DbSession(engine) as db:
        user_id = add_user(db)
        synced = db.scalars(select(Activity).where(Activity.user_id == user_id)).one()
        db.add(activity(user_id, synced.data_source_account_id, synced.source_id))
        with pytest.raises(IntegrityError):
            db.flush()


def test_one_active_plan_per_user(engine: Engine) -> None:
    with DbSession(engine) as db:
        user_id = add_user(db)
        db.add(Plan(id=new_id(), user_id=user_id, name="Draft", source="imported", status="draft"))
        db.flush()
        db.add(
            Plan(id=new_id(), user_id=user_id, name="Second", source="imported", status="active")
        )
        with pytest.raises(IntegrityError):
            db.flush()


def test_deleting_a_user_removes_all_their_rows(engine: Engine) -> None:
    with DbSession(engine) as db:
        user_id = add_user(db)
        db.execute(delete(User).where(User.id == user_id))
        for table in Base.metadata.sorted_tables:
            if table.name in NOT_USER_OWNED:
                continue
            left = db.scalar(
                select(func.count()).select_from(table).where(table.c.user_id == user_id)
            )
            assert left == 0, table.name
