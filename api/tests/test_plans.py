"""Plan import and audit endpoints (specs/plan-import.md). Need Docker: they fail, never skip."""

import uuid
from collections import Counter
from collections.abc import Callable
from datetime import UTC, datetime, time
from typing import Any, cast

import pytest
from conftest import (
    MONDAY,
    Api,
    PlanDict,
    clean_plan,
    day,
    error_plan,
    lift,
    min_run_plan,
    plan_file,
    row_counts,
    run,
    warning_plan,
    week,
)
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session as DbSession

from cadent_api.plan_format import PlanFile, to_runs
from cadent_core.models import Severity
from cadent_core.rules import validate
from cadent_core.rules.long_run_spike import LONG_RUN_SPIKE
from cadent_core.rules.min_run import MIN_RUN
from cadent_db.models import Activity, DataSourceAccount, Plan, PlanWeek, RuleFinding, Session, User

FINDING_KEYS = {"id", "rule_code", "severity", "day", "week_index", "message", "accepted"}


def two_week_plan() -> PlanDict:
    """MIN_RUN Warning on week 20's first day; LONG_RUN_SPIKE Error on week 21's last day."""
    return plan_file(
        week(20, MONDAY, run(day(0), "easy", 4000)),
        week(21, day(7), run(day(9), "easy", 6000), run(day(13), "long", 15000), cutback=True),
    )


def expected_findings(plan: PlanDict) -> Counter[tuple[str, str, str, str]]:
    """What validate reports for the file, with the empty History import uses before Garmin sync."""
    return Counter(
        (f.code, f.severity.value, f.day.isoformat(), f.message)
        for f in validate(to_runs(PlanFile.model_validate(plan)), [])
    )


def as_tuples(findings: list[dict[str, Any]]) -> Counter[tuple[str, str, str, str]]:
    return Counter((f["rule_code"], f["severity"], f["day"], f["message"]) for f in findings)


def only_finding(api: Api, plan: PlanDict) -> tuple[str, dict[str, Any]]:
    imported = api.import_plan(plan)
    [finding] = imported["findings"]
    return imported["plan_id"], finding


def accept_all(api: Api, plan_id: str) -> None:
    for finding in api.plan(plan_id)["findings"]:
        body = {"confirm": finding["rule_code"]} if finding["severity"] == "error" else None
        assert api.accept(plan_id, finding["id"], body).status_code == 200


def active_plans(db: DbSession, user: User) -> list[uuid.UUID]:
    db.expire_all()
    query = select(Plan.id).where(Plan.user_id == user.id, Plan.status == "active")
    return list(db.scalars(query))


# --- the test plans trigger the Findings they claim to


def test_test_plans_trigger_their_findings() -> None:
    def kinds(plan: PlanDict) -> list[tuple[str, str]]:
        return sorted((code, severity) for code, severity, _, _ in expected_findings(plan))

    assert kinds(clean_plan()) == []
    assert kinds(warning_plan()) == [(LONG_RUN_SPIKE, Severity.WARNING.value)]
    assert kinds(error_plan()) == [(LONG_RUN_SPIKE, Severity.ERROR.value)]
    assert kinds(min_run_plan()) == [(MIN_RUN, Severity.WARNING.value)]
    assert kinds(two_week_plan()) == [
        (LONG_RUN_SPIKE, Severity.ERROR.value),
        (MIN_RUN, Severity.WARNING.value),
    ]


# --- 422 on a bad file, with nothing saved


def set_schema(plan: PlanDict) -> None:
    plan["schema"] = "cadent.plan/v2"


def drop_schema(plan: PlanDict) -> None:
    del plan["schema"]


def add_unknown_field(plan: PlanDict) -> None:
    plan["coach"] = "Joey"


def add_unknown_session_field(plan: PlanDict) -> None:
    plan["weeks"][0]["sessions"][0]["distance_km"] = 5


def negative_distance(plan: PlanDict) -> None:
    plan["weeks"][0]["sessions"][0]["distance_m"] = -1


