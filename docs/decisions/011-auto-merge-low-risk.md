# ADR 011: Auto-merge low-risk PRs after CI and a clean Claude review

Status: Proposed

## Context

Joey merges every PR by hand, which slows small web, API and docs changes. Branch protection
already requires the python, web and duplication checks and an up-to-date branch, with zero
approvals, and repo auto-merge is allowed. The claude-review job only posts inline comments and
gives no verdict a later step can read. The action skips the review when a PR changes workflow
files. Rules-engine and test changes are where an unsafe plan could get through (ADR 007).

## Decision

A split gate, run by a new `auto-merge` job in ci.yml after claude-review.

- **Low-risk PRs auto-merge.** Every changed file must match the allowlist: `web/`, `api/`,
  `docs/`, `specs/`, `README*`. A file in `docs/decisions/` or a dependency manifest or lockfile
  (`web/package.json`, `web/pnpm-lock.yaml`) still goes to Joey, as do files the allowlist
  does not name.
- **Joey merges everything else.** The job never merges a PR that touches
  `core/src/cadent_core/rules/`, `core/tests/` (including `fixtures/golden/`), `.github/` or
  `.claude/`. The allowlist covers those, and they stay named here so a later edit to it cannot
  drop them by accident.
- **Machine-readable verdict.** The review runs with `--json-schema` and returns
  `{"findings": <count>}`. claude-review.yml exposes a `verdict` job output: `clean` only when the
  action step succeeded and reports zero findings; `findings` when the count is above zero; and
  `not-reviewed` in every other case. That includes an "action skipped" result for workflow
  changes, a timeout, hitting `--max-turns` and missing output. Only `clean` can merge.
- **Who merges.** Only the `auto-merge` job. It has a job-scoped `GITHUB_TOKEN` with
  `contents: write` and `pull-requests: write`, and every other job stays read-only. It runs
  `gh pr merge --auto --squash --match-head-commit <reviewed sha>`, so a push after the review
  cannot merge unreviewed. It skips draft PRs, fork PRs and PRs labelled `hold`.
- **Local sessions still never merge.** The deny rules in `.claude/settings.json`
  (`gh pr merge`, `gh pr review`, pushes to main) stay as they are. claude-review keeps its
  read-only token and its "do not approve, push or merge" prompt.

## Alternatives considered

Joey merges everything (status quo): safest, but every one-line web or docs fix waits on him.

Auto-merge everything, safety paths included: fastest, but a change to a rule or a protected test
could merge with no human ever reading it. The hook and the test-count guard catch only blunt
weakening.

Self-review risk: an @claude PR is written by Claude and reviewed by Claude, so both can share a
blind spot. The split gate limits that risk to low-risk paths, where the deterministic gates do
most of the checking and a bad merge is cheap to revert. Claude-authored changes to rules, tests,
workflows or its own settings always reach Joey.

## Consequences

Small web, API and docs PRs merge without waiting for Joey. Safety-critical changes keep a human
merge. Auto-merge uses Joey's subscription, so a review that hits its usage limit fails closed
(`not-reviewed`). A merge made with `GITHUB_TOKEN` does not start the push-to-main CI run, so main
relies on the up-to-date branch rule. The allowlist includes `api/`, so auth and MCP code merges
without Joey unless that path is narrowed later.

## Spec change

On Joey's approval, change the "Dev workflow & quality" tab of the "Cadent — Project Spec" doc:

- Branch protection. From: "`main` requires CI to pass and Joey's approval; Claude never merges."
  To: "`main` requires CI to pass. A workflow job auto-merges low-risk PRs after a clean Claude
  review (ADR 011); Joey merges everything that touches rules, protected tests, golden fixtures,
  workflows or `.claude/`. Local Claude sessions never merge."
- Quality gates, Claude review row. Checks, from: "`code-reviewer`, plus `safety-auditor` on
  safety paths, posting inline comments". To: "`code-reviewer`, plus `safety-auditor` on safety
  paths, posting inline comments and a `clean` / `findings` / `not-reviewed` verdict". Blocks
  merge?, from: "No (advisory)". To: "Gates auto-merge on low-risk paths; advisory elsewhere".
- Related lines to keep consistent: "Deterministic checks block merges; AI review only comments."
  (Quality gates intro), the "Joey | Final review and merge" row, and step 6 of the feature
  workflow ("Joey reviews and merges"). Each becomes "Joey merges safety-path PRs; low-risk PRs
  auto-merge (ADR 011)".
