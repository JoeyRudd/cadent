# Cadent

Personal running coach: shows today's planned run, compares the week with Garmin data, and checks
the plan against safety rules. Next.js (App Router) + TypeScript + Tailwind; a small Python script
syncs Garmin. One user, hosted at home.

@AGENTS.md

## Commands

- `pnpm dev`: run the app.
- `pnpm fresh`: stop anything on ports 3000–3009, start the app and open it in the browser.
- `pnpm try-claude`: start the app with the Claude connector on and open Claude Code connected to it.
- `pnpm check`: lint + typecheck. Run before saying you're done.

## Layout

- `src/app/`: pages. `src/app/globals.css`: design tokens (see DESIGN.md).
- `data/plan.json`: the training plan (`cadent.plan/v1`).

## Rules

- Smallest change that works. Reuse what exists before writing something new; no abstraction until code repeats 3 times.
- No new dependency without asking.
- Match the style and names of the surrounding code.
- Metres and seconds internally; format only for display.
- UI: token names only (DESIGN.md), never raw hex or arbitrary Tailwind values.
- Never loosen a safety-rule test to make it pass; ask instead.
- Commits are Joey's: no Co-Authored-By trailer or "Generated with Claude Code" line.

## Finishing a feature

When a feature or fix is complete, run /simplify, then /code-review, fix what they find, then say it's done.
