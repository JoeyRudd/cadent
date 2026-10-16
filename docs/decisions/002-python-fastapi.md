# ADR 002: Python FastAPI backend

Status: Accepted (2026-10-16)

## Context

The backend must talk to Garmin and serve an MCP endpoint.

## Decision

Python 3.12 with FastAPI and Pydantic.

## Alternatives considered

A Node/TypeScript backend sharing types with the frontend.

## Consequences

The Garmin library and official MCP SDK are strongest in Python. Types cross to the frontend through a generated OpenAPI client instead of shared code.
