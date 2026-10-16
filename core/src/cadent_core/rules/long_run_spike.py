"""LONG_RUN_SPIKE: a long run may be at most 110% of the longest run in the previous 30 days.

The single-session spike rule replaces the 10% weekly-mileage rule as the main guard
against overload from one big step in the long run.
"""

from collections.abc import Iterator, Sequence
from datetime import timedelta

from cadent_core.models import Finding, Run, RunType, Severity

LONG_RUN_SPIKE = "LONG_RUN_SPIKE"
MAX_RATIO = 1.10
WINDOW_DAYS = 30


def check(plan: Sequence[Run], history: Sequence[Run]) -> Iterator[Finding]:
    every_run = [*history, *plan]
    window = timedelta(days=WINDOW_DAYS)
    for long_run in (r for r in plan if r.type is RunType.LONG):
        baseline = [
            r.distance_m for r in every_run if timedelta(0) < long_run.day - r.day <= window
        ]
        if not baseline:
            yield Finding(
                LONG_RUN_SPIKE,
                Severity.WARNING,
                long_run.day,
                "No runs in the previous 30 days to compare this long run against.",
            )
            continue
        limit = max(baseline) * MAX_RATIO
        if long_run.distance_m > limit:
            yield Finding(
                LONG_RUN_SPIKE,
                Severity.ERROR,
                long_run.day,
                f"Long run of {long_run.distance_m / 1000:.1f} km is over the "
                f"{limit / 1000:.1f} km limit (110% of the longest run in 30 days).",
            )
