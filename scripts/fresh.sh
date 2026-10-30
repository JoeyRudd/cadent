#!/bin/sh
# Stops whatever is serving the dev ports 3000–3009 (old Cadent servers, other dev servers), then starts
# Cadent and opens it in the browser once it answers. Run with `pnpm fresh`; Ctrl-C stops the server.

set -e
cd "$(dirname "$0")/.."

pids=$(lsof -tiTCP:3000-3009 -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "Stopping dev servers: $(echo "$pids" | tr '\n' ' ')"
  kill $pids 2>/dev/null || true
  sleep 1
fi

# Opens the browser in the background once the server is up (macOS `open`).
(until curl -s -o /dev/null http://localhost:3000; do sleep 0.5; done; open http://localhost:3000) &

exec pnpm dev
