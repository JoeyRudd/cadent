"""Plan import and audit: save a plan file as a draft with its Findings, then activate it."""

import json
import uuid
from collections.abc import Sequence
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from cadent_api.db import get_db
from cadent_api.plan_format import PlanFile, RunSession, to_runs, week_containing
from cadent_api.users import current_user
from cadent_core.models import Run, RunType, Severity
from cadent_core.rules import validate
from cadent_db.models import Activity, Plan, PlanWeek, RuleFinding, User
from cadent_db.models import Session as PlannedSession

router = APIRouter(prefix="/plans")
Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(current_user)]


class FromRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class FindingOut(FromRow):
    id: uuid.UUID
    rule_code: str
    severity: Severity
    day: date
    week_index: int
    message: str
    accepted: bool


class SessionOut(FromRow):
    id: uuid.UUID
    date: date
    type: RunType
    distance_m: int
    pace_min_s: int | None
    pace_max_s: int | None
    hr_zone: int | None
    notes: str | None


class WeekOut(FromRow):
    index: int
    phase: str | None
    is_cutback: bool
    sessions: list[SessionOut]


class PlanOut(FromRow):
    id: uuid.UUID
    name: str
    status: str
    race_date: date | None
    race_distance_m: int | None
    weeks: list[WeekOut]
    findings: list[FindingOut]


class ImportResult(BaseModel):
    plan_id: uuid.UUID
    findings: list[FindingOut]
    skipped_lifts: int


class Acceptance(BaseModel):
    confirm: str | None = None


def history(db: Session, user_id: uuid.UUID, before: date) -> list[Run]:
    """Completed runs from synced activities before the plan starts.

    Only Garmin's "running" type counts: an unknown type is left out, which makes the rules
    stricter, never looser. Garmin sync may widen this once its types are known."""
    activities = db.scalars(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.local_date < before,
            Activity.type == "running",
        )
    )
    return [Run(day=a.local_date, distance_m=a.distance_m, type=RunType.EASY) for a in activities]


def session_row(user_id: uuid.UUID, week_id: uuid.UUID, s: RunSession) -> PlannedSession:
    """A run as a sessions row. What has no column of its own is kept in notes as JSON."""
    rest = s.model_dump(mode="json", include={"duration_s", "extras", "blocks"}, exclude_none=True)
    rest = {k: v for k, v in rest.items() if v}
    pace = s.pace_s_per_km
    return PlannedSession(
        id=uuid.uuid4(),
        user_id=user_id,
        plan_week_id=week_id,
        date=s.date,
        type=s.type,
        distance_m=s.distance_m,
        pace_min_s=pace[0] if pace else None,
        pace_max_s=pace[1] if pace else None,
        hr_zone=int(s.zone[1:]) if s.zone else None,
        notes=json.dumps(rest) if rest else None,
    )


def plan_rows(
    plan: PlanFile, user_id: uuid.UUID, plan_id: uuid.UUID
) -> tuple[list[PlanWeek], list[PlannedSession]]:
    """The plan's weeks, and its run sessions as rows. Lifts are not stored yet."""
    weeks: list[PlanWeek] = []
    sessions: list[PlannedSession] = []
    for w in plan.weeks:
        week = PlanWeek(
            id=uuid.uuid4(),
            user_id=user_id,
            plan_id=plan_id,
            index=w.index,
            phase=w.phase,
            is_cutback=w.cutback,
        )
        weeks.append(week)
        runs = (s for s in w.sessions if isinstance(s, RunSession))
        sessions.extend(session_row(user_id, week.id, s) for s in runs)
    return weeks, sessions


def owned_plan(db: Session, user: User, plan_id: uuid.UUID) -> Plan:
    plan = db.scalar(select(Plan).where(Plan.id == plan_id, Plan.user_id == user.id))
    if plan is None:
        raise HTTPException(404, "Plan not found.")
    return plan


def findings_of(db: Session, user: User, plan_id: uuid.UUID) -> Sequence[RuleFinding]:
    return db.scalars(
        select(RuleFinding)
        .where(RuleFinding.plan_id == plan_id, RuleFinding.user_id == user.id)
        .order_by(RuleFinding.day, RuleFinding.rule_code)
    ).all()


