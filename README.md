# Cadent

A personal running coach for a half-marathon build (Toronto, May 2, 2027). Each morning it shows
today's planned run, compares the week with what Garmin recorded, and flags anything in the plan
that breaks an injury-prevention rule.

> Status: early. Building the core loop: Today → Garmin sync → Week → Plan check.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · SQLite · Python (Garmin sync) · Docker ·
Tailscale · GitHub Actions

Why each piece is here: [DECISIONS.md](DECISIONS.md). Design rules: [DESIGN.md](DESIGN.md).

## Run it

```bash
pnpm install
pnpm dev
```

On the home server: [docs/home-server.md](docs/home-server.md).

## How I build it

I build Cadent with Claude Code as a pair programmer. Each feature starts as a GitHub issue,
gets planned in plan mode, and is built on a branch with tests. Before a PR, Claude runs
`/simplify` and `/code-review` on the change; CI runs lint, types and tests; I read the diff and
merge. [CLAUDE.md](CLAUDE.md) holds the project rules Claude follows.

## Disclaimer

Cadent is a planning aid, not medical advice.
