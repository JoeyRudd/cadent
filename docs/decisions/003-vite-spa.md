# ADR 003: Vite React SPA, not Next.js

Status: Accepted (2026-10-16)

## Context

The web app is a private PWA behind a login. No page needs SEO or server rendering.

## Decision

A static single-page app built with Vite, React, TanStack Router and TanStack Query, served by Caddy.

## Alternatives considered

Next.js App Router; server-rendered HTML.

## Consequences

One static bundle, no Node server at runtime, fast builds. Every screen fetches its data from the API.
