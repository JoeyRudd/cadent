# AI workflow: resume bullets and talking points

Notes for describing how Cadent is built. Everything here points at something in the repo; see
"How this was built" in the [README](../README.md). Add numbers only once they are measured.

## Resume bullets

- Built Cadent, a self-hosted running coach (Python/FastAPI, React, Postgres), with Claude Code as
  pair programmer inside a spec-first workflow: every feature starts as a written spec with
  acceptance tests, and 11 ADRs record the structural choices.
- Designed guardrails for AI-written code: hooks that block edits weakening protected safety tests
  and refuse to end a session while `make check` fails, plus CI gates for strict types, import
  contracts, dead code and a protected-test count floor.
- Set up an AI review and merge pipeline: a read-only Claude review returns a machine-readable
  verdict, low-risk PRs auto-merge on a clean result pinned to the reviewed commit, and changes to
  safety rules, tests, workflows or agent settings always need a human merge.

## Interview talking points

1. **Deterministic checks decide; the model advises.** The model writes and reviews code, but
   merges are gated by tests, types and import-linter. The review only counts as `clean` when the
   run succeeds and reports zero findings; a timeout, a skipped review or missing output is
   `not-reviewed`, so it fails closed.
2. **Rules the agent can't talk its way around.** CLAUDE.md says never weaken a safety test, but
   prose isn't enforcement. A PreToolUse hook blocks the edit, CI checks the test count and skips
   again, and the auto-merge allowlist sends every rules or test change to me to read and merge.
   Each layer catches what the previous one can't.
3. **Splitting trust by risk.** Claude reviewing Claude's code can share a blind spot (ADR 011
   says so). So auto-merge covers only paths where a bad merge is cheap to revert, and the rules
   engine, its tests, the workflows and `.claude/` itself always come to me.
