# Roadmap

Goal: **resume-ready**: deployed and in daily use, polished README, ADRs, CI quality gates, a
working MCP connector, and a short demo video. No deadlines: work through the steps in order, as
fast as they get done.

Full product spec (architecture, data model, rules, MCP tools, design): the "Cadent — Project Spec"
doc in Joey's Claude artifacts. This file is the working summary for Claude Code sessions.

## Status

MVP first: the core loop plus MCP, live and in daily use at the end of step 5. Check-in, the
remaining rules and mutation testing come after that.

| Step | Deliverable | Status |
| --- | --- | --- |
| 0 | Foundations, OAuth 2.1 / MCP spike, Postgres schema + Alembic | Done: PRs #6 and #7, ADRs 009 and 012 |
| 1 | Plan import + audit, Toronto Half plan imported, 4 MVP safety rules (below) | **Next: plan import** (spec first) |
| 2 | Garmin sync worker behind the DataSource protocol (ADR 005) | Not started |
| 3 | Run matching, Today screen | Not started |
| 4 | Deploy to VPS. **Daily use starts** | Not started |
| 5 | MCP server: OAuth, read-only tools, cross-user tests. **MVP done** | Not started |
| 6 | Run detail + check-in, remaining safety rules | Not started |
| 7 | Mutation testing, polish, README quality report, demo video, resume bullets | Not started |

Update the Status column when a step's deliverable is merged.

## After the roadmap (do not build before step 7 is done)

Plan generator and intake screen · AI-drafted plans via MCP · Trends screen · offline mode and
push notifications · visual regression, Lighthouse, monthly audits · weekly maintenance agents ·
signups and multi-user polish.

## Safety rules still to build

From the spec; defaults come from Joey's Toronto Half plan. Build each with `/add-safety-rule`.
The four marked MVP ship in step 1; the rest in step 6.

| Code | Rule | Default | Severity | When |
| --- | --- | --- | --- | --- |
| `LONG_RUN_CAP` | Long run distance cap | 24 km | Error | MVP |
| `WEEKLY_JUMP` | Week-over-week distance increase | at most 15% (after a cutback, compare with the last full week) | Warning | MVP |
| `NO_REST_DAY` | At least one full rest day per week | required | Error | MVP |
| `TAPER_MISSING` | Taper before race day | 2 weeks for a half | Error | MVP |
| `ONE_VARIABLE` | Weekly distance, long run and quality volume never all rise in one week; frequency and volume never rise together | on | Error | Step 6 |
| `WEEKDAY_STEP` | Weekday run growth | at most 1 km per run per week | Warning | Step 6 |
| `CUTBACK_MISSING` | A cutback week at least every 4 weeks | about 20% lower | Error | Step 6 |
| `QUALITY_TOO_EARLY` | Quality sessions before a base exists | 6+ weeks of consistent running | Warning | Step 6 |
| `HARD_DAYS_ADJACENT` | Two quality or long days back to back | not allowed | Warning | Step 6 |

Done: `LONG_RUN_SPIKE`, `MIN_RUN`.