def unknown_run_type(plan: PlanDict) -> None:
    plan["weeks"][0]["sessions"][0]["type"] = "jog"


def drop_distance(plan: PlanDict) -> None:
    session = plan["weeks"][0]["sessions"][0]
    del session["distance_m"]
    session["duration_s"] = 2400


def session_after_its_week(plan: PlanDict) -> None:
    plan["weeks"][0]["sessions"][0]["date"] = day(7).isoformat()


def duplicate_week_index(plan: PlanDict) -> None:
    plan["weeks"].append(week(20, day(7), run(day(8), "easy", 6000)))


def overlapping_weeks(plan: PlanDict) -> None:
    plan["weeks"].append(week(21, day(6), run(day(8), "easy", 6000)))


BAD_FILES: list[Callable[[PlanDict], None]] = [
    set_schema,
    drop_schema,
    add_unknown_field,
    add_unknown_session_field,
    negative_distance,
    unknown_run_type,
    drop_distance,
    session_after_its_week,
    duplicate_week_index,
    overlapping_weeks,
]


@pytest.mark.parametrize("break_file", BAD_FILES, ids=lambda f: f.__name__)
def test_bad_file_is_rejected_with_422_and_nothing_is_saved(
    api: Api, engine: Engine, break_file: Callable[[PlanDict], None]
) -> None:
    api.import_plan(clean_plan("Already there"))
    before = row_counts(engine)
    plan = plan_file(
        week(20, MONDAY, run(day(1), "easy", 6000), lift(day(2)), run(day(5), "long", 10000))
    )
    break_file(plan)
    response = api.post("/plans/import", plan)
    assert response.status_code == 422
    assert row_counts(engine) == before


@pytest.mark.parametrize("break_file", BAD_FILES, ids=lambda f: f.__name__)
def test_422_names_the_failing_field(api: Api, break_file: Callable[[PlanDict], None]) -> None:
    plan = plan_file(week(20, MONDAY, run(day(1), "easy", 6000)))
    break_file(plan)
    detail: object = api.post("/plans/import", plan).json()["detail"]
    assert isinstance(detail, list)
    errors = cast(list[dict[str, Any]], detail)
    assert errors
    assert all("loc" in error for error in errors)


def test_empty_body_is_rejected_with_422_and_nothing_is_saved(api: Api, engine: Engine) -> None:
    before = row_counts(engine)
    assert api.post("/plans/import", {}).status_code == 422
    assert row_counts(engine) == before


def test_smallest_positive_distance_is_imported(api: Api, db: DbSession) -> None:
    api.import_plan(plan_file(week(20, MONDAY, run(day(1), "easy", 1))))
    assert list(db.scalars(select(Session.distance_m))) == [1]


def test_session_on_the_last_day_of_its_week_is_imported(api: Api, db: DbSession) -> None:
    api.import_plan(plan_file(week(20, MONDAY, run(day(6), "easy", 6000))))
    assert list(db.scalars(select(Session.date))) == [day(6)]


# --- lifts


def test_lifts_are_accepted_counted_and_not_saved(api: Api, db: DbSession) -> None:
    plan = plan_file(
        week(20, MONDAY, lift(day(0)), run(day(1), "easy", 6000), lift(day(1)), lift(day(4)))
    )
    imported = api.import_plan(plan)
    assert imported["skipped_lifts"] == 3
    sessions = list(db.scalars(select(Session)))
    assert [(s.date, s.type, s.distance_m) for s in sessions] == [(day(1), "easy", 6000)]


def test_a_plan_without_lifts_skips_none(api: Api) -> None:
    assert api.import_plan(clean_plan())["skipped_lifts"] == 0


def test_lifts_across_weeks_are_all_counted(api: Api) -> None:
    plan = plan_file(
        week(20, MONDAY, lift(day(0)), run(day(1), "easy", 6000)),
        week(21, day(7), lift(day(13)), run(day(8), "easy", 6000)),
    )
    assert api.import_plan(plan)["skipped_lifts"] == 2


