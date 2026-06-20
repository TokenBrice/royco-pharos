# Contributing

This repo is a local-first prototype, so changes should stay small, inspectable, and grounded in the current docs.

## Start Here

1. Read `README.md` for the product surface and routes.
2. Read `docs/architecture.md` before changing data flow, persistence, or request handling.
3. Read `docs/operations.md` before running syncs or touching local data.
4. Read `docs/scoring.md` before changing scoring, methodology, grades, or copy about risk.
5. Use `docs/change-map.md` to find the files and checks that belong to your change type.

## Setup

```bash
npm install
npm run sync
npm run status
npm run dev
```

The default sync uses local fixtures. Live Royco or Pharos reads are opt-in through `.env.local`; never commit real keys or local env files.

## Definition of Done

A change is ready when:

- The implementation is scoped to the requested behavior.
- Docs are updated when commands, routes, scoring, data flow, or operator behavior changes.
- Local data files, build outputs, secrets, and generated reports are not included.
- The verification command set that matches the change has passed or the failure is documented.

## Verification Matrix

| Change type | Minimum checks |
| --- | --- |
| Docs only | Review links, commands, and stale wording. |
| TypeScript/domain logic | `npm run typecheck && npm run test` |
| UI or route rendering | `npm run verify` |
| Sync, persistence, or API shape | `npm run sync && npm run status && npm run verify` |
| Scoring or methodology | `npm run calibrate && npm run sync && npm run status && npm run verify` |

`npm run verify` runs typecheck, tests, and the Next.js build.

## Local Data

- Default DB: `data/roycopharos.db`.
- DB files and WAL/SHM files are ignored and should not be committed.
- Do not delete the local DB unless a reset is explicitly needed, usually after a schema change not covered by migration code.
- If you reset local data, mention it in your handoff.

## Scoring Changes

Scoring changes require extra care:

- Preserve the current invariants in `docs/scoring.md`.
- Keep `/methodology` rendered from the same constants the scoring engine uses.
- Bump `METHODOLOGY_VERSION` when output interpretation changes.
- Update tests and run calibration.
- Do not launder missing data into confident grades.

## Product Voice

RoycoPharos should read like a sober risk desk:

- Precise, honest, calm.
- Verdict first, evidence second.
- Uncertainty states are first-class.
- No financial advice, principal-protection claims, or APY guarantees.
