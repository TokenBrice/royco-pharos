# Change Map

Use this map before editing. It lists the likely files, docs, and checks for common work in RoycoPharos.

## Scoring or Methodology

Inspect or edit:

- `src/lib/roycopharos/scoring.ts`
- `src/lib/roycopharos/scoring.test.ts`
- `scripts/calibrate.ts`
- `src/app/methodology/page.tsx`
- `docs/scoring.md`
- `docs/api.md` if response fields change

Run:

```bash
npm run calibrate
npm run sync
npm run status
npm run verify
```

Rules:

- Bump `METHODOLOGY_VERSION` when score meaning changes.
- Keep methodology display derived from scoring constants.
- Preserve `NR`, `low_confidence`, verbatim Pharos vault inputs, and tranche-specific Senior/Junior behavior.

## Sync, Ingestion, or Data Modes

Inspect or edit:

- `scripts/sync.ts`
- `scripts/status.ts`
- `src/lib/roycopharos/sync-runner.ts`
- `src/lib/roycopharos/royco-dawn.ts`
- `src/lib/roycopharos/pharos-client.ts`
- `src/lib/roycopharos/http.ts`
- `src/lib/roycopharos/mappings.ts`
- `docs/operations.md`
- `docs/architecture.md`

Run:

```bash
npm run sync
npm run status
npm run verify
```

Rules:

- Upstream calls belong in sync, not request handlers.
- Preserve lock behavior and last-known-good publish protection.
- Keep fixture mode usable without network or keys.

## SQLite Schema, Repository Reads, or History

Inspect or edit:

- `src/lib/roycopharos/schema.ts`
- `src/lib/roycopharos/sqlite.ts`
- `src/lib/roycopharos/repository.ts`
- `src/lib/roycopharos/types.ts`
- `docs/architecture.md`
- `docs/operations.md`
- `docs/api.md` if payloads change

Run:

```bash
npm run sync
npm run status
npm run verify
```

Rules:

- UI and API routes should read through `repository.ts`.
- History should be observed data, one point per published sync.
- If a local DB reset is needed, say so in the handoff.

## API Routes

Inspect or edit:

- `src/app/api/**/route.ts`
- `src/lib/roycopharos/repository.ts`
- `src/lib/roycopharos/types.ts`
- `docs/api.md`

Run:

```bash
npm run verify
```

Add `npm run sync && npm run status` when the route depends on newly written data.

Rules:

- Return `_meta` on data routes unless there is a clear reason not to.
- Keep cache headers intentional.
- URL-encode `marketKey` and `trancheId` examples because they contain `:`.

## UI Pages or Components

Inspect or edit:

- `src/app/page.tsx`
- `src/app/markets/[marketKey]/page.tsx`
- `src/app/methodology/page.tsx`
- `src/components/roycopharos/`
- `src/app/globals.css`
- Relevant `*.module.css`
- `PRODUCT.md` for voice and design principles

Run:

```bash
npm run verify
```

Use browser or screenshot checks for layout, chart, or interaction changes.

Rules:

- Reuse existing grade/status components and semantic tokens.
- Keep uncertainty visible and labeled.
- Do not imply financial advice or guarantees.

## Token Mapping or Exposure Taxonomy

Inspect or edit:

- `src/lib/roycopharos/mappings.ts`
- `src/lib/roycopharos/mappings.test.ts`
- `src/lib/roycopharos/exposure.ts`
- `src/lib/roycopharos/royco-dawn.ts` if live parsing changes
- `docs/architecture.md`
- `docs/scoring.md` if score behavior changes

Run:

```bash
npm run typecheck
npm run test
```

Add `npm run sync && npm run status` when mappings affect published rows.

Rules:

- `(chainId, address)` is authoritative.
- Known symbol on unexpected same-chain address is a conflict.
- Unknown exposure should remain visible as unknown, not guessed.

## Docs or Agent Guidance

Inspect or edit:

- `README.md`
- `docs/`
- `AGENTS.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`

Run:

```bash
rg -n "TO""DO|T""BD|FIX""ME|royco-opportunity-v0\\.""1|PENALTY_""TABLES" README.md docs AGENTS.md CLAUDE.md CONTRIBUTING.md
rg -n "[^\\x00-\\x7F]" README.md docs AGENTS.md CLAUDE.md CONTRIBUTING.md
```

Rules:

- Keep docs concise and source-file grounded.
- Update docs when behavior, commands, env vars, routes, or score interpretation changes.
- Treat `agents/` as historical context unless a task explicitly targets it.
