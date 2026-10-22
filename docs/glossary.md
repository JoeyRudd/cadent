# Glossary

One name per concept, used in code, UI and docs.

| Term | Meaning | Not |
| --- | --- | --- |
| Run | One running session on one local date, planned or completed (`Run`) | workout, activity (in code) |
| Activity | A run as synced from Garmin, with its raw data | session |
| Session | A planned entry in a plan (a run or a lift) | workout |
| Plan | A fixed, user-owned schedule of weeks and sessions | program |
| History | Completed runs before the plan being checked | past runs |
| Finding | One problem the rules engine reports on a planned day | error, issue |
| Rule | One safety check in `core/rules/`, with a code like `LONG_RUN_SPIKE` | validator |
| Check-in | The post-run form: effort, soreness, pain | log, survey |
| Readiness | The good / fair / low morning signal from HRV, sleep and resting HR | recovery score |
| Long run | The week's longest run (`RunType.LONG`) | LSD |
| Quality session | A hard run: `tempo`, `intervals` or `race`. A group of run types, not a `RunType` | workout, key run |
| Shakeout | A short race-week run, exempt from the 5 km minimum | |
