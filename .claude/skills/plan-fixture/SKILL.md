---
name: plan-fixture
description: Convert a training-plan document into cadent.plan/v1 JSON for tests. Use when turning a real plan (such as the Toronto Half plan) into a fixture.
---
# Make a plan fixture

A fixture records the plan as written. Never change a session to make the rules engine pass.

1. Read the source plan in full and the `cadent.plan/v1` example in the spec's "Plans & safety" tab.
2. Convert every week and session:
   - dates as ISO `YYYY-MM-DD`, distances in metres, durations and paces in seconds;
   - `kind` is `run` or `lift`; runs target distance or time, pace or HR zone, with `extras` and `blocks` as written;
   - `cutback` and `phase` as the plan labels them.
3. When the source is ambiguous (a range, a missing zone, an unclear day), ask Joey. Do not guess.
4. Save it under `core/tests/fixtures/`. Golden fixtures go in `core/tests/fixtures/golden/`, which the hook protects:
   Joey adds or changes those by hand.
5. Run the fixture through `cadent_core.rules.validate` and show Joey the findings.
   A golden fixture must produce zero errors; if it does not, report the findings and stop.
