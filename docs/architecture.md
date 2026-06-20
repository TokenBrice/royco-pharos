# Architecture

RoycoPharos has one core loop:

1. Load Royco Dawn market and tranche data.
2. Load Pharos stablecoin safety data for the mapped underlyings.
3. Build and score a candidate snapshot.
4. Publish the candidate into SQLite if it passes validation.
5. Serve UI pages and API routes from the latest published SQLite rows.

Request handlers do not call Royco or Pharos directly. Upstream reads happen in the sync path.

There are two deployed Cloudflare Workers:

- The web Worker runs the OpenNext app, reads Cloudflare D1 through the `DB` binding, and serves UI/API requests.
- The sync Worker runs cron/manual sync, reads Royco Dawn and Pharos, and publishes validated snapshots to D1.

Local development uses the same domain model with `node:sqlite` at `data/roycopharos.db`.

## Runtime Shape

| Layer | Main files | Responsibility |
| --- | --- | --- |
| App routes | `src/app/page.tsx`, `src/app/markets/[marketKey]/page.tsx`, `src/app/methodology/page.tsx` | Server-rendered overview, market detail, and methodology pages. |
| API routes | `src/app/api/**/route.ts` | JSON routes over the same repository helpers used by the UI. |
| UI components | `src/components/roycopharos/` | Tables, grade badges, charts, diagrams, risk panels, theme toggle, and formatting. |
| Repository | `src/lib/roycopharos/repository.ts` | Read-facing API for snapshots, markets, tranches, history, methodology, and health. |
| Persistence | `src/lib/roycopharos/sqlite.ts`, `src/lib/roycopharos/schema.ts` | SQLite schema, migrations, publish writes, and read hydration. |
| Snapshot model | `src/lib/roycopharos/snapshot.ts` | Builds in-memory market, tranche, watchlist, methodology, and freshness views. |
| Scoring | `src/lib/roycopharos/scoring.ts` | Royco Safety and Opportunity score engine. |
| Ingestion | `src/lib/roycopharos/royco-dawn.ts`, `src/lib/roycopharos/pharos-client.ts` | Royco Dawn and Pharos loading, with fixture fallback and live modes. |
| Mapping and exposure | `src/lib/roycopharos/mappings.ts`, `src/lib/roycopharos/exposure.ts` | Deposit-token to Pharos ID resolution and curated exposure profiles. |

## Sync Path

The CLI entry point is `scripts/sync.ts`, which calls `runRoycoPharosSync()` in `src/lib/roycopharos/sync-runner.ts`.

The sync runner:

1. Takes `<db-dir>/.sync.lock` so concurrent syncs do not race the publish step.
2. Loads Royco data unless the run is `sync:pharos`.
3. Loads Pharos data unless the run is `sync:royco`.
4. Reuses cached Pharos underlyings for Royco-only runs, falling back to fixtures if needed.
5. Calls `buildSnapshot()` to score the full candidate snapshot.
6. Calls `seedDatabase()` to record the run and publish if validation passes.

Validation currently protects the latest published snapshot from two bad candidates when a prior snapshot exists:

| Candidate state | Result |
| --- | --- |
| Fewer than 18 tranches | Not published, prior snapshot remains served, run marked `degraded`. |
| All tranches are `NR` | Not published, prior snapshot remains served, run marked `degraded`. |
| First boot with partial data | Published so the app has something to serve. |

On a successful publish, latest market/tranche/underlying/score rows are replaced, history tables receive one observed point per market and tranche, and history older than 30 days is pruned.

## Read Path

UI pages and API routes call helpers from `repository.ts`.

`getRoycoPharosSnapshot()` first tries to hydrate the latest published snapshot from SQLite with `readSnapshotFromDatabase()`. If the database has no published rows, it seeds a fixture snapshot and reads it back. This keeps local development usable after `npm install` even before a manual sync.

The main read helpers are:

| Helper | Used by |
| --- | --- |
| `getRoycoPharosSnapshot()` | Overview, API list routes, methodology route metadata. |
| `getTranches()` | Tranche consumers. |
| `getMarkets()` | Market consumers. |
| `getMarketByKey(key)` | Market detail page and market detail API route. |
| `getTrancheHistory(trancheId, days)` | Tranche history API route. |
| `getHealth()` | `/api/health` and `npm run status`. |
| `getMethodology()` | `/methodology` and `/api/methodology`. |

## Data Sources and Modes

Royco source modes:

| Mode | How to enable | Behavior |
| --- | --- | --- |
| Recorded fixture | Default | Uses `ROYCO_MARKET_FIXTURES`. No network required. |
| Fixture file | `ROYCO_DAWN_FIXTURE_PATH=path` | Reads either a normalized `RoycoMarketFixture[]` or a Dawn response with `data`. |
| Live Royco | `ROYCO_DAWN_LIVE=1` | POSTs to Dawn `market/explore`, paginates, and falls back to the recorded fixture on failure. |

Pharos source modes:

| Mode | How to enable | Behavior |
| --- | --- | --- |
| Fixture | Default or placeholder key | Uses `UNDERLYING_FIXTURES`. |
| Live Pharos | `PHAROS_API_KEY=ph_live_...` | Fetches `/api/stablecoins` and `/api/report-cards` with `X-API-Key`. |
| Stale-if-error | Live key plus failed fetch and cached data | Uses prior cached underlyings instead of failing the sync. |

In production D1 syncs (`ENVIRONMENT=production`), fixture-derived Royco or Pharos candidates are recorded as degraded sync attempts but do not replace a prior published snapshot unless `ALLOW_FIXTURE_PUBLISH=1` is explicitly set. Stale-if-error uses only cached Pharos underlyings that are still inside the bounded stale window.

## Key Invariants

- Keep all 18 direct Royco Dawn tranches visible whenever a complete candidate is available.
- Show Pharos grades and scores verbatim as vault/base-asset inputs.
- Surface Pharos DEWS and named upstream dependencies as evidence when reported; do not silently infer them when absent.
- Keep Pharos vault ratings distinct from RoycoPharos tranche Safety and Opportunity grades.
- Allow Senior Safety to exceed the whole-vault Pharos score only through explicit buffer-depth credit.
- Missing underlying Pharos Safety Score means `NR`, not a silent low grade.
- Missing non-fatal Royco fields produce `low_confidence` with uncertainty penalties.
- UI and API surfaces read the same published snapshot: SQLite locally, D1 in production.
- Freshness is explicit for Royco, Pharos, and the computed score.

## Database

The schema is defined in `src/lib/roycopharos/schema.ts` and initialized by `openDatabase()`.

The default path is `data/roycopharos.db`; override it with `ROYCOPHAROS_DB_PATH`.

Core tables:

| Table | Role |
| --- | --- |
| `royco_sync_runs` | Sync attempts, publish status, counts, metadata, and errors. |
| `royco_markets` | Latest published market rows. |
| `royco_tranches` | Latest published tranche rows. |
| `royco_market_history` | Observed market history, retained for 30 days. |
| `royco_tranche_history` | Observed tranche APY and TVL history, retained for 30 days. |
| `pharos_underlying_summaries` | Latest base-asset safety summaries. |
| `pharos_api_cache` | Pharos response cache and stale-if-error metadata. |
| `tranche_scores` | Current score outputs and penalty breakdown JSON. |
| `token_mappings` | Published mapping snapshot for deposit tokens to Pharos IDs. |

`sqlite.ts` includes a small migration for `tranche_scores` so older local DBs can absorb the v0.2 scoring columns. Schema changes that alter existing tables may still require deleting `data/roycopharos.db` and re-syncing in local development.
