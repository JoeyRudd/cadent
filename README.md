# Cadent

A self-hosted running coach that keeps your training steady. Cadent syncs your Garmin data, shows
today's planned run each morning, compares every run to the plan, and checks every plan against
injury-prevention rules before you follow it. AI analysis is optional and runs on **your own** AI
subscription through an MCP server: the app itself makes no AI calls and costs nothing to run beyond hosting.

> Status: week 1 of 8. Built in the open toward a December 2026 release, and used daily for a
> half-marathon build (Toronto, May 2, 2027).

## Why it's built this way

- **Plans are checked, never trusted.** One deterministic rules engine validates every plan,
  whether imported, generated or drafted by an AI. Rules are written test-first, with
  property-based tests, and real training plans as golden fixtures.
- **Plans stay consistent.** The app warns; it never edits your plan on its own.
- **AI on your terms.** An OAuth-protected MCP server exposes read-only tools, so Claude,
  ChatGPT or any MCP client can analyse your data without the app paying for tokens.
- **Boring, fast stack.** Python/FastAPI, Postgres, a static React app, Docker Compose. See
  [the decisions](docs/decisions/) for the reasoning behind each choice.

## Stack

Python 3.12 · FastAPI · Pydantic · SQLAlchemy · PostgreSQL · TypeScript · React · Vite ·
Tailwind · Docker Compose · Caddy · GitHub Actions · pytest + Hypothesis · Vitest · Playwright

## Quality gates

Every change passes `make check`, enforced locally by pre-commit and a Claude Code Stop hook, and in CI:

| Gate | Tool |
| --- | --- |
| Format and lint | Ruff, ESLint |
| Strict types | Pyright (strict), TypeScript (strict) |
| Architecture | import-linter: `core` never imports I/O |
| Dead code | vulture, knip |
| Duplication | jscpd |
| Tests | pytest, Hypothesis, Vitest, 90% branch coverage on `core` |
| Protected safety tests | test-count floor, no skips, CODEOWNERS |

AI review runs after the deterministic gates and is advisory only.

## Run it

```bash
cp .env.example .env      # set a password and your domain
make up                   # builds the web app and starts db, api and Caddy
```

Development: `uv sync`, `cd web && pnpm install`, then `make dev`.

## Project layout

```
core/    pure domain logic: rules engine, metrics (no I/O)
api/     FastAPI: REST, later MCP and OAuth
web/     Vite + React PWA
docs/    decisions (ADRs), patterns, glossary
specs/   one spec per feature
```

## Disclaimer

Cadent is a planning tool, not medical advice. See a doctor before starting a new training
program, and stop if something hurts.

## License

MIT
