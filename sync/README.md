# Garmin sync

Pulls recent runs (running, treadmill and trail) from Garmin Connect into the `activities` table
of Cadent's SQLite database, and the last 8 nights of HRV, sleep and resting heart rate into the
`wellness` table. Safe to re-run: rows are upserted by Garmin activity id and by date.

```bash
GARMIN_EMAIL=... GARMIN_PASSWORD=... uv run --project sync python sync/cadent_sync.py --days 14
```

| Env var | Default | |
| --- | --- | --- |
| `GARMIN_EMAIL`, `GARMIN_PASSWORD` | | Only needed when there are no saved tokens. |
| `GARMINTOKENS` | `~/.garminconnect` | Where Garmin's login tokens are saved and reused. |
| `CADENT_DB` | `data/cadent.db` | SQLite file to write. |

Tests and lint:

```bash
uv run --project sync pytest sync
uv run --project sync ruff check sync
```
