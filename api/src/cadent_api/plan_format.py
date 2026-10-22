"""The cadent.plan/v1 import format: a plan file, checked here, then converted to core Runs."""

from datetime import date, timedelta
from itertools import pairwise
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, PositiveInt, model_validator

from cadent_core.models import Run, RunType

Zone = Annotated[str, Field(pattern=r"^z[1-5]$")]
PaceRange = tuple[PositiveInt, PositiveInt]


class Strict(BaseModel):
    """Unknown fields are an error, so a typo never silently drops part of a plan."""

    model_config = ConfigDict(extra="forbid")


class Race(Strict):
    date: date
    distance_m: PositiveInt
    goal_time_s: PositiveInt | None = None


class Extra(Strict):
    """Something added after the run, such as strides."""

    type: str
    reps: PositiveInt | tuple[PositiveInt, PositiveInt] | None = None
    duration_s: PositiveInt | None = None


class Block(Strict):
    """One part of a structured run, such as the warm-up or the main set."""

    label: str
    reps: PositiveInt | None = None
    distance_m: PositiveInt | None = None
    duration_s: PositiveInt | None = None
    recovery_s: PositiveInt | None = None
    zone: Zone | None = None
    pace_s_per_km: PaceRange | None = None
    hr_ceiling: PositiveInt | None = None


class RunSession(Strict):
    kind: Literal["run"]
    date: date
    type: RunType
    distance_m: PositiveInt
    zone: Zone | None = None
    pace_s_per_km: PaceRange | None = None
    duration_s: PositiveInt | None = None
    extras: list[Extra] = Field(default_factory=list[Extra])
    blocks: list[Block] = Field(default_factory=list[Block])


class LiftSession(Strict):
    kind: Literal["lift"]
    date: date
    name: str
    after_run: bool = False


class Week(Strict):
    index: int
    start: date
    phase: str | None = None
    cutback: bool = False
    sessions: list[Annotated[RunSession | LiftSession, Field(discriminator="kind")]]

    @model_validator(mode="after")
    def sessions_fall_in_the_week(self) -> Self:
        end = self.start + timedelta(days=6)
        for s in self.sessions:
            if not self.start <= s.date <= end:
                raise ValueError(f"session on {s.date} is outside week {self.index}")
        return self


class PlanFile(Strict):
    schema_: Literal["cadent.plan/v1"] = Field(alias="schema")
    name: str
    race: Race | None = None
    zones: dict[str, tuple[int, int]] = Field(default_factory=dict[str, tuple[int, int]])
    settings: dict[str, int | str] = Field(default_factory=dict[str, int | str])
    weeks: list[Week]

    @model_validator(mode="after")
    def weeks_do_not_overlap(self) -> Self:
        """So every day belongs to at most one week, and each Finding to exactly one."""
        indexes = [w.index for w in self.weeks]
        if len(set(indexes)) != len(indexes):
            raise ValueError("week indexes must be unique")
        starts = sorted(w.start for w in self.weeks)
        if any(later - earlier < timedelta(days=7) for earlier, later in pairwise(starts)):
            raise ValueError("weeks must not overlap")
        return self


def week_containing(weeks: list[Week], day: date) -> int:
    """The index of the week a day falls in. A day before every week counts toward the first."""
    started = [w for w in weeks if w.start <= day] or [min(weeks, key=lambda w: w.start)]
    return max(started, key=lambda w: w.start).index


def to_runs(plan: PlanFile) -> list[Run]:
    """The plan's runs as core Runs, for the rules engine. Lifts are skipped."""
    return [
        Run(day=s.date, distance_m=s.distance_m, type=s.type)
        for w in plan.weeks
        for s in w.sessions
        if isinstance(s, RunSession)
    ]
