# ADR 012: Database models and migrations in a db/ workspace package

Status: Proposed (2026-10-20)

## Context

The schema needs a home. The API and the sync worker both use it (ADR 004: the worker is the API image
with another command), and core must never touch it (ADR 008).

## Decision

A new uv workspace member `db/` (package `cadent_db`) holds the SQLAlchemy 2.0 models, the engine
factory and Alembic migrations in `db/migrations/`. Access is sync SQLAlchemy with psycopg 3. Primary
keys are UUIDs generated in Python, and every user-owned table, child tables included, carries
`user_id`. import-linter forbids `cadent_core` from importing `cadent_db`.

## Alternatives considered

Models inside `api/` (the worker would then import the API package); async SQLAlchemy (async in every
query, the worker and the tests, for no gain at a few users); bigint identity keys (sequential IDs leak
counts and are guessable in URLs and MCP tool results).

## Consequences

Matches the Project Spec's repo layout and the migration hook's `db/migrations/versions/` path. One more
package to configure in pyright, pytest, vulture and import-linter. The Postgres tests need Docker for
`make check`, locally and in CI.
