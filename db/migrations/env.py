"""Alembic environment: migrates the database at DATABASE_URL to match cadent_db.models."""

import os

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from cadent_db.models import Base

url = context.config.get_main_option("sqlalchemy.url") or os.environ["DATABASE_URL"]

with create_engine(url, poolclass=NullPool).connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()