# --- import saves one draft plan, its weeks, its runs and exactly validate's Findings


def test_import_saves_one_draft_imported_plan_for_the_current_user(
    api: Api, db: DbSession, owner: User
) -> None:
    imported = api.import_plan(clean_plan("Toronto Half"))
    [plan] = list(db.scalars(select(Plan)))
    assert str(plan.id) == imported["plan_id"]
    assert (plan.user_id, plan.name, plan.source, plan.status) == (
        owner.id,
        "Toronto Half",
        "imported",
        "draft",
    )


def test_import_saves_every_week(api: Api, db: DbSession) -> None:
    api.import_plan(two_week_plan())
    weeks = list(db.scalars(select(PlanWeek).order_by(PlanWeek.index)))
    assert [(w.index, w.phase, w.is_cutback) for w in weeks] == [
        (20, "base", False),
        (21, "base", True),
    ]


def test_import_saves_every_run_session_in_its_week(api: Api, db: DbSession) -> None:
    api.import_plan(two_week_plan())
    rows = db.execute(
        select(PlanWeek.index, Session.date, Session.type, Session.distance_m)
        .join(PlanWeek, Session.plan_week_id == PlanWeek.id)
        .order_by(Session.date)
    ).all()
    assert [tuple(r) for r in rows] == [
        (20, day(0), "easy", 4000),
        (21, day(9), "easy", 6000),
        (21, day(13), "long", 15000),
    ]


def test_run_zone_is_kept_as_hr_zone(api: Api, db: DbSession) -> None:
    api.import_plan(plan_file(week(20, MONDAY, run(day(1), "easy", 6000, zone="z2"))))
    assert list(db.scalars(select(Session.hr_zone))) == [2]


@pytest.mark.parametrize(
    "plan",
    [clean_plan(), warning_plan(), error_plan(), min_run_plan(), two_week_plan()],
    ids=["none", "spike-warning", "spike-error", "min-run", "two-weeks"],
)
def test_import_saves_exactly_the_findings_validate_returns(
    api: Api, db: DbSession, owner: User, plan: PlanDict
) -> None:
    imported = api.import_plan(plan)
    expected = expected_findings(plan)
    assert as_tuples(imported["findings"]) == expected
    assert all(set(f) == FINDING_KEYS for f in imported["findings"])
    assert not any(f["accepted"] for f in imported["findings"])
    rows = list(db.scalars(select(RuleFinding)))
    saved = Counter((r.rule_code, r.severity, r.day.isoformat(), r.message) for r in rows)
    assert saved == expected
    assert all(str(r.plan_id) == imported["plan_id"] for r in rows)
    assert all(r.user_id == owner.id and not r.accepted for r in rows)


def test_a_plan_with_no_findings_saves_none(api: Api, engine: Engine) -> None:
    assert api.import_plan(clean_plan())["findings"] == []
    assert row_counts(engine)["rule_findings"] == 0


def test_each_finding_gets_the_index_of_the_week_containing_its_day(
    api: Api, db: DbSession
) -> None:
    imported = api.import_plan(two_week_plan())
    by_code = {(f["rule_code"], f["day"]): f["week_index"] for f in imported["findings"]}
    assert by_code == {
        (MIN_RUN, day(0).isoformat()): 20,  # first day of week 20
        (LONG_RUN_SPIKE, day(13).isoformat()): 21,  # last day of week 21, not week 22
    }
    saved = {(r.rule_code, r.day): r.week_index for r in db.scalars(select(RuleFinding))}
    assert saved == {(MIN_RUN, day(0)): 20, (LONG_RUN_SPIKE, day(13)): 21}


def test_importing_the_same_file_twice_makes_two_drafts(api: Api, db: DbSession) -> None:
    first = api.import_plan(warning_plan())
    second = api.import_plan(warning_plan())
    assert first["plan_id"] != second["plan_id"]
    assert list(db.scalars(select(Plan.status))) == ["draft", "draft"]
    assert db.scalar(select(func.count()).select_from(RuleFinding)) == 2


