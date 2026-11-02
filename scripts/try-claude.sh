#!/bin/sh
# Tries the Claude connector on this machine with Claude Code, on your own Claude plan: starts Cadent
# with the connector on, adds it to Claude Code once (as cadent-dev), then opens Claude Code. Run with
# `pnpm try-claude`; quitting Claude Code stops the server.

set -e
cd "$(dirname "$0")/.."

URL=http://localhost:3000

pids=$(lsof -tiTCP:3000-3009 -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "Stopping dev servers: $(echo "$pids" | tr '\n' ' ')"
  kill $pids 2>/dev/null || true
  sleep 1
fi

# iCloud's "name 2.js" copies in the build folder make next dev rebuild and reload forever.
[ -d .next ] && find .next -name "* [0-9].*" -delete

mkdir -p .next
CADENT_URL=$URL CADENT_PUBLIC_URL=$URL pnpm dev > .next/try-claude.log 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT INT TERM

echo "Starting Cadent (log: .next/try-claude.log)..."
until curl -s -o /dev/null "$URL/.well-known/oauth-protected-resource"; do sleep 0.5; done

claude mcp get cadent-dev > /dev/null 2>&1 || claude mcp add --transport http cadent-dev "$URL/mcp"

echo
echo "In Claude Code: type /mcp, pick cadent-dev, choose Authenticate, then Allow Claude in the browser."
echo "Then ask something like: Using Cadent, how did my last run go?"
echo
claude
