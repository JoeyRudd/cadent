# Running Cadent on the home server

One Docker container runs the app and the Garmin sync. Tailscale gives the phone private HTTPS;
nothing is exposed to the internet.

1. **Install Docker and Tailscale** on the home PC ([Docker](https://docs.docker.com/engine/install/),
   [Tailscale](https://tailscale.com/download)), then `sudo tailscale up` and sign in.
   On Windows use Docker Desktop and run the commands below in WSL or PowerShell.

2. **Clone and configure:**

   ```bash
   git clone https://github.com/JoeyRudd/cadent.git && cd cadent
   cp .env.example .env   # fill in GARMIN_EMAIL and GARMIN_PASSWORD
   ```

   Leave `CADENT_DB` and `GARMINTOKENS` empty: they default to `/app/data/cadent.db` and
   `/app/data/garmin-tokens` on the `cadent-data` volume, so they survive rebuilds.

3. **Start it:**

   ```bash
   docker compose up -d --build
   ```

   The app is now on `http://localhost:3000` and restarts with the machine.

4. **HTTPS on the tailnet:**

   ```bash
   sudo tailscale serve --bg 3000
   ```

   Open `https://<machine-name>.<tailnet>.ts.net` on the phone (`tailscale serve status` prints it).

5. **First sync, by hand** (Garmin may ask for an MFA code once; the token is then saved on the volume):

   ```bash
   docker compose exec cadent uv run --no-dev --project sync python sync/cadent_sync.py
   ```

6. **Sync hourly from 6am to noon** with host cron (`crontab -e`; adjust the path). Later runs
   pick up the overnight data the watch uploads after 6am:

   ```cron
   0 6-12 * * * cd /home/joey/cadent && docker compose exec -T cadent uv run --no-dev --project sync python sync/cadent_sync.py >> sync.log 2>&1
   ```

   Cron uses the host's clock, so the host must be on Toronto time. On Windows, use Task Scheduler
   with the same `docker compose exec -T ...` command: start at 6am, repeat hourly for 7 hours.

7. **Back up** the database (not between 6am and noon, while a sync may be running):

   ```bash
   docker compose cp cadent:/app/data/cadent.db ./cadent-$(date +%F).db
   ```

8. **Update** to the latest code:

   ```bash
   git pull && docker compose up -d --build
   ```