def test_get_returns_the_audit_report(api: Api) -> None:
    imported = api.import_plan(two_week_plan())
    report = api.plan(imported["plan_id"])
    assert (report["id"], report["name"], report["status"]) == (
        imported["plan_id"],
        "Test plan",
        "draft",
    )
    weeks = sorted(report["weeks"], key=lambda w: w["index"])
    assert [(w["index"], w["phase"], w["is_cutback"], len(w["sessions"])) for w in weeks] == [
        (20, "base", False, 1),
        (21, "base", True, 2),
    ]
    assert as_tuples(report["findings"]) == expected_findings(two_week_plan())
    assert all(set(f) == FINDING_KEYS for f in report["findings"])


def test_get_an_unknown_plan_is_404(api: Api) -> None:
    assert api.get(f"/plans/{uuid.uuid4()}").status_code == 404


# --- accepting Findings


def test_accepting_a_warning_needs_no_body(api: Api) -> None:
    plan_id, finding = only_finding(api, warning_plan())
    assert finding["severity"] == "warning"
    assert api.accept(plan_id, finding["id"]).status_code == 200
    assert [f["accepted"] for f in api.plan(plan_id)["findings"]] == [True]


def test_accepting_a_warning_with_an_empty_object_succeeds(api: Api) -> None:
    plan_id, finding = only_finding(api, min_run_plan())
    assert api.accept(plan_id, finding["id"], {}).status_code == 200
    assert [f["accepted"] for f in api.plan(plan_id)["findings"]] == [True]


def test_accepting_an_error_with_its_code_succeeds(api: Api) -> None:
    plan_id, finding = only_finding(api, error_plan())
    assert finding["severity"] == "error"
    response = api.accept(plan_id, finding["id"], {"confirm": LONG_RUN_SPIKE})
    assert response.status_code == 200
    assert [f["accepted"] for f in api.plan(plan_id)["findings"]] == [True]


@pytest.mark.parametrize(
    "body",
    [
        {"confirm": "MIN_RUN"},
        {"confirm": "long_run_spike"},
        {"confirm": f"{LONG_RUN_SPIKE} "},
        {"confirm": LONG_RUN_SPIKE[:-1]},
        {"confirm": ""},
    ],
    ids=["other-code", "lowercase", "trailing-space", "one-short", "empty-text"],
)
def test_accepting_an_error_with_the_wrong_confirmation_fails(
    api: Api, body: dict[str, str]
) -> None:
    plan_id, finding = only_finding(api, error_plan())
    assert api.accept(plan_id, finding["id"], body).status_code == 422
    assert [f["accepted"] for f in api.plan(plan_id)["findings"]] == [False]


@pytest.mark.parametrize("body", [None, {}], ids=["no-body", "empty-object"])
def test_accepting_an_error_without_a_confirmation_fails(api: Api, body: object) -> None:
    plan_id, finding = only_finding(api, error_plan())
    assert api.accept(plan_id, finding["id"], body).status_code == 422
    assert [f["accepted"] for f in api.plan(plan_id)["findings"]] == [False]


def test_accepting_an_unknown_finding_is_404(api: Api) -> None:
    plan_id, _ = only_finding(api, warning_plan())
    assert api.accept(plan_id, str(uuid.uuid4())).status_code == 404


# --- activation


def test_a_plan_with_an_unaccepted_finding_cannot_be_activated(api: Api) -> None:
    plan_id, _ = only_finding(api, warning_plan())
    assert api.activate(plan_id).status_code == 409
    assert api.plan(plan_id)["status"] == "draft"


def test_a_plan_with_one_of_two_findings_accepted_cannot_be_activated(api: Api) -> None:
    imported = api.import_plan(two_week_plan())
    plan_id = imported["plan_id"]
    warning = next(f for f in imported["findings"] if f["severity"] == "warning")
    assert api.accept(plan_id, warning["id"]).status_code == 200
    assert api.activate(plan_id).status_code == 409
    assert api.plan(plan_id)["status"] == "draft"


