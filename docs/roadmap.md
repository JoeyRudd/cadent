# Roadmap

Goal: **resume-ready by Sunday, December 13, 2026**: deployed and in daily use, polished README,
ADRs, CI quality gates, a working MCP connector, and a short demo video. About 10 hours a week.

Full product spec (architecture, data model, rules, MCP tools, design): the "Cadent — Project Spec"
doc in Joey's Claude artifacts. This file is the working summary for Claude Code sessions.

## Status

| Week | Dates | Deliverable | Status |
| --- | --- | --- | --- |
| 1 | Oct 19-25 | Foundations + OAuth 2.1 / MCP spike | Scaffold done Oct 16. **Next: the spike** (`specs/oauth-mcp-spike.md`) |
| 2 | Oct 26 - Nov 1 | Postgres schema + Alembic, Garmin sync worker, Toronto Half plan imported | Not started |
| 3 | Nov 2-8 | Remaining safety rules (test-first), plan import + audit | Not started |
| 4 | Nov 9-15 | Run matching, Today screen | Not started |
| 5 | Nov 16-22 | Run detail + check-in, deploy to VPS. **Daily use starts** | Not started |
| 6 | Nov 23-29 | MCP server: OAuth, read-only tools, cross-user tests | Not started |
| 7 | Nov 30 - Dec 6 | Mutation testing, Claude review in Actions, README quality report | Not started |
| 8 | Dec 7-13 | Impeccable polish, README, demo video, resume bullets | Not started |

Update the Status column when a week's deliverable is merged.

## After December (do not build before Dec 13)

Plan generator and intake screen · AI-drafted plans via MCP · Trends screen · offline mode and
push notifications · visual regression, Lighthouse, monthly audits · weekly maintenance agents ·
signups and multi-user polish.

## Safety rules still to build (week 3)

From the spec; defaults come from Joey's Toronto Half plan. Build each with `/add-safety-rule`.

| Code | Rule | Default | Severity |
| --- | --- | --- | --- |
| `LONG_RUN_CAP` | Long run distance cap | 24 km | Error |
| `ONE_VARIABLE` | Weekly distance, long run and quality volume never all rise in one week; frequency and volume never rise together | on | Error |
| `WEEKDAY_STEP` | Weekday run growth | at most 1 km per run per week | Warning |
| `WEEKLY_JUMP` | Week-over-week distance increase | at most 15% (after a cutback, compare with the last full week) | Warning |
| `CUTBACK_MISSING` | A cutback week at least every 4 weeks | about 20% lower | Error |
| `QUALITY_TOO_EARLY` | Quality sessions before a base exists | 6+ weeks of consistent running | Warning |
| `HARD_DAYS_ADJACENT` | Two quality or long days back to back | not allowed | Warning |
| `NO_REST_DAY` | At least one full rest day per week | required | Error |
| `TAPER_MISSING` | Taper before race day | 2 weeks for a half | Error |

Done: `LONG_RUN_SPIKE`, `MIN_RUN`.
