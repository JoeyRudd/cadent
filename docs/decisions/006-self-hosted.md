# ADR 006: Self-hosted, multi-user-ready, signups off

Status: Accepted (2026-10-16)

## Context

Storing other people's Garmin logins on a hosted service is a security and terms risk.

## Decision

Every table is scoped by user_id and auth is real OAuth, but a fresh install has one owner account and ALLOW_SIGNUPS=false.

## Alternatives considered

A hosted SaaS; single-user code.

## Consequences

No custody of strangers' credentials, while the code shows a clean multi-tenant design.
