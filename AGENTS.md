# AGENTS.md

Guidance for AI agents working in this repository.

## Project Snapshot

RoycoPharos is a local-first Next.js prototype for rating direct Royco Dawn tranches. It reads Royco Dawn market/tranche data, maps deposit tokens to Pharos stablecoin IDs, reads Pharos base-asset safety data, computes Royco Safety and Opportunity grades, publishes a SQLite snapshot, then serves UI and API routes from the published DB rows.

Primary docs:

- `docs/README.md` for the documentation map.
- `docs/architecture.md` for sync/read paths and persistence.
- `docs/operations.md` for commands, env vars, and troubleshooting.
- `docs/scoring.md` before touching scoring or methodology.
- `docs/api.md` for JSON route contracts.
- `PRODUCT.md` for product voice and UI principles.

`agents/` contains historical plans and calibration notes. Treat it as context, not the canonical operating docs.

## Tech Stack

- Next.js App Router, React, TypeScript, CSS modules plus `src/app/globals.css`.
- Node `>=24 <27`; SQLite uses Node's built-in `node:sqlite`.
- Vitest for unit tests.
- Default DB: `data/roycopharos.db`, ignored by git.

## Commands

```bash
npm install
npm run sync
npm run status
npm run dev
npm run typecheck
npm run test
npm run build
npm run calibrate
```

Use the smallest verification set that matches the change:

- Docs-only: link/content sanity checks are enough.
- Domain logic: `npm run typecheck && npm run test`.
- Scoring/methodology/data-shape: `npm run calibrate && npm run sync && npm run status && npm run typecheck && npm run test`.
- UI/app routing: `npm run typecheck && npm run build`; use browser/screenshot checks for visual changes.

## Architecture Guardrails

- Request handlers must not fetch Royco or Pharos live. Upstream reads belong in the sync path.
- UI and API routes should read through `src/lib/roycopharos/repository.ts`.
- SQLite schema and publish/read behavior live in `src/lib/roycopharos/sqlite.ts` and `schema.ts`.
- `scripts/sync.ts` is the write entry point; it calls `runRoycoPharosSync()`.
- Preserve last-known-good behavior: incomplete or all-NR candidates must not overwrite a prior good snapshot.
- History should be observed data: one point per published sync, retained for 30 days.
- Do not introduce Cloudflare/D1/Worker deployment assumptions unless the task explicitly asks for that deferred phase.

## Scoring Guardrails

Current methodology: `royco-opportunity-v0.5`.

Before changing `src/lib/roycopharos/scoring.ts`, read `docs/scoring.md` and run calibration. Preserve these invariants:

- Pharos is the vault/base-asset source of truth and is shown verbatim.
- RoycoPharos grades tranche seats independently; Senior Safety may exceed the whole-vault Pharos score only through explicit buffer credit.
- Missing underlying Pharos Safety Score is `NR`, not a silent low grade.
- Missing non-fatal Royco fields become `low_confidence` with visible uncertainty terms.
- Junior should not outrank Senior on Safety when both are rated in the same market.
- The `/methodology` page must render from the same constants the engine uses.
- Output interpretation changes require a `METHODOLOGY_VERSION` bump and updated tests.

## Data and Secrets

- Default mode is fixture-first. Live modes are opt-in through `.env.local`.
- Never commit `.env*` except `.env.example`.
- Never commit `data/*.db`, WAL/SHM files, `.next`, `node_modules`, reports, or `*.tsbuildinfo`.
- `ROYCO_DAWN_FIXTURE_PATH` may point at a local Dawn response or normalized fixture.
- `PHAROS_API_KEY` enables live Pharos reads; do not print or persist real keys.
- Do not delete a local DB unless the task calls for a reset or a schema change requires it; mention it if you do.

## Mapping and Exposure

- Token mapping is address-authoritative: `(chainId, depositTokenAddress)` beats symbol.
- Known symbol on an unexpected same-chain address is a conflict, not a trusted map.
- Exposure profiles in `exposure.ts` are curated reference data and should stay honest about unknowns.

## UI and Product Voice

The product should feel like a sober risk desk, not a crypto hype dashboard.

- Lead with verdicts, freshness, uncertainty, and visible evidence.
- Keep `NR`, stale, degraded, low-confidence, and conflict states first-class.
- Color is never the only signal; preserve labels/shapes and accessibility.
- Use existing components, tokens, and grade/status semantics before adding new patterns.
- Keep copy precise, calm, and explicit about limitations. Do not imply financial advice or guarantees.

## Editing Practices

- Prefer `rg`/`rg --files` for search.
- Keep changes scoped; avoid broad refactors and generated churn.
- Follow existing TypeScript and React patterns.
- Use structured APIs/parsers over ad hoc string manipulation where practical.
- Do not bypass tests by weakening types or deleting assertions.
- If docs and code disagree, inspect code first, then update docs or code so they agree.
