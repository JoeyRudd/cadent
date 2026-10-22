"""create_owner (specs/plan-import.md). Needs Docker: fails, never skips."""

import pytest
from conftest import add_user
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from cadent_api.create_owner import create_owner, main
from cadent_db.models import User


def users(db: DbSession) -> list[User]:
    db.expire_all()
    return list(db.scalars(select(User)))


def test_creates_the_owner_on_an_empty_database(db: DbSession) -> None:
    owner = create_owner(db, "joey@example.com", "America/Toronto")
    [saved] = users(db)
    assert saved.id == owner.id
    assert (saved.email, saved.timezone, saved.role) == (
        "joey@example.com",
        "America/Toronto",
        "owner",
    )


def test_owner_email_is_lowercased(db: DbSession) -> None:
    create_owner(db, "Joey.Rudd@Example.COM", "America/Toronto")
    assert [u.email for u in users(db)] == ["joey.rudd@example.com"]


def test_owner_gets_a_password_hash_placeholder(db: DbSession) -> None:
    create_owner(db, "joey@example.com", "America/Toronto")
    [saved] = users(db)
    assert saved.password_hash  # set later by login; never empty


def test_a_second_owner_is_refused(db: DbSession) -> None:
    create_owner(db, "joey@example.com", "America/Toronto")
    db.commit()
    with pytest.raises(ValueError):
        create_owner(db, "someone@example.com", "UTC")
    db.rollback()
    assert [(u.email, u.role) for u in users(db)] == [("joey@example.com", "owner")]


def test_the_same_owner_twice_is_refused(db: DbSession) -> None:
    create_owner(db, "joey@example.com", "America/Toronto")
    db.commit()
    with pytest.raises(ValueError):
        create_owner(db, "JOEY@example.com", "America/Toronto")
    db.rollback()
    assert len(users(db)) == 1


def test_an_existing_non_owner_does_not_block_the_owner(db: DbSession) -> None:
    add_user(db, "friend@example.com", "user")
    create_owner(db, "joey@example.com", "America/Toronto")
    assert sorted((u.email, u.role) for u in users(db)) == [
        ("friend@example.com", "user"),
        ("joey@example.com", "owner"),
    ]


def run_main(monkeypatch: pytest.MonkeyPatch, database_url: str, email: str) -> object:
    """Run the CLI against the test database; returns its exit code (None when it just returns)."""
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setattr(
        "sys.argv", ["create_owner", "--email", email, "--timezone", "America/Toronto"]
    )
    try:
        main()
    except SystemExit as exit_:
        return exit_.code
    return None


def test_main_creates_the_owner(
    db: DbSession, monkeypatch: pytest.MonkeyPatch, database_url: str
) -> None:
    assert run_main(monkeypatch, database_url, "Joey@Example.com") in (None, 0)
    assert [(u.email, u.role) for u in users(db)] == [("joey@example.com", "owner")]


def test_main_exits_1_when_an_owner_exists(
    db: DbSession, monkeypatch: pytest.MonkeyPatch, database_url: str
) -> None:
    add_user(db, "joey@example.com", "owner")
    assert run_main(monkeypatch, database_url, "someone@example.com") == 1
    assert [u.email for u in users(db)] == ["joey@example.com"]
