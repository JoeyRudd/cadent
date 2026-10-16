"""Rules-engine tests. PROTECTED: change only when expected behaviour changes (see CLAUDE.md)."""

from datetime import date, timedelta

from cadent_core.models import Run, RunType, Severity
from cadent_core.rules import validate
from cadent_core.rules.long_run_spike import LONG_RUN_SPIKE
from cadent_core.rules.min_run import MIN_RUN

DAY0 = date(2026, 10, 12)


def run(day: int, km: float, kind: RunType = RunType.EASY) -> Run:
    return Run(day=DAY0 + timedelta(days=day), distance_m=round(km * 1000), type=kind)


def codes(runs: list[Run], history: list[Run] | None = None) -> list[str]:
    return [f.code for f in validate(runs, history or [])]


# --- LONG_RUN_SPIKE: a long run may be at most 110% of the longest run in the previous 30 days


def test_long_run_within_ten_percent_passes() -> None:
    history = [run(-7, 14, RunType.LONG)]
    assert LONG_RUN_SPIKE not in codes([run(0, 15.4, RunType.LONG)], history)


def test_long_run_over_ten_percent_is_an_error() -> None:
    history = [run(-7, 14, RunType.LONG)]
    findings = validate([run(0, 15.5, RunType.LONG)], history)
    spike = [f for f in findings if f.code == LONG_RUN_SPIKE]
    assert len(spike) == 1
    assert spike[0].severity is Severity.ERROR
    assert spike[0].day == DAY0


def test_runs_older_than_thirty_days_do_not_count_as_a_baseline() -> None:
    history = [run(-31, 20, RunType.LONG), run(-7, 10, RunType.LONG)]
    assert LONG_RUN_SPIKE in codes([run(0, 12, RunType.LONG)], history)


def test_earlier_planned_runs_count_toward_the_baseline() -> None:
    plan = [run(0, 14, RunType.LONG), run(7, 15, RunType.LONG), run(14, 16.5, RunType.LONG)]
    assert LONG_RUN_SPIKE not in codes(plan, [run(-7, 13, RunType.LONG)])


def test_a_jump_inside_the_plan_is_caught() -> None:
    plan = [run(0, 14, RunType.LONG), run(7, 18, RunType.LONG)]
    assert LONG_RUN_SPIKE in codes(plan, [run(-7, 14, RunType.LONG)])


def test_long_run_with_no_recent_runs_is_a_warning_not_a_pass() -> None:
    findings = validate([run(0, 10, RunType.LONG)], [])
    spike = [f for f in findings if f.code == LONG_RUN_SPIKE]
    assert len(spike) == 1
    assert spike[0].severity is Severity.WARNING


def test_easy_runs_are_not_checked_by_the_spike_rule() -> None:
    assert LONG_RUN_SPIKE not in codes([run(0, 12)], [run(-7, 6)])


# --- MIN_RUN: no run under 5 km, except a race-week shakeout


def test_run_under_five_km_is_a_warning() -> None:
    findings = validate([run(0, 4.5)], [])
    assert [(f.code, f.severity) for f in findings] == [(MIN_RUN, Severity.WARNING)]


def test_five_km_exactly_passes() -> None:
    assert codes([run(0, 5)]) == []


def test_shakeout_is_exempt_from_minimum() -> None:
    assert codes([run(0, 3, RunType.SHAKEOUT)]) == []


# --- engine


def test_findings_are_sorted_by_day() -> None:
    plan = [run(7, 3), run(0, 4)]
    assert [f.day for f in validate(plan, [])] == [DAY0, DAY0 + timedelta(days=7)]


L = RunType.LONG

# Golden fixture: Joey's real Toronto Half plan. Weeks 14-15 (Oct 5-18) as history,
# Weeks 16-20 (Oct 19 - Nov 22) as the plan under test. Day 0 is Mon Oct 12.
# fmt: off
TORONTO_HALF_HISTORY = [
    run(-6, 5), run(-5, 6), run(-4, 5), run(-2, 10, L),  # Week 14 (cutback)
    run(1, 7), run(2, 7), run(3, 6), run(5, 14, L),  # Week 15
]
TORONTO_HALF_PLAN = [
    run(8, 7), run(9, 8), run(10, 6), run(12, 15, L),  # Week 16
    run(15, 5), run(16, 7), run(17, 6), run(19, 15, L), run(20, 5),  # Week 17: 5th run day
    run(22, 5), run(23, 5), run(24, 5), run(26, 12, L), run(27, 5),  # Week 18 (cutback)
    run(29, 6), run(30, 7), run(31, 6), run(33, 16, L), run(34, 5),  # Week 19
    run(36, 6), run(37, 7), run(38, 7), run(40, 17, L), run(41, 6),  # Week 20
]
# fmt: on


def test_toronto_half_weeks_16_to_20_are_clean() -> None:
    assert validate(TORONTO_HALF_PLAN, TORONTO_HALF_HISTORY) == []
