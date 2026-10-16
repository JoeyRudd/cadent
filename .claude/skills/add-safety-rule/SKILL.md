---
name: add-safety-rule
description: Add a new training-plan safety rule to the rules engine, test-first. Use when adding or changing a rule in core/rules/.
---
# Add a safety rule

Follow these steps in order. Do not write the rule before its tests fail.

1. Name the rule with an upper-case code, e.g. `WEEKLY_JUMP`, and confirm its threshold and severity with Joey.
2. Add example tests to `core/tests/test_rules.py` under a `# --- CODE:` heading:
   a passing case, a failing case, the exact boundary, an empty history, and the exemption if any.
3. Add a property test to `core/tests/test_rules_properties.py` stating the invariant the rule guarantees.
4. Run `make test-core` and confirm the new tests FAIL.
5. Create `core/src/cadent_core/rules/<code_lower>.py` following `long_run_spike.py`:
   a module docstring stating the rule, constants for code and thresholds, and one `check(plan, history)` generator.
6. Register `check` in `RULES` in `core/src/cadent_core/rules/__init__.py`.
7. Run `make check`. All green.
8. Add the rule to the rules table in the spec's Plans & safety tab and to `docs/glossary.md` if it introduces a term.
9. Ask the `safety-auditor` subagent to review the diff.
