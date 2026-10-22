"""cadent.plan/v1 parsing and conversion to Runs (specs/plan-import.md)."""

import json
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest
from conftest import MONDAY, PlanDict, day, lift, plan_file, run, week
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from cadent_api.plan_format import PlanFile, to_runs, week_containing
from cadent_core.models import Run, RunType, Severity
from cadent_core.rules import validate

FIXTURES = Path(__file__).parents[2] / "core" / "tests" / "fixtures"
GOLDEN = FIXTURES / "golden" / "toronto-half.json"
DRAFT = FIXTURES / "toronto-half.draft.json"

# Week 15 of the Toronto plan as planned: the History just before the fixture's first week.
WEEK_15 = [
    Run(day=date(2026, 10, 13), distance_m=7000, type=RunType.EASY),
    Run(day=date(2026, 10, 17), distance_m=14000, type=RunType.LONG),
]


def toronto_half() -> PlanDict:
    path = GOLDEN if GOLDEN.exists() else DRAFT
    loaded: PlanDict = json.loads(path.read_text())
    return loaded


def parse(plan: PlanDict) -> PlanFile:
    return PlanFile.model_validate(plan)


def one_run_plan(**session: Any) -> PlanDict:
    return plan_file(week(20, MONDAY, {"date": day(1).isoformat(), "kind": "run", **session}))


# --- the Toronto Half fixture


def test_toronto_half_parses_converts_and_validates_with_no_errors() -> None:
    runs = to_runs(parse(toronto_half()))
    assert runs
    errors = [f for f in validate(runs, WEEK_15) if f.severity is Severity.ERROR]
    assert errors == []


def test_toronto_half_converts_every_run_session_and_skips_every_lift() -> None:
    plan = toronto_half()
    sessions = [s for w in plan["weeks"] for s in w["sessions"]]
    expected = Counter(
        Run(day=date.fromisoformat(s["date"]), distance_m=s["distance_m"], type=RunType(s["type"]))
        for s in sessions
        if s["kind"] == "run"
    )
    assert Counter(to_runs(parse(plan))) == expected


# --- to_runs


def test_run_sessions_become_runs_in_metres() -> None:
    plan = plan_file(
        week(20, MONDAY, run(day(1), "easy", 6000), run(day(5), "long", 16000)),
        week(21, day(7), run(day(9), "tempo", 8000)),
    )
    assert to_runs(parse(plan)) == [
        Run(day=day(1), distance_m=6000, type=RunType.EASY),
        Run(day=day(5), distance_m=16000, type=RunType.LONG),
        Run(day=day(9), distance_m=8000, type=RunType.TEMPO),
    ]


def test_lift_sessions_are_skipped_by_to_runs() -> None:
    plan = plan_file(week(20, MONDAY, lift(day(0)), run(day(1), "easy", 6000), lift(day(1))))
    assert to_runs(parse(plan)) == [Run(day=day(1), distance_m=6000, type=RunType.EASY)]


def test_a_plan_of_only_lifts_has_no_runs() -> None:
    plan = plan_file(week(20, MONDAY, lift(day(0)), lift(day(3))))
    assert to_runs(parse(plan)) == []


def test_optional_run_fields_are_accepted() -> None:
    plan = one_run_plan(
        type="easy",
        distance_m=7000,
        zone="z2",
        extras=[{"type": "strides", "duration_s": 20}],
    )
    assert to_runs(parse(plan)) == [Run(day=day(1), distance_m=7000, type=RunType.EASY)]


# --- schema


def test_schema_v1_is_accepted() -> None:
    assert parse(plan_file(week(20, MONDAY, run(day(1), "easy", 5000))))


@pytest.mark.parametrize("schema", ["cadent.plan/v2", "Cadent.Plan/v1", "cadent.plan/v1 ", ""])
def test_schema_other_than_v1_is_rejected(schema: str) -> None:
    plan = plan_file(week(20, MONDAY, run(day(1), "easy", 5000)))
    plan["schema"] = schema
    with pytest.raises(ValidationError):
        parse(plan)


def test_missing_schema_is_rejected() -> None:
    plan = plan_file(week(20, MONDAY, run(day(1), "easy", 5000)))
    del plan["schema"]
    with pytest.raises(ValidationError):
        parse(plan)


# --- unknown fields


def test_unknown_top_level_field_is_rejected() -> None:
    plan = plan_file(week(20, MONDAY, run(day(1), "easy", 5000)))
    plan["coach"] = "Joey"
    with pytest.raises(ValidationError):
        parse(plan)


def test_unknown_week_field_is_rejected() -> None:
    plan = plan_file(week(20, MONDAY, run(day(1), "easy", 5000)))
    plan["weeks"][0]["volume_km"] = 40
    with pytest.raises(ValidationError):
        parse(plan)


def test_unknown_run_field_is_rejected() -> None:
    with pytest.raises(ValidationError):
        parse(one_run_plan(type="easy", distance_m=5000, distance_km=5))


def test_unknown_lift_field_is_rejected() -> None:
    plan = plan_file(week(20, MONDAY, {**lift(day(0)), "weight_kg": 60}))
    with pytest.raises(ValidationError):
        parse(plan)


def test_unknown_race_field_is_rejected() -> None:
    plan = plan_file(week(20, MONDAY, run(day(1), "easy", 5000)))
    plan["race"]["city"] = "Toronto"
    with pytest.raises(ValidationError):
        parse(plan)


