"""The rules engine. Every plan source (import, generator, AI draft) is validated here."""

from collections.abc import Callable, Iterator, Sequence

from cadent_core.models import Finding, Run
from cadent_core.rules import long_run_spike, min_run

Rule = Callable[[Sequence[Run], Sequence[Run]], Iterator[Finding]]

RULES: tuple[Rule, ...] = (long_run_spike.check, min_run.check)


def validate(plan: Sequence[Run], history: Sequence[Run]) -> list[Finding]:
    """Run every rule over a plan, given completed runs before it. Findings sorted by day."""
    findings = [finding for rule in RULES for finding in rule(plan, history)]
    return sorted(findings, key=lambda f: (f.day, f.code))
