"""Domain types shared by every layer. Distances are metres, durations seconds (SI only)."""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum


class RunType(StrEnum):
    EASY = "easy"
    LONG = "long"
    TEMPO = "tempo"
    INTERVALS = "intervals"
    RECOVERY = "recovery"
    SHAKEOUT = "shakeout"
    RACE = "race"


class Severity(StrEnum):
    WARNING = "warning"
    ERROR = "error"


@dataclass(frozen=True, slots=True)
class Run:
    """A planned or completed run on one local date."""

    day: date
    distance_m: int
    type: RunType


@dataclass(frozen=True, slots=True)
class Finding:
    """One problem the rules engine found on a planned day."""

    code: str
    severity: Severity
    day: date
    message: str
