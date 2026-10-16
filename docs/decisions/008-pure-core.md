# ADR 008: Pure core with no I/O

Status: Accepted (2026-10-16)

## Context

Safety logic must be fast and certain to test.

## Decision

core/ performs no database, network, file or clock access; dates are passed in. import-linter enforces it in CI.

## Alternatives considered

Logic inside routes and the worker.

## Consequences

Deterministic, millisecond tests, including property tests, for the code that matters most.
