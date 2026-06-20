# RoycoPharos Docs

RoycoPharos is a local-first Next.js prototype for rating all direct Royco Dawn tranches with Pharos as the vault/base-asset risk source. Pharos supplies the whole-vault safety view, while RoycoPharos grades each Senior and Junior tranche seat independently with separate Safety and Opportunity grades.

This directory is the minimal documentation base for the repo. It is deliberately small and operational:

| Doc | Use it for |
| --- | --- |
| [Architecture](./architecture.md) | How data moves from Royco and Pharos into SQLite, then into pages and API routes. |
| [Operations](./operations.md) | How to run, sync, verify, and troubleshoot local SQLite development. |
| [Deployment](./deployment.md) | Source of truth for Cloudflare Workers, D1, GitHub Actions, and `royco.pharos.watch` setup. |
| [Scoring](./scoring.md) | The current scoring model, grade bands, status rules, and change-control expectations. |
| [API](./api.md) | Public route contracts, cache behavior, IDs, and response conventions. |
| [Change Map](./change-map.md) | Which files to inspect and which checks to run for common change types. |

## Repository Map

| Path | Purpose |
| --- | --- |
| `README.md` | Short project overview, commands, routes, and prototype boundaries. |
| `PRODUCT.md` | Product positioning, users, voice, and design principles. |
| `agents/` | Planning, calibration, and runbook notes from previous implementation waves. These are useful context, but not the canonical docs base. |
| `scripts/sync.ts` | CLI entry point for ingesting Royco and Pharos data and publishing a SQLite snapshot. |
| `scripts/status.ts` | CLI health and freshness report. |
| `scripts/calibrate.ts` | Calibration harness for scoring distributions and anchor checks. |
| `src/app/` | Next.js App Router pages and JSON route handlers. |
| `src/components/roycopharos/` | UI components, charts, indicators, and formatting helpers. |
| `src/lib/roycopharos/` | Domain model, scoring, ingestion clients, SQLite persistence, exposure taxonomy, and repository helpers. |
| `data/roycopharos.db` | Default local SQLite database. Generated and updated by sync runs. |

## Reading Order

1. Start with [Architecture](./architecture.md) to understand the shape of the system.
2. Use [Operations](./operations.md) to run the app and publish a snapshot.
3. Read [Scoring](./scoring.md) before changing methodology constants or display copy.
4. Use [Deployment](./deployment.md) when preparing Cloudflare or GitHub infrastructure.
5. Use [Change Map](./change-map.md) to scope implementation and verification.
6. Use [API](./api.md) when integrating with the JSON routes or debugging UI data.

## Current Boundary

This repo remains local-first for development, but production serving is implemented through OpenNext on Cloudflare Workers, D1 migrations, D1 read support, a scheduled D1 sync Worker, GitHub deploy workflows, and the `royco.pharos.watch` custom domain. Deployment details live in [Deployment](./deployment.md).

Access-gated admin routes, public integration keys, wallet positions, alerts, and allocator look-through are still outside the current implementation boundary.
