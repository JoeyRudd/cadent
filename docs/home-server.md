# Running Cadent on the home server

One Docker container runs the app and the Garmin sync. Tailscale gives the phone private HTTPS;
nothing is exposed to the internet, unless you turn on the Claude connector (step 9), which opens
only its own paths.

1. **Install Docker and Tailscale** on the home PC ([Docker](https://docs.docker.com/engine/install/),
   [Tailscale](https://tailscale.com/download)), then `sudo tailscale up` and sign in.
   On Windows use Docker Desktop and run the commands below in WSL or PowerShell.

2. **Clone and configure:**

   ```bash
   git clone https://github.com/JoeyRudd/cadent.git && cd cadent
   cp .env.example .env   # set CADENT_OWNER to your Tailscale login
   ```

   Leave `CADENT_DB` and `GARMINTOKENS` empty: they default to `/app/data/cadent.db` and
   `/app/data/garmin-tokens` on the `cadent-data` volume, so they survive rebuilds.

3. **Start it:**

   ```bash
   docker compose up -d --build
   ```

   The app is now on `http://localhost:3000` (this machine only) and restarts with the machine.

4. **HTTPS on the tailnet:**

   ```bash
   sudo tailscale serve --bg 3000
   ```

   Open `https://<machine-name>.<tailnet>.ts.net` on the phone (`tailscale serve status` prints it).

5. **Connect Garmin** on the phone: Settings › Garmin, sign in, and enter Garmin's code if it asks.
   Only Garmin's token is saved, on the volume; the password isn't kept anywhere. Then tap Sync
   on Today for the first pull.

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

9. **Connect Claude (optional).** Claude reads your plan, runs and sleep, and can move runs or change
   their distance, using your own Claude plan. Claude.ai calls Cadent from Anthropic's servers, so the
   connector's paths go on the internet through [Tailscale Funnel](https://tailscale.com/kb/1223/funnel)
   on port 8443. The rest of the app stays tailnet-only on 443, and you approve Claude on the tailnet.

   Turn on Funnel for the tailnet in the Tailscale admin console (it asks the first time), then:

   ```bash
   sudo tailscale funnel --bg --https=8443 --set-path=/mcp http://127.0.0.1:3000/mcp
   sudo tailscale funnel --bg --https=8443 --set-path=/oauth http://127.0.0.1:3000/oauth
   sudo tailscale funnel --bg --https=8443 --set-path=/.well-known/oauth-protected-resource http://127.0.0.1:3000/.well-known/oauth-protected-resource
   sudo tailscale funnel --bg --https=8443 --set-path=/.well-known/oauth-authorization-server http://127.0.0.1:3000/.well-known/oauth-authorization-server
   ```

   In `.env`, set `CADENT_URL=https://<machine-name>.<tailnet>.ts.net` and
   `CADENT_PUBLIC_URL=https://<machine-name>.<tailnet>.ts.net:8443`, then `docker compose up -d`.
   Check from a phone off Wi-Fi with Tailscale off: the first should print JSON and the second should not load.

   ```bash
   curl https://<machine-name>.<tailnet>.ts.net:8443/.well-known/oauth-protected-resource
   curl https://<machine-name>.<tailnet>.ts.net:8443/
   ```

   In Claude (claude.ai › Settings › Connectors › Add custom connector), add
   `https://<machine-name>.<tailnet>.ts.net:8443/mcp`. Claude opens Cadent's Connect page: allow it
   from a device on the tailnet. Settings › Claude in Cadent shows the connection and disconnects it.
   To close the paths again: `sudo tailscale funnel --https=8443 off`.
