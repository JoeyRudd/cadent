# Cadent

Self-hosted running coach: Garmin sync, a deterministic plan-safety engine, a mobile PWA, and an
MCP server so users analyse their data with their own AI. No LLM calls at runtime.

**Start here:** `docs/roadmap.md` has the December plan, current status and the next task.

## Setup

`uv sync` and `cd web && pnpm install`. Then `make check` should pass. Versions are pinned: Python in
`.python-version`, Node in `web/.nvmrc`, pnpm in `web/package.json` (`corepack enable pnpm` picks it up).

## Commands

- `make check`: every gate (format, lint, strict types, import contracts, dead code, tests). Must pass before you stop.
- `make test-core`: rules-engine tests only (fast).
- `make dev`: API with reload plus the web dev server.
- `make fmt`: auto-format Python.
- Web (in `web/`): `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Layout

- `core/`: pure domain logic. NO I/O: no database, network, files or clock (pass dates in). Enforced by import-linter.
- `api/`: FastAPI. Later: `/mcp` endpoint and OAuth.
- `web/`: Vite + React + TypeScript strict + Tailwind. Tokens live in `web/src/tokens.css`.
- `docs/decisions/`: ADRs. `docs/patterns.md`: how we do things. `docs/glossary.md`: one name per concept.
- `specs/`: one spec per feature, written before building it.

## Rules (IMPORTANT)

- Never weaken, skip, delete or loosen a test in `core/tests/` to make something pass. Those tests are the spec; if one seems wrong, stop and ask.
- Every plan source (import, generator, AI draft) goes through `cadent_core.rules.validate`. Never bypass it.
- New safety rules are written test-first: examples, then a property test, then the code (`/add-safety-rule`).
- Minimum code that solves the task. No abstractions for single-use code. Check the codebase, stdlib and existing dependencies before writing anything new.
- No new dependency without asking first.
- Do not edit, reformat or "improve" code outside the task. Mention unrelated dead code instead of deleting it.
- New code must look like the code around it and use the names in `docs/glossary.md`.
- A new structural choice needs an ADR in `docs/decisions/`, approved by Joey. Propose it; never assume it.
- Merging (ADR 011): CI auto-merges a PR that only touches low-risk paths once the Claude review is clean.
  Joey merges rules, protected tests, workflows and `.claude/` changes. Never run `gh pr merge` yourself.
- Units: metres and seconds everywhere; format only at the edge.
- UI: every colour, radius and font comes from a token. No raw hex values or arbitrary Tailwind values (lint enforces it).
