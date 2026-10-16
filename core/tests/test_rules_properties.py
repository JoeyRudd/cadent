"""Property tests for safety invariants. PROTECTED: see CLAUDE.md."""

from datetime import date, timedelta

from hypothesis import given
from hypothesis import strategies as st

from cadent_core.models import Run, RunType, Severity
from cadent_core.rules import validate
from cadent_core.rules.long_run_spike import LONG_RUN_SPIKE, MAX_RATIO, WINDOW_DAYS

START = date(2026, 10, 1)

runs_strategy = st.lists(
    st.builds(
        Run,
        day=st.integers(min_value=0, max_value=120).map(lambda d: START + timedelta(days=d)),
        distance_m=st.integers(min_value=1_000, max_value=35_000),
        type=st.sampled_from(list(RunType)),
    ),
    max_size=40,
)


@given(runs_strategy)
def test_no_accepted_long_run_exceeds_the_spike_limit(runs: list[Run]) -> None:
    """If the engine raises no spike finding, every long run is within 110% of its 30-day max."""
    findings = validate(runs, [])
    flagged = {f.day for f in findings if f.code == LONG_RUN_SPIKE}
    for long_run in (r for r in runs if r.type is RunType.LONG):
        if long_run.day in flagged:
            continue
        window = [
            r.distance_m
            for r in runs
            if r is not long_run and timedelta(0) < long_run.day - r.day <= timedelta(WINDOW_DAYS)
        ]
        assert window, "a long run with no baseline must be flagged"
        assert long_run.distance_m <= MAX_RATIO * max(window)


@given(runs_strategy)
def test_findings_only_reference_planned_days(runs: list[Run]) -> None:
    days = {r.day for r in runs}
    assert all(f.day in days for f in validate(runs, []))


@given(runs_strategy)
def test_validation_is_deterministic(runs: list[Run]) -> None:
    assert validate(runs, []) == validate(list(runs), [])


@given(runs_strategy)
def test_severity_is_always_set(runs: list[Run]) -> None:
    assert all(isinstance(f.severity, Severity) for f in validate(runs, []))
