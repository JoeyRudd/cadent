# ADR 004: Postgres for jobs and locking, no Redis

Status: Accepted (2026-10-16)

## Context

The sync worker must never run two syncs for the same user at once.

## Decision

The worker is the API image run with a different command. Postgres advisory locks guarantee one sync per user.

## Alternatives considered

Redis with a task queue; Celery.

## Consequences

One fewer service to run and back up. Throughput is far beyond what a few users need.
