# ADR 010: Single VPS with Docker Compose and Caddy

Status: Accepted (2026-10-16)

## Context

Hosting must be cheap and match what self-hosters will run.

## Decision

One small VPS running Docker Compose. Caddy serves the static web app and provides HTTPS. GitHub Actions builds images and deploys over SSH.

## Alternatives considered

Fly.io, Railway, Kubernetes.

## Consequences

Lowest cost and simplest to explain. No autoscaling, which this app does not need.
