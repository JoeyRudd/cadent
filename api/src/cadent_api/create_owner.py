"""Create the single owner: python -m cadent_api.create_owner --email ... --timezone ..."""

import argparse
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from cadent_api.db import engine
from cadent_db.models import User

# Matches no password hash, so nobody can sign in until login (step 4) sets a real one.
UNUSABLE_PASSWORD = "!"


def create_owner(db: Session, email: str, timezone: str) -> User:
    """Add the owner. Raises ValueError if one already exists."""
    if db.scalar(select(User).where(User.role == "owner")) is not None:
        raise ValueError("An owner already exists.")
    owner = User(
        email=email.lower(), password_hash=UNUSABLE_PASSWORD, timezone=timezone, role="owner"
    )
    db.add(owner)
    db.commit()
    return owner


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--timezone", required=True, help="IANA name, e.g. America/Toronto")
    args = parser.parse_args(argv)
    with Session(engine()) as db:
        try:
            owner = create_owner(db, args.email, args.timezone)
        except ValueError as refused:
            print(refused, file=sys.stderr)
            sys.exit(1)
        print(f"Created owner {owner.email}.")


if __name__ == "__main__":
    main()
