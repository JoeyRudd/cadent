# Patterns

One way to do each common thing. Copy the exemplar; don't invent a variant.

| Need | How | Exemplar |
| --- | --- | --- |
| A safety rule | One module per rule with a `check(plan, history)` generator, registered in `RULES` | `core/src/cadent_core/rules/long_run_spike.py` |
| A domain type | Frozen, slotted dataclass in `core/models.py`; SI units in field names | `Run` in `core/src/cadent_core/models.py` |
| An API endpoint | Typed FastAPI function returning a typed value | `health` in `api/src/cadent_api/main.py` |
| Logging | `structlog` with an event name like `area.event` and key-value fields | `api.started` in `api/src/cadent_api/main.py` |
| A UI colour, radius or font | A token in `web/src/tokens.css`, used through its Tailwind name | `bg-accent-soft` in `web/src/App.tsx` |
| A table | Typed model in `db/src/cadent_db/models.py` with `UserOwned`; enum-like columns use `one_of`; then `alembic revision --autogenerate` (`/add-migration`) | `Activity` in `db/src/cadent_db/models.py` |
| A test | Plain pytest functions named for the behaviour they prove | `core/tests/test_rules.py` |

Patterns for queries, errors, forms and the MCP tools are added the first time each is built.
