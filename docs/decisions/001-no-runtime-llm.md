# ADR 001: No LLM calls at runtime

Status: Accepted (2026-10-16)

## Context

Analysis of training data benefits from an AI, but paying for tokens on behalf of every user is not sustainable for a self-hosted, free project.

## Decision

The app is fully deterministic. AI analysis happens only through the MCP server, using each user's own AI subscription.

## Alternatives considered

Calling the Claude API from the app (operator pays per user); a hosted AI feature behind a paywall.

## Consequences

Zero AI cost for operators. AI features are limited to what an MCP client can do with read-only tools and draft submission.
