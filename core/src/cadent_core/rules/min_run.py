"""MIN_RUN: no run under 5 km, except a race-week shakeout."""

from collections.abc import Iterator, Sequence

from cadent_core.models import Finding, Run, RunType, Severity

MIN_RUN = "MIN_RUN"
MIN_DISTANCE_M = 5_000


def check(plan: Sequence[Run], history: Sequence[Run]) -> Iterator[Finding]:
    for r in plan:
        if r.type is not RunType.SHAKEOUT and r.distance_m < MIN_DISTANCE_M:
            yield Finding(
                MIN_RUN,
                Severity.WARNING,
                r.day,
                f"Run of {r.distance_m / 1000:.1f} km is under the 5 km minimum.",
            )
