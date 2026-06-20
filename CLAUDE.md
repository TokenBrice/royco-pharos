# CLAUDE.md

Claude-specific quick guide. `AGENTS.md` is the canonical agent guide; this file keeps the same operating rules in a shorter form.

## Start Here

RoycoPharos is a local-first Next.js/TypeScript app that scores Royco Dawn tranches with Pharos as the base-asset safety source. Sync writes a published SQLite snapshot; UI and API routes read that snapshot.

Read as needed:

- `docs/architecture.md` for data flow and repo structure.
- `docs/operations.md` for commands and env vars.
- `docs/scoring.md` before scoring or methodology changes.
- `docs/api.md` for route contracts.
- `PRODUCT.md` for tone, product boundaries, and design principles.

## Core Commands

```bash
npm run sync
npm run status
npm run dev
npm run typecheck
npm run test
npm run build
npm run calibrate
```

Use targeted verification:

- Logic changes: `npm run typecheck && npm run test`.
- Scoring/methodology: also run `npm run calibrate`, `npm run sync`, and `npm run status`.
- UI changes: run `npm run build` and visually check when relevant.

## Non-Negotiables

- Do not fetch Royco or Pharos from request handlers. Live upstream reads belong in sync.
- Read app data through `src/lib/roycopharos/repository.ts`.
- Preserve last-known-good publish behavior in SQLite.
- Keep all 18 direct Dawn tranches visible when complete data is available.
- Do not commit secrets, `.env.local`, DB files, build output, or generated reports.
- Do not delete `data/roycopharos.db` unless a local reset is explicitly needed.

## Scoring Rules

Current methodology: `royco-opportunity-v0.2`.

Preserve:

- Pharos base-asset scores and grades are shown verbatim.
- Royco tranche risk is penalty-only; Safety cannot exceed the underlying Pharos score.
- Missing underlying Pharos score is `NR`.
- Missing non-fatal Royco fields produce `low_confidence`.
- Junior should not outrank Senior on Safety in the same market.
- `/methodology` must reflect the same constants used by `scoring.ts`.

If score meaning changes, bump `METHODOLOGY_VERSION`, update tests, and run calibration.

## Product and UI

Voice: precise, honest, calm. This is a risk desk, not a yield-hype dashboard.

- Make uncertainty visible: `NR`, stale, degraded, low-confidence, conflict.
- Lead with the verdict, then show evidence.
- Color must not be the only signal.
- Reuse existing components, grade badges, semantic CSS tokens, and chart patterns.
- Do not imply financial advice, principal protection, liquidity, APY, or redemption guarantees.

## Change Style

- Search with `rg`.
- Keep edits small and codebase-shaped.
- Prefer existing helpers and types over new abstractions.
- Update docs when behavior or commands change.
- Treat `agents/` as historical context, not the source of truth.
