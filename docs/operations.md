# Operations

## Prerequisites

- Node `>=24 <27`
- npm
- A local checkout with dependencies installed

Install dependencies:

```bash
npm install
```

## Quick Start

```bash
npm run sync
npm run status
npm run dev
```

Then open `http://localhost:3000`.

The default sync uses recorded Royco Dawn fixture data and recorded Pharos fixture data. It does not require network access or an API key.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build the standalone Next.js app. |
| `npm run start` | Start a production Next.js server after build. |
| `npm run typecheck` | Run TypeScript with `--noEmit`. |
| `npm run test` | Run Vitest tests. |
| `npm run sync` | Load Royco and Pharos data, score, and publish a SQLite snapshot. |
| `npm run sync:royco` | Refresh Royco data while reusing cached Pharos data or fixtures. |
| `npm run sync:pharos` | Refresh Pharos data against the recorded Royco fixture market set. |
| `npm run status` | Print health, freshness, counts, last sync run, and DB path. |
| `npm run calibrate` | Score the full pull without writing the DB and print calibration checks. Exits non-zero if any anchor fails. |
| `npm run audit:runtime` | Run `npm audit --omit=dev` for runtime dependency exposure. |
| `npm run smoke:health -- <url>` | Verify a deployed `/api/health` response is JSON and reports `ok: true`. |

## Environment Variables

Standalone CLI scripts run through `tsx` and read `process.env` directly. Use inline or exported shell variables for `npm run sync`, `npm run status`, and `npm run calibrate`. `.env.local` is still useful for Next.js local app/runtime behavior, but it is not loaded automatically by these CLI scripts.

| Variable | Default | Effect |
| --- | --- | --- |
| `ROYCO_DAWN_LIVE` | unset or `0` | Set to `1` to fetch live Royco Dawn market data. |
| `ROYCO_DAWN_FIXTURE_PATH` | unset | Load a Dawn response or normalized fixture from disk. Takes precedence over live. |
| `PHAROS_API_KEY` | unset or placeholder | Enables live Pharos reads when set to a real `ph_live_...` key. |
| `PHAROS_API_BASE` | `https://api.pharos.watch` | Overrides the Pharos API host. |
| `ROYCOPHAROS_DB_PATH` | `data/roycopharos.db` | Overrides the SQLite database path. |

Full live sync:

```bash
ROYCO_DAWN_LIVE=1 PHAROS_API_KEY=ph_live_... npm run sync
```

Fixture-file sync:

```bash
ROYCO_DAWN_FIXTURE_PATH=data/fixtures/dawn-live.json npm run sync
```

Temporary isolated DB:

```bash
ROYCOPHAROS_DB_PATH=/tmp/roycopharos.db npm run sync
```

If you prefer a local env file for CLI work, source it in your shell before running commands:

```bash
set -a
. ./.env.local
set +a
npm run sync
```

## What Sync Does

`npm run sync`:

1. Acquires a `.sync.lock` next to the database. If another sync is running, the new one exits with `status: "skipped"`.
2. Loads Royco market and tranche data.
3. Resolves deposit tokens to Pharos stablecoin IDs.
4. Loads Pharos underlying summaries for mapped IDs.
5. Scores every tranche with the current methodology.
6. Writes a sync-run row.
7. Publishes the candidate only if validation passes.
8. Appends one market and tranche history observation per published sync.
9. Prunes history older than 30 days.

A stale lock older than 10 minutes is treated as abandoned and can be stolen.

## Publish Rules

When a prior published snapshot exists:

| Candidate | Publish? | Reason |
| --- | --- | --- |
| 18 or more tranches and at least one computed score | Yes | Candidate passes the local completeness floor. |
| Fewer than 18 tranches | No | `candidate_tranche_count_below_floor` |
| All tranches `NR` | No | `candidate_all_nr` |
| Empty candidate | No | `candidate_empty` |

On first boot, a partial non-empty candidate can publish with `bootstrap_below_floor` so the app has a local surface to serve.

