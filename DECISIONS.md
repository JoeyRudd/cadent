# Decisions

One line per choice that isn't obvious. Newest last.

- **Restarted from scratch.** v1 ([cadent-v1](https://github.com/JoeyRudd/cadent-v1)) spent its effort on process and infrastructure before any feature shipped. This version builds the core loop first.
- **Next.js full stack.** One TypeScript app for pages and data; no separate API server.
- **Python only for Garmin sync.** `garminconnect` is the best-maintained Garmin library, so a small script run by cron pulls activities into the database.
- **SQLite.** One user, one file, nothing to run or back up beyond copying it.
- **Hosted at home behind Tailscale.** Private HTTPS to my phone, nothing exposed to the internet, so no login.
- **Plan is a JSON file.** Edit `data/plan.json` and redeploy; no import screen until someone else uses the app.