def test_a_plan_with_every_finding_accepted_can_be_activated(api: Api) -> None:
    plan_id = api.import_plan(two_week_plan())["plan_id"]
    accept_all(api, plan_id)
    assert api.activate(plan_id).status_code == 200
    assert api.plan(plan_id)["status"] == "active"


def test_a_plan_with_no_findings_can_be_activated(api: Api) -> None:
    plan_id = api.import_plan(clean_plan())["plan_id"]
    assert api.activate(plan_id).status_code == 200
    assert api.plan(plan_id)["status"] == "active"


def test_activating_archives_the_previous_active_plan(api: Api, db: DbSession, owner: User) -> None:
    first = api.import_plan(clean_plan("First"))["plan_id"]
    assert api.activate(first).status_code == 200
    second = api.import_plan(clean_plan("Second"))["plan_id"]
    assert api.activate(second).status_code == 200
    assert api.plan(first)["status"] == "archived"
    assert api.plan(second)["status"] == "active"
    assert active_plans(db, owner) == [uuid.UUID(second)]


def test_there_is_never_more_than_one_active_plan(api: Api, db: DbSession, owner: User) -> None:
    plan_ids = [api.import_plan(clean_plan(f"Plan {i}"))["plan_id"] for i in range(3)]
    assert active_plans(db, owner) == []
    for plan_id in plan_ids:
        assert api.activate(plan_id).status_code == 200
        assert active_plans(db, owner) == [uuid.UUID(plan_id)]
    statuses = [api.plan(p)["status"] for p in plan_ids]
    assert statuses == ["archived", "archived", "active"]


def test_a_refused_activation_keeps_the_current_active_plan(
    api: Api, db: DbSession, owner: User
) -> None:
    active = api.import_plan(clean_plan())["plan_id"]
    assert api.activate(active).status_code == 200
    draft, _ = only_finding(api, warning_plan())
    assert api.activate(draft).status_code == 409
    assert active_plans(db, owner) == [uuid.UUID(active)]


def test_activating_never_archives_another_users_plan(
    api: Api, db: DbSession, owner: User, other: User
) -> None:
    api.act_as(other)
    theirs = api.import_plan(clean_plan("Theirs"))["plan_id"]
    assert api.activate(theirs).status_code == 200
    api.act_as(owner)
    mine = api.import_plan(clean_plan("Mine"))["plan_id"]
    assert api.activate(mine).status_code == 200
    assert active_plans(db, other) == [uuid.UUID(theirs)]
    assert active_plans(db, owner) == [uuid.UUID(mine)]


def test_activating_an_unknown_plan_is_404(api: Api) -> None:
    assert api.activate(str(uuid.uuid4())).status_code == 404


# --- another user's plan is 404 on every /plans endpoint


def test_import_belongs_to_the_importing_user(api: Api, db: DbSession, other: User) -> None:
    api.act_as(other)
    plan_id = api.import_plan(warning_plan())["plan_id"]
    plan = db.get(Plan, uuid.UUID(plan_id))
    assert plan is not None
    assert plan.user_id == other.id
    assert {r.user_id for r in db.scalars(select(PlanWeek))} == {other.id}
    assert {r.user_id for r in db.scalars(select(Session))} == {other.id}
    assert {r.user_id for r in db.scalars(select(RuleFinding))} == {other.id}


def test_another_users_plan_is_404_on_get(api: Api, other: User) -> None:
    plan_id = api.import_plan(warning_plan())["plan_id"]
    api.act_as(other)
    assert api.get(f"/plans/{plan_id}").status_code == 404


def test_another_users_warning_is_404_on_accept(api: Api, owner: User, other: User) -> None:
    plan_id, finding = only_finding(api, warning_plan())
    api.act_as(other)
    assert api.accept(plan_id, finding["id"]).status_code == 404
    api.act_as(owner)
    assert [f["accepted"] for f in api.plan(plan_id)["findings"]] == [False]


