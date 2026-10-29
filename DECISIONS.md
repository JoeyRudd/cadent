# Decisions

One line per choice that isn't obvious. Newest last.

- **Restarted from scratch.** v1 ([cadent-v1](https://github.com/JoeyRudd/cadent-v1)) spent its effort on process and infrastructure before any feature shipped. This version builds the core loop first.
- **Next.js full stack.** One TypeScript app for pages and data; no separate API server.
- **Python only for Garmin sync.** `garminconnect` is the best-maintained Garmin library, so a small script run by cron pulls activities into the database.
- **SQLite.** One user, one file, nothing to run or back up beyond copying it.
- **Hosted at home behind Tailscale.** Private HTTPS to my phone, nothing exposed to the internet, so no login.
- **Plan is a JSON file.** Edit `data/plan.json` and redeploy; no import screen until someone else uses the app.
- **Runs record moving time.** The sync stores Garmin's moving duration (elapsed only if moving is missing), so stops at lights don't slow the pace.
- **Sync runs inside the app container, scheduled by host cron.** One image (Node + uv) and a `docker compose exec` line at 6am; no scheduler process to keep alive.
- **Check-ins are the first write path.** A server action upserts one row per day into a `checkins` table in the same SQLite file the sync writes. The sync never touches that table, and both sides wait up to 5 s for the other's brief write lock instead of failing.
