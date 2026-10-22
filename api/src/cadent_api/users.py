"""The current user. Until login exists (step 4), that is the single owner."""

from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from cadent_api.db import get_db
from cadent_db.models import User


def current_user(db: Annotated[Session, Depends(get_db)]) -> User:
    owner = db.scalar(select(User).where(User.role == "owner"))
    if owner is None:
        raise HTTPException(503, "No owner yet: run python -m cadent_api.create_owner.")
    return owner
