# ADR 005: Unofficial Garmin library behind a DataSource interface

Status: Accepted (2026-10-16)

## Context

Garmin's official API requires business approval.

## Decision

Use python-garminconnect, pinned, behind a DataSource protocol in core.

## Alternatives considered

The official Garmin API; manual .FIT upload only.

## Consequences

Personal-use sync works today. If the library breaks, only one adapter changes, and .FIT upload remains as a fallback.
