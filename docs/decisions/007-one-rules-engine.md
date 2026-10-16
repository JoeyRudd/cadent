# ADR 007: One rules engine validates every plan source

Status: Accepted (2026-10-16)

## Context

Plans can be imported, generated or drafted by an AI. Each is an injury risk if unchecked.

## Decision

Every source calls cadent_core.rules.validate before a plan can become active.

## Alternatives considered

Separate checks per source.

## Consequences

One place to test, audit and protect. A new plan source cannot skip safety.