# --- distance


def test_negative_distance_is_rejected() -> None:
    with pytest.raises(ValidationError):
        parse(one_run_plan(type="easy", distance_m=-1))


def test_smallest_positive_distance_is_accepted() -> None:
    assert to_runs(parse(one_run_plan(type="easy", distance_m=1))) == [
        Run(day=day(1), distance_m=1, type=RunType.EASY)
    ]


def test_run_without_distance_is_rejected() -> None:
    with pytest.raises(ValidationError):
        parse(one_run_plan(type="easy"))


def test_run_with_only_a_duration_is_rejected() -> None:
    with pytest.raises(ValidationError):
        parse(one_run_plan(type="easy", duration_s=2400))


# --- run type


@pytest.mark.parametrize("run_type", list(RunType))
def test_every_run_type_is_accepted(run_type: RunType) -> None:
    runs = to_runs(parse(one_run_plan(type=run_type.value, distance_m=6000)))
    assert runs == [Run(day=day(1), distance_m=6000, type=run_type)]


@pytest.mark.parametrize("run_type", ["jog", "EASY", "lift", ""])
def test_type_outside_run_type_is_rejected(run_type: str) -> None:
    with pytest.raises(ValidationError):
        parse(one_run_plan(type=run_type, distance_m=6000))


def test_run_without_type_is_rejected() -> None:
    with pytest.raises(ValidationError):
        parse(one_run_plan(distance_m=6000))


def test_unknown_session_kind_is_rejected() -> None:
    plan = plan_file(week(20, MONDAY, {"date": day(1).isoformat(), "kind": "swim"}))
    with pytest.raises(ValidationError):
        parse(plan)


# --- session dates must fall in their week (start .. start + 6)


def test_session_on_the_first_day_of_its_week_is_accepted() -> None:
    plan = plan_file(week(20, MONDAY, run(day(0), "easy", 6000)))
    assert to_runs(parse(plan)) == [Run(day=day(0), distance_m=6000, type=RunType.EASY)]


def test_session_on_the_last_day_of_its_week_is_accepted() -> None:
    plan = plan_file(week(20, MONDAY, run(day(6), "easy", 6000)))
    assert to_runs(parse(plan)) == [Run(day=day(6), distance_m=6000, type=RunType.EASY)]


def test_session_the_day_after_its_week_is_rejected() -> None:
    with pytest.raises(ValidationError):
        parse(plan_file(week(20, MONDAY, run(day(7), "easy", 6000))))


def test_session_the_day_before_its_week_is_rejected() -> None:
    with pytest.raises(ValidationError):
        parse(plan_file(week(20, MONDAY, run(day(-1), "easy", 6000))))


def test_lift_outside_its_week_is_rejected() -> None:
    with pytest.raises(ValidationError):
        parse(plan_file(week(20, MONDAY, lift(day(7)))))


# --- property


def run_on(offset: int, kind: RunType, metres: int) -> PlanDict:
    return run(day(offset), kind.value, metres)


def lift_on(offset: int) -> PlanDict:
    return lift(day(offset))


session_strategy = st.one_of(
    st.builds(
        run_on,
        st.integers(min_value=0, max_value=6),
        st.sampled_from(list(RunType)),
        st.integers(min_value=1, max_value=42_195),
    ),
    st.builds(lift_on, st.integers(min_value=0, max_value=6)),
)
weeks_strategy = st.lists(st.lists(session_strategy, max_size=10), min_size=1, max_size=6)


@given(weeks_strategy)
def test_to_runs_keeps_every_run_session_and_drops_every_lift(
    weeks_sessions: list[list[PlanDict]],
) -> None:
    """Each week's sessions are shifted into that week; to_runs returns exactly its runs."""
    weeks: list[PlanDict] = []
    expected: Counter[Run] = Counter()
    for i, sessions in enumerate(weeks_sessions):
        shift = timedelta(days=7 * i)
        moved: list[PlanDict] = [
            {**s, "date": (date.fromisoformat(s["date"]) + shift).isoformat()} for s in sessions
        ]
        weeks.append(week(20 + i, MONDAY + shift, *moved))
        expected.update(
            Run(
                day=date.fromisoformat(s["date"]),
                distance_m=s["distance_m"],
                type=RunType(s["type"]),
            )
            for s in moved
            if s["kind"] == "run"
        )
    assert Counter(to_runs(parse(plan_file(*weeks)))) == expected


# --- week_containing: the week a Finding's day belongs to, even with no session that day


def two_weeks() -> PlanFile:
    return PlanFile.model_validate(
        plan_file(
            week(20, MONDAY, run(day(1), "easy", 6000)),
            week(21, day(7), run(day(8), "easy", 6000)),
        )
    )


def test_a_rest_day_belongs_to_the_week_containing_it() -> None:
    assert week_containing(two_weeks().weeks, day(4)) == 20


def test_the_last_day_of_a_week_and_the_first_of_the_next() -> None:
    weeks = two_weeks().weeks
    assert week_containing(weeks, day(6)) == 20
    assert week_containing(weeks, day(7)) == 21


def test_a_day_before_every_week_counts_toward_the_first() -> None:
    assert week_containing(two_weeks().weeks, day(-1)) == 20


def test_weeks_listed_out_of_order_still_map_by_date() -> None:
    plan = two_weeks()
    assert week_containing(list(reversed(plan.weeks)), day(2)) == 20