def test_another_users_error_is_404_on_accept_even_with_its_code(
    api: Api, owner: User, other: User
) -> None:
    plan_id, finding = only_finding(api, error_plan())
    api.act_as(other)
    response = api.accept(plan_id, finding["id"], {"confirm": LONG_RUN_SPIKE})
    assert response.status_code == 404
    api.act_as(owner)
    assert [f["accepted"] for f in api.plan(plan_id)["findings"]] == [False]


def test_another_users_plan_is_404_on_activate(api: Api, owner: User, other: User) -> None:
    plan_id = api.import_plan(clean_plan())["plan_id"]
    api.act_as(other)
    assert api.activate(plan_id).status_code == 404
    api.act_as(owner)
    assert api.plan(plan_id)["status"] == "draft"


def test_another_users_plan_is_404_on_import_follow_ups_but_mine_still_works(
    api: Api, other: User
) -> None:
    """Boundary: both users import; each sees only their own plan."""
    mine = api.import_plan(clean_plan("Mine"))["plan_id"]
    api.act_as(other)
    theirs = api.import_plan(clean_plan("Theirs"))["plan_id"]
    assert api.get(f"/plans/{mine}").status_code == 404
    assert api.plan(theirs)["name"] == "Theirs"


# --- History: completed runs before the plan, from synced activities


def add_activity(db: DbSession, user: User, offset: int, distance_m: int, type_: str) -> None:
    account = db.scalar(select(DataSourceAccount).where(DataSourceAccount.user_id == user.id))
    if account is None:
        account = DataSourceAccount(id=uuid.uuid4(), user_id=user.id, provider="garmin")
        db.add(account)
        db.flush()
    started = datetime.combine(day(offset), time(7), tzinfo=UTC)
    db.add(
        Activity(
            id=uuid.uuid4(),
            user_id=user.id,
            data_source_account_id=account.id,
            provider="garmin",
            source_id=str(uuid.uuid4()),
            started_at=started,
            local_date=day(offset),
            type=type_,
            distance_m=distance_m,
            duration_s=distance_m // 3,
            raw={},
        )
    )
    db.commit()


def spike_findings(api: Api) -> list[str]:
    """Severities of LONG_RUN_SPIKE Findings for a 15 km long run on day 5, alone in its plan."""
    result = api.import_plan(plan_file(week(20, MONDAY, run(day(5), "long", 15000))))
    return [f["severity"] for f in result["findings"] if f["rule_code"] == LONG_RUN_SPIKE]


def test_with_no_activities_the_first_long_run_is_a_warning(api: Api) -> None:
    assert spike_findings(api) == ["warning"]


def test_a_recent_run_before_the_plan_is_history(api: Api, db: DbSession, owner: User) -> None:
    add_activity(db, owner, -2, 14000, "running")
    assert spike_findings(api) == []


def test_a_short_run_in_history_turns_a_big_long_run_into_an_error(
    api: Api, db: DbSession, owner: User
) -> None:
    add_activity(db, owner, -2, 8000, "running")
    assert spike_findings(api) == ["error"]


@pytest.mark.parametrize("type_", ["cycling", "trail_running", "Running"])
def test_activities_of_other_types_are_not_history(
    api: Api, db: DbSession, owner: User, type_: str
) -> None:
    add_activity(db, owner, -2, 30000, type_)
    assert spike_findings(api) == ["warning"]


def test_an_activity_on_the_first_planned_day_is_not_history(
    api: Api, db: DbSession, owner: User
) -> None:
    add_activity(db, owner, 5, 30000, "running")
    assert spike_findings(api) == ["warning"]


def test_another_users_runs_are_not_history(api: Api, db: DbSession, other: User) -> None:
    add_activity(db, other, -2, 30000, "running")
    assert spike_findings(api) == ["warning"]
