---
name: add-migration
description: Change the database: SQLAlchemy model, Alembic migration and a round-trip test. Use for any schema change.
---
# Add a migration

A migration that is already committed is never edited (the PreToolUse hook blocks it). Fix forward with a new one.

0. If SQLAlchemy, Alembic or Testcontainers are not yet in `pyproject.toml`, ask Joey before adding them (CLAUDE.md: no new dependency without asking).
1. Check the change against the Data model table in the spec's "Stack & data" tab. A new table or column outside it needs Joey's approval.
2. Change the SQLAlchemy model:
   - every user-owned table has `user_id`, and every query on it filters by `user_id`;
   - units are SI and named in the column (`distance_m`, `duration_s`);
   - synced rows stay unique on (user_id, provider, source_id) so upserts are idempotent.
3. Generate the migration with `uv run alembic revision --autogenerate -m "<what changed>"`.
   Read it: check the upgrade and downgrade both match the model change and nothing else.
4. Add a round-trip test on real Postgres (Testcontainers): upgrade to head, downgrade one step, upgrade again,
   and assert the changed table or column exists with the right type.
5. Run `make check`. All green.
6. Ask the `code-reviewer` subagent to review the diff.