## Reading Status

Run:

```bash
npm run status
```

Important fields:

| Field | Meaning |
| --- | --- |
| `ok` | `true` when the published snapshot has at least 18 tranches. |
| `degraded` | `true` when the latest run degraded or freshness is not fully fresh. |
| `marketCount` / `trancheCount` | Published snapshot size. |
| `mappedTrancheCount` | Tranches mapped to a Pharos stablecoin ID. |
| `conflictCount` | Deposit-token mappings with suspicious symbol/address mismatch. |
| `nrCount` | Tranches with no rating, usually missing underlying Pharos score or invalid side. |
| `lowConfidenceCount` | Tranches scored with missing non-fatal Royco fields. |
| `staleCount` | Tranches marked stale. |
| `freshness.royco` | Royco source freshness. Fresh threshold is 15 minutes. |
| `freshness.pharos` | Pharos source freshness. Fresh threshold is 60 minutes. |
| `freshness.score` | Computed score freshness. |
| `lastRun` | Most recent sync run summary, including publish state and error code. |
| `dbPath` | SQLite path used by the process. |

## Verification Before Shipping Changes

For most code changes:

```bash
npm run typecheck
npm run test
```

For a broader local health pass:

```bash
npm run typecheck
npm run test
npm run build
npm run audit:runtime
```

`npm run audit:runtime` should remain clean for runtime dependencies. The project currently pins vulnerable transitive runtime packages with npm `overrides` only when the owning package has not shipped a safe direct version.

For scoring, data-shape, or methodology changes:

```bash
npm run calibrate
npm run sync
npm run status
npm run typecheck
npm run test
```

For Next.js or UI changes:

```bash
npm run build
```

## Resetting Local Data

If a local schema change is not covered by the lightweight migration in `sqlite.ts`, delete the DB and re-sync:

```bash
rm data/roycopharos.db
npm run sync
```

Do this only for local development data.

Production schema changes are handled through Cloudflare D1 migrations in `migrations/` and the commands documented in [Deployment](./deployment.md). Do not reset a remote D1 database as a substitute for a migration.

## Cloudflare Runtime Checks

The web Worker serves the Next.js app and reads D1 when `ROYCOPHAROS_STORAGE=d1`. It does not carry Royco or Pharos upstream read variables; those belong to the sync Worker in `wrangler.sync.jsonc`.

Post-deploy health is checked with:

```bash
npm run smoke:health -- https://royco.pharos.watch
```

The smoke command appends `/api/health` when given a host URL, requires a JSON response, and fails unless the response includes `ok: true`.

## Local Artifact Hygiene

Generated data and diagnostics should stay local:

- `data/*.db`, WAL/SHM files, `.next`, `node_modules`, `test-results`, `.impeccable/critique/`, `*.tsbuildinfo`, and root-level screenshot PNGs are ignored.
- Keep `.env.local` local. Commit only `.env.example`.
- Prefer `npm run status` over opening the SQLite DB for routine health checks; it exercises the same repository path the UI and API routes use.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| UI says no snapshot exists | Run `npm run sync`, then `npm run status`. |
| Sync returns `skipped` | Another sync lock is active. Wait, or inspect `<db-dir>/.sync.lock` if the prior process crashed. |
| Candidate does not publish | Check `lastRun.errorCode` in `npm run status`. The prior published snapshot should still be served. |
| Everything is `NR` | Check Pharos mode, `PHAROS_API_KEY`, mapping conflicts, and `nrReason` in `/api/tranches`. |
| Pharos live mode degrades | The client falls back only to cached underlyings still inside the stale-if-error window; otherwise fixture mode is recorded and production D1 publishing is held unless explicitly allowed. Check `lastRun` in `npm run status` and the latest `royco_sync_runs.metadata_json` row. |
| Live Royco mode returns fewer rows | Confirm Dawn response shape with `ROYCO_DAWN_FIXTURE_PATH` and inspect parse drops. |
| History charts look short | History is real observed data. A fresh DB has only one point per sync. |
