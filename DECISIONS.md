# Decisions

One line per choice that isn't obvious. Newest last.

- **Restarted from scratch.** v1 ([cadent-v1](https://github.com/JoeyRudd/cadent-v1)) spent its effort on process and infrastructure before any feature shipped. This version builds the core loop first.
- **Next.js full stack.** One TypeScript app for pages and data; no separate API server.
- **Python only for Garmin sync.** `garminconnect` is the best-maintained Garmin library, so a small script run by cron pulls activities into the database.
- **SQLite.** One user, one file, nothing to run or back up beyond copying it.
- **Hosted at home behind Tailscale.** Private HTTPS to my phone, nothing exposed to the internet, so no login.
- **Plan is a JSON file.** Edit `data/plan.json` and redeploy; no import screen until someone else uses the app.
- **Runs record moving time.** The sync stores Garmin's moving duration (elapsed only if moving is missing), so stops at lights don't slow the pace.
- **Sync runs inside the app container, scheduled by host cron.** One image (Node + uv) and a `docker compose exec` cron line; no scheduler process to keep alive.
- **Sync hourly from 6am to noon.** The watch uploads overnight data whenever the phone next syncs, so one 6am run often missed it. Each run is a full sync (about 25 Garmin requests); a wellness-only flag would save just the one activities request, and the full run also picks up a morning run.
- **Container clock is America/Toronto.** `TZ` in `docker-compose.yml` matches `TIME_ZONE` in `src/lib/plan.ts`, so the sync's `date.today()` is the app's today.
- **Check-ins are the first write path.** A server action upserts one row per day into a `checkins` table in the same SQLite file the sync writes. The sync never touches that table, and both sides wait up to 5 s for the other's brief write lock instead of failing.
- **Appearance choice lives in the browser (localStorage), not a cookie.** A cookie read in the root layout would make every page dynamic under Cache Components; an inline script sets `data-theme` before paint instead. It is per device, which suits one user with one phone.
- **Garmin is connected in Settings, and its password is never stored.** Garmin has no sign-in API for personal apps, so Settings takes the email and password once and pipes them to `cadent_sync.py --connect` on stdin (not argv or env, which other processes can read). Only Garmin's token is saved (owner-only file); syncs use it and never fall back to a password. The app still has no login, but connect and disconnect accept only the `CADENT_OWNER` Tailscale login from `tailscale serve`'s identity header, and the container port is bound to localhost so the header can't be forged by skipping Tailscale.
- **Moved runs live in the database, not plan.json.** A `moves` table maps a run's planned date to its new day, within the same week; pages read the plan through `withMoves`. plan.json stays the coach's plan, a move is undone by deleting its row, and a run recorded on a day with nothing planned still counts as a bonus run.
- **Recent runs are per day, like run detail.** Two runs on one day are one row, and every run link is `/run/<date>`; a day before the plan starts shows no status pill because there is nothing to compare it with.
