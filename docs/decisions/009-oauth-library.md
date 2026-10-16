# ADR 009: OAuth via an established library, chosen by a spike

Status: Accepted (2026-10-16)

## Context

MCP connectors need an OAuth 2.1 authorization server. Auth is security-critical and complex.

## Decision

Spend up to three days in week 1 getting one real MCP client to sign in to a toy FastAPI app, then pick the library that worked.

## Alternatives considered

Hand-rolled OAuth.

## Consequences

The riskiest unknown is settled first. The chosen library is recorded in an update to this ADR.
