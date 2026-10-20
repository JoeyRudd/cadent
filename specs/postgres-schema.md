# Postgres schema + Alembic

Week 2 (see docs/roadmap.md). Outcome: the whole data model exists as SQLAlchemy models and one
Alembic migration that upgrades and downgrades cleanly on real Postgres 16.

## Goal

Give the sync worker, the plan import and every later feature a schema to write to. All tables
from the Project Spec's "Stack & data" tab are created now, adjusted to the glossary and ADR 009.
No queries, endpoints or worker code: just models, migrations and the round-trip test.

## Files and interfaces

New workspace member `db/` (package `cadent_db`), proposed in ADR 012:

- `db/pyproject.toml`: package `cadent-db`; added to `[tool.uv.workspace] members` and the dev group.
- `db/src/cadent_db/models.py`: SQLAlchemy 2.0 typed declarative models (`Mapped[...]`), one class per table.
- `db/alembic.ini`, `db/migrations/env.py`, `db/migrations/versions/0001_initial_schema.py`.
  `env.py` reads `DATABASE_URL` and uses `cadent_db.models.Base.metadata`.
- `db/tests/test_migrations.py`: the round-trip test (Testcontainers, `postgres:16-alpine`, same as docker-compose).
- Root `pyproject.toml`: `db/src` and `db/tests` in pyright `extraPaths`/`include`, `db/tests` in pytest `testpaths`,
  `cadent_db` in import-linter `root_packages` and in core's forbidden modules, `db/src` in vulture paths.
- `docs/patterns.md`: add the "A table" row (exemplar `Activity` in `db/src/cadent_db/models.py`).
- `docker-compose.yml`: `DATABASE_URL` becomes `postgresql+psycopg://...`; `db` publishes `127.0.0.1:5432`.
- `api/Dockerfile`: copies `db/` (uv needs every workspace member present).

Conventions for every table:

- Primary key `id uuid`, generated in Python (`uuid.uuid4`).
- Every table has `user_id uuid not null` → `users.id` `on delete cascade`, child tables too, so every
  query can filter by `user_id` directly. (`users` itself and `oauth_clients` are the exceptions.)
- Timestamps are `timestamptz`; local calendar days are `date`.
- SI units named in the column: `distance_m`, `duration_s`, `pace_min_s` (seconds per km).
- `created_at timestamptz not null default now()` on every table.

Tables (15):

| Table | Columns (besides `id`, `user_id`, `created_at`) | Constraints |
| --- | --- | --- |
| `users` | email (stored lowercase), password_hash, timezone (IANA name), role (`owner`/`user`) | unique `email`; check `email = lower(email)`; no `user_id` |
| `user_profiles` | birth_year, sex, max_hr, resting_hr, units (`metric`/`imperial`), intake_completed_at | unique `user_id` |
| `data_source_accounts` | provider (`garmin`), encrypted_tokens (bytea), status (`active`/`needs_reauth`/`disabled`), last_sync_at, last_error | unique (`user_id`, `provider`) |
| `activities` | data_source_account_id, provider, source_id, started_at, local_date, type, distance_m, duration_s, moving_s, avg_hr, max_hr, avg_cadence, elevation_gain_m, raw (jsonb) | unique (`user_id`, `provider`, `source_id`); index (`user_id`, `local_date`) |
| `activity_laps` | activity_id, index, distance_m, duration_s, avg_hr, avg_pace_s_per_km | unique (`activity_id`, `index`) |
| `daily_recovery` | date, hrv_overnight_ms, hrv_status, sleep_s, sleep_score, resting_hr, body_battery | unique (`user_id`, `date`) |
| `plans` | name, race_date, race_distance_m, source (`imported`/`generated`/`ai_draft`), status (`draft`/`active`/`archived`), accepted_warnings (jsonb) | partial unique (`user_id`) where `status = 'active'` |
| `plan_weeks` | plan_id, index, phase, is_cutback, target_distance_m | unique (`plan_id`, `index`) |
| `sessions` | plan_week_id, date, type (`RunType` values), distance_m, pace_min_s, pace_max_s, hr_zone, notes | index (`user_id`, `date`) |
| `run_matches` | session_id, activity_id, match_method (`auto`/`manual`) | unique `session_id`; unique `activity_id` |
| `checkins` | activity_id, rpe, soreness (0-10), pain_flag, pain_location, notes | unique `activity_id`; check `rpe` 1-10 and `soreness` 0-10 |
| `rule_findings` | plan_id, week_index, rule_code, severity (`warning`/`error`), day, message, accepted | index `plan_id` |
| `oauth_clients` | client_id, redirect_uris (text[]), metadata (jsonb) | unique `client_id`; no `user_id` (clients register before sign-in) |
| `oauth_codes` | code_hash, client_id, redirect_uri, code_challenge, scopes, resource, expires_at, used_at | unique `code_hash` |
| `oauth_tokens` | token_hash, kind (`access`/`refresh`), client_id, scopes, resource, expires_at, revoked_at | unique `token_hash` |

