# Plan import + audit

Step 1 (see docs/roadmap.md). Outcome: Joey uploads the Toronto Half plan as `cadent.plan/v1` JSON,
sees every Finding the rules engine reports, accepts them, and activates the plan.

## Goal

The first real plan source. A plan file is checked against the `cadent.plan/v1` format, converted to
metres and seconds, run through `cadent_core.rules.validate` (ADR 007), and saved as a `draft` Plan
with its Findings. It can only become `active` once every Finding is accepted: Warnings with one
click each, Errors with a typed confirmation. Saved plans never change on their own.

The 4 MVP safety rules (`LONG_RUN_CAP`, `WEEKLY_JUMP`, `NO_REST_DAY`, `TAPER_MISSING`) are built
separately with `/add-safety-rule`; import picks them up through `RULES` with no change here.

## Files and interfaces

**Format (api):** `api/src/cadent_api/plan_format.py`

- Pydantic models for `cadent.plan/v1`, matching the Project Spec's "Plans & safety" example:
  `schema`, `name`, `race` (`date`, `distance_m`, `goal_time_s`), `zones`, `settings`, `weeks[]`
  (`index`, `start`, `phase`, `cutback`, `sessions[]`).
- A session is `kind: "run"` or `kind: "lift"` (discriminated union).
  A run needs `date`, `type` (a `RunType` value) and `distance_m`; `zone`, `pace_s_per_km`,
  `duration_s`, `extras` and `blocks` are optional and kept only where the `sessions` table has a
  column (`hr_zone`, `pace_min_s`, `pace_max_s`, `notes` for anything else, written as text).
- `schema` must be exactly `cadent.plan/v1`. Unknown fields are rejected (`extra="forbid"`).
- `to_runs(plan) -> list[Run]` converts run sessions to `cadent_core.models.Run`. Lift sessions
  are counted and skipped.

**Import and audit (api):** `api/src/cadent_api/plans.py`, an `APIRouter` mounted in `main.py`

- `POST /plans/import`: body is the plan JSON. Validates the format (422 with field errors if not),
  loads History (completed runs from `activities` before the first session's date; empty until Garmin
  sync exists), runs `validate`, then saves in one transaction: `plans` (`source="imported"`,
  `status="draft"`), `plan_weeks`, `sessions`, `rule_findings`. Returns
  `{plan_id, findings, skipped_lifts}`.
- `GET /plans/{plan_id}`: the plan with its weeks, sessions and findings (the audit report).
- `POST /plans/{plan_id}/findings/{finding_id}/accept`: body `{"confirm": "<rule code>"}` for an
  Error (must equal the Finding's code), empty for a Warning. Sets `accepted = true`.
- `POST /plans/{plan_id}/activate`: 409 while any Finding is not accepted. Otherwise archives the
  current `active` plan (if any) and sets this one `active`, in one transaction.
- Every query filters by the current user's `user_id`; another user's plan answers 404.

**Current user (api):** `api/src/cadent_api/users.py`

- `current_user` dependency: returns the single `owner` user. Replaced by real login in step 4.
- `python -m cadent_api.create_owner --email <email> --timezone <tz>`: creates the owner with an
  unusable `password_hash` (login sets it later). Refuses if an owner already exists.

**Wiring:** `api/pyproject.toml` adds `cadent-db` (workspace member, no new third-party package);
`api/src/cadent_api/db.py` gives a request-scoped SQLAlchemy `Session` from `DATABASE_URL`.

**Web:** `web/src/ImportPlan.tsx`, shown by `App.tsx` when there is no active plan

- Pick a `.json` file, upload it, then a list of Findings grouped by week, Errors first.
- Each Warning has an Accept button; each Error has a text field that must match its code.
- Activate is disabled until every Finding is accepted. Format errors from a 422 show by field.
- Phone width first; tokens only (DESIGN.md). No router: `App.tsx` switches on state.

**Fixture:** `core/tests/fixtures/golden/toronto-half.json`, made with `/plan-fixture` from the
"Toronto Half Marathon Plan" doc (weeks 16-43, run types per Decisions below). Golden fixtures are
protected: Claude drafts `core/tests/fixtures/toronto-half.draft.json` and Joey copies it in by hand.

**Docs:** `docs/glossary.md` gains a "Quality session" row (see Decisions).

## Out of scope

- CSV import (after the MVP).
- Storing lifts (accepted in the file, skipped on save; a table comes later).
- Login, signup and passwords (step 4). Multiple users beyond the per-user query filter.
- Editing a plan in the app. Re-importing replaces nothing: it creates another draft.
- The 4 MVP rules themselves (separate `/add-safety-rule` runs) and the other 5 rules (step 6).
- Plan generator and AI drafts (after the roadmap).
- Runs that target only time (`duration_s` with no `distance_m`): rejected with a 422 for now,
  since `sessions.distance_m` is required and every rule works on distance.

## Acceptance

- [ ] The Toronto Half golden fixture parses, converts to `Run`s and validates with zero Errors, with
      Week 15 as planned as History (7 km easy on 2026-10-13, 14 km long on 2026-10-17). Until the
      golden copy exists, the test reads the draft.
- [ ] A file with `schema` other than `cadent.plan/v1`, an unknown field, a negative distance, a
      `type` outside `RunType`, or a run with no `distance_m` is rejected with 422 and nothing is saved.
- [ ] Lift sessions are accepted, not saved, and counted in `skipped_lifts`.
- [ ] Import saves one `draft` plan, its weeks, its run sessions and exactly the Findings `validate`
      returned, with each Finding's `week_index` set from the week containing its day.
- [ ] A plan with an unaccepted Finding cannot be activated (409).
- [ ] Accepting an Error with the wrong confirmation text fails (422); with its code, it succeeds.
- [ ] Activating archives the previous active plan; there is never more than one active plan.
- [ ] Another user's plan returns 404 on every `/plans` endpoint.
- [ ] `create_owner` creates one owner and refuses a second.
- [ ] Web: Activate stays disabled until every Finding is accepted (Vitest).
- [ ] Web: a 422 shows the failing field (Vitest).

## End-to-end check

1. `make up`, then `docker compose exec api python -m cadent_api.create_owner --email ... --timezone America/Toronto`.
2. Open the app at phone width: the Import screen shows because there is no active plan.
3. Upload `toronto-half.json`. The audit lists the Findings by week (expect one `LONG_RUN_SPIKE`
   Error on the first long run, Oct 24: with no History before Garmin sync, the 15 km long run is
   compared with that week's 8 km maximum).
4. Accept each Finding, press Activate. The app moves on to the "Good morning" shell.
5. Upload the same file again: a second draft appears; activating it archives the first.

## Decisions

- **Run types in the Toronto plan** (for `/plan-fixture`): "ST" reps and "@ HM pace" work →
  `tempo`; the 5K and 10K time trials → `race`; long runs with a steady or HM-pace finish → `long`;
  "E + strides" and "E + 4 × 20 s" → `easy` (strides never change a run's type, they go in
  `extras`); the race-week "3 km Z1 shakeout" → `shakeout`; the Toronto Half itself → `race`.
- **Quality session** is a group, not a `RunType`: `tempo`, `intervals` and `race`. Add it to
  `docs/glossary.md` in this change. No change to `RunType` or the database.
- **Whole plan imported.** Weeks 16-43 go in as written, past weeks included, so the rules see the
  earlier weeks as context and the golden fixture stays a faithful copy. Findings on past days are
  accepted once, like any other.
- **Single-owner `current_user` needs no ADR.** It is temporary and goes away with login in step 4;
  login gets its own spec and ADR then.

## Open questions

None.