@router.post("/import")
def import_plan(plan: PlanFile, db: Db, user: CurrentUser) -> ImportResult:
    """Validate a plan file with the rules engine and save it as a draft with its Findings."""
    runs = to_runs(plan)
    past = history(db, user.id, min(r.day for r in runs)) if runs else []
    row = Plan(
        id=uuid.uuid4(),
        user_id=user.id,
        name=plan.name,
        race_date=plan.race.date if plan.race else None,
        race_distance_m=plan.race.distance_m if plan.race else None,
        source="imported",
        status="draft",
    )
    findings = [
        RuleFinding(
            id=uuid.uuid4(),
            user_id=user.id,
            plan_id=row.id,
            week_index=week_containing(plan.weeks, f.day),
            rule_code=f.code,
            severity=f.severity,
            day=f.day,
            message=f.message,
            accepted=False,
        )
        for f in validate(runs, past)
    ]
    weeks, sessions = plan_rows(plan, user.id, row.id)
    # No relationship() links these tables, so the ORM does not order the inserts: parents first.
    db.add(row)
    db.flush()
    db.add_all(weeks)
    db.flush()
    db.add_all([*sessions, *findings])
    db.commit()
    return ImportResult(
        plan_id=row.id,
        findings=[FindingOut.model_validate(f) for f in findings],
        skipped_lifts=sum(not isinstance(s, RunSession) for w in plan.weeks for s in w.sessions),
    )


@router.get("/{plan_id}")
def get_plan(plan_id: uuid.UUID, db: Db, user: CurrentUser) -> PlanOut:
    """The audit report: the plan with its weeks, sessions and Findings."""
    plan = owned_plan(db, user, plan_id)
    weeks = db.scalars(
        select(PlanWeek)
        .where(PlanWeek.plan_id == plan.id, PlanWeek.user_id == user.id)
        .order_by(PlanWeek.index)
    ).all()
    sessions = db.scalars(
        select(PlannedSession)
        .where(
            PlannedSession.plan_week_id.in_([w.id for w in weeks]),
            PlannedSession.user_id == user.id,
        )
        .order_by(PlannedSession.date)
    ).all()
    return PlanOut(
        id=plan.id,
        name=plan.name,
        status=plan.status,
        race_date=plan.race_date,
        race_distance_m=plan.race_distance_m,
        weeks=[
            WeekOut(
                index=w.index,
                phase=w.phase,
                is_cutback=w.is_cutback,
                sessions=[SessionOut.model_validate(s) for s in sessions if s.plan_week_id == w.id],
            )
            for w in weeks
        ],
        findings=[FindingOut.model_validate(f) for f in findings_of(db, user, plan.id)],
    )


@router.post("/{plan_id}/findings/{finding_id}/accept")
def accept_finding(
    plan_id: uuid.UUID,
    finding_id: uuid.UUID,
    db: Db,
    user: CurrentUser,
    body: Acceptance | None = None,
) -> FindingOut:
    """Accept one Finding. An Error needs its rule code typed back as confirmation."""
    finding = db.scalar(
        select(RuleFinding).where(
            RuleFinding.id == finding_id,
            RuleFinding.plan_id == plan_id,
            RuleFinding.user_id == user.id,
        )
    )
    if finding is None:
        raise HTTPException(404, "Finding not found.")
    confirm = body.confirm if body else None
    if finding.severity == Severity.ERROR and confirm != finding.rule_code:
        raise HTTPException(422, f"Type {finding.rule_code} to accept this Error.")
    finding.accepted = True
    db.commit()
    return FindingOut.model_validate(finding)


@router.post("/{plan_id}/activate")
def activate_plan(plan_id: uuid.UUID, db: Db, user: CurrentUser) -> PlanOut:
    """Make this the active plan once every Finding is accepted; the previous one is archived."""
    plan = owned_plan(db, user, plan_id)
    if any(not f.accepted for f in findings_of(db, user, plan.id)):
        raise HTTPException(409, "Accept every Finding before activating this plan.")
    db.execute(
        update(Plan)
        .where(Plan.user_id == user.id, Plan.status == "active", Plan.id != plan.id)
        .values(status="archived")
    )
    plan.status = "active"
    db.commit()
    return get_plan(plan.id, db, user)
