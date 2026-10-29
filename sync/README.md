# Garmin sync

Pulls recent runs (running, treadmill and trail) from Garmin Connect into the `activities` table
of Cadent's SQLite database, and the last 8 nights of HRV, sleep and resting heart rate into the
`wellness` table. Safe to re-run: rows are upserted by Garmin activity id and by date.

```bash
uv run --project sync python sync/cadent_sync.py --days 14
```

It signs in with the token saved when Garmin was connected in the app's Settings, which runs
`--connect` (email and password on stdin, never stored); Disconnect runs `--disconnect`. With no
usable token a sync exits with code 3.

| Env var | Default | |
| --- | --- | --- |
| `GARMINTOKENS` | `~/.garminconnect` | Where Garmin's login token (and the account name) is saved and reused. |
| `CADENT_DB` | `data/cadent.db` | SQLite file to write. |

Tests and lint:

```bash
uv run --project sync pytest sync
uv run --project sync ruff check sync
```