Name changes from the Project Spec: `planned_runs` → `sessions` (glossary), `run_matches.planned_run_id`
→ `session_id`, `activities.provider` added (the unique key already needs it), `activities.local_date` added,
`oauth_codes` added and OAuth codes/tokens stored hashed (ADR 009). I update the Project Spec doc to match
once this spec is approved.

Dependencies (added with Joey's go-ahead to use judgement, 2026-10-20): `sqlalchemy>=2.0.36`, `alembic>=1.14`,
`psycopg[binary]>=3.2` in `db/`; `testcontainers[postgres]>=4.8` in the dev group.

## Out of scope

- Queries, repositories, API endpoints, the sync worker, plan import (separate week-2 specs).
- The OAuth provider code and the login page (week 6); only its tables are here.
- Token encryption code and its key; `encrypted_tokens` is only a `bytea` column.
- The derived-metrics materialised view.
- Lift sessions: `sessions.type` uses `RunType` only.
- Seeding data or a `worker` service in docker-compose.

## Acceptance

- [ ] `alembic upgrade head` on an empty Postgres 16 creates exactly the 15 tables above.
- [ ] Round trip: upgrade head → downgrade base → upgrade head succeeds, and after it each table exists
      with the listed columns and their types (checked through SQLAlchemy's inspector).
- [ ] `alembic check` reports no difference between the models and the migrated database.
- [ ] Inserting the same (`user_id`, `provider`, `source_id`) activity twice raises `IntegrityError`.
- [ ] A second `active` plan for one user raises `IntegrityError`; a second `draft` plan does not.
- [ ] Every table except `users` and `oauth_clients` has a non-null `user_id` foreign key to `users.id`
      (one test that walks `Base.metadata`, so a new table without it fails).
- [ ] Deleting a user removes their rows from every table (cascade).
- [ ] import-linter: `cadent_core` cannot import `cadent_db` or `sqlalchemy`.
- [ ] The Postgres tests fail, not skip, when Docker isn't available.
- [ ] `make check` passes.

## End-to-end check

```bash
docker compose up -d db
DATABASE_URL=postgresql+psycopg://cadent:$POSTGRES_PASSWORD@localhost:5432/cadent uv run alembic -c db/alembic.ini upgrade head
docker compose exec db psql -U cadent -c '\dt'
```

Joey sees the 15 tables plus `alembic_version`.

## Open questions

- **ADR 012** is still Proposed: models and migrations in a new `db/` workspace member. Built on this
  branch; Joey accepts it at merge.

Decided by Claude when Joey asked it to use its judgement (2026-10-20), and easy to reverse before merge:

- Enum-like columns are `text` with a `CHECK` constraint, not native Postgres enums, because later
  migrations can change them more easily.
- `rule_findings` is stored per plan for now; plan versions come with plan import (week 3).
- `db` publishes `127.0.0.1:5432` in docker-compose (only reachable from the host itself) so `alembic`
  runs from the host.
