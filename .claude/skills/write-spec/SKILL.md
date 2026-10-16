---
name: write-spec
description: Interview Joey and write specs/<feature>.md before building a feature. Use at the start of any non-trivial feature (anything bigger than a one-sentence diff).
---
# Write a spec

The spec is written before any code. Do not plan or implement in the same session.

1. Read `docs/roadmap.md`, the matching tab of the "Cadent — Project Spec" doc, `docs/glossary.md` and the ADRs the feature touches.
2. Interview Joey, one question at a time, until each section below can be filled without guessing:
   the goal, the files and interfaces touched, what is out of scope, how it is tested, and how to see it working.
3. Write `specs/<feature>.md` using the template below. Use glossary names, metres and seconds.
4. List anything still undecided under "Open questions" instead of choosing for Joey.
   A new structural choice is proposed as an ADR in `docs/decisions/`, never assumed.
5. Show Joey the spec and stop. Planning happens in a fresh session in plan mode.

```markdown
# <Feature>

Week <n> (see docs/roadmap.md). Outcome: <one sentence>.

## Goal

## Files and interfaces

## Out of scope

## Acceptance

- [ ] <behaviour a test proves>

## End-to-end check

<What Joey does in the running app to see it work.>

## Open questions
```
