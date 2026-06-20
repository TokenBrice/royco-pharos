# Repo-Wide Hardening Audit Plan

Date: 2026-06-20

Scope: broad post-launch audit for GitHub, Cloudflare Workers, D1, custom domain production serving, local SQLite parity, scoring correctness, API/UI behavior, tests, docs, and project hygiene.

Inputs reviewed:

- Repository docs: `AGENTS.md`, `README.md`, `PRODUCT.md`, `docs/*`, `CONTRIBUTING.md`
- Runtime/config: `wrangler.jsonc`, `wrangler.sync.jsonc`, `open-next.config.ts`, `next.config.ts`, GitHub workflows
- Core code: `src/lib/roycopharos/*`, `workers/sync.ts`, `scripts/*`, API routes, app pages, UI components
- External references checked: Cloudflare D1 limits, D1 Worker API, Workers Logs docs
- Parallel subagent slices: domain/scoring/persistence, Cloudflare/D1/runtime, UI/API, CI/docs/hygiene

Verification observed during audit:

- `npm run test` passed: 24 tests.
- `npm audit --omit=dev --json` was clean for runtime dependencies.
- Cloudflare web/sync Wrangler dry-runs were reported passing by the Cloudflare audit slice.

## P0 - Production Correctness And Data Safety

These should be fixed before treating the Cloudflare deployment as confidently production-hardened.

### 1. Fail Closed On Fixture Or Unsafe Fallback Publishing In Production

- **Problem:** Production sync can publish fixture-derived data if live Royco fails or if `PHAROS_API_KEY` is missing.
- **Evidence:** `wrangler.sync.jsonc:14` sets production live mode, but `src/lib/roycopharos/royco-dawn.ts:88` falls back to recorded fixtures on live failure, `src/lib/roycopharos/pharos-client.ts:37` uses fixtures without a real key, and `src/lib/roycopharos/d1-sync.ts:53` publishes the resulting snapshot.
- **Implementation tasks:**
  - Add an explicit production policy in `d1-sync.ts`: fixture mode cannot publish when `ENVIRONMENT=production` unless `ALLOW_FIXTURE_PUBLISH=1`.
  - Mark fixture, stale-if-error, and live-fetch-failed candidates as degraded in sync metadata.
  - If a prior good snapshot exists, hold the prior snapshot instead of publishing fixture fallback.
  - Keep fixture-first behavior for local development.
- **Tests/checks:**
  - D1 fake test where Royco live fails and prior snapshot exists: `published: false`.
  - D1 fake test where `PHAROS_API_KEY` is absent in production: `published: false`.
  - Local sync fixture mode still publishes on first boot.

### 2. Stop Live Pharos Missing Data From Falling Back To Static Fixtures

- **Problem:** Live Pharos report-card gaps can silently become computed fixture scores, bypassing the intended `NR` path.
- **Evidence:** `src/lib/roycopharos/pharos-client.ts:154` falls back to `UNDERLYING_FIXTURES` for missing `overallScore` / `overallGrade`; scoring expects missing Pharos Safety Score to produce `NR` in `src/lib/roycopharos/scoring.ts:223`; docs require `NR` in `docs/scoring.md:164`.
- **Implementation tasks:**
  - In live mode, use live fields only for score and grade unless a bounded cached value is explicitly selected.
  - Preserve fixture fallback only for fixture mode, not for partial live payloads.
  - Include a warning when a required Pharos ID is absent from live stablecoins/report cards.
- **Tests/checks:**
  - Live Pharos fixture with missing report card produces `underlyingSafetyScore: null`.
  - Tranche backed by that ID becomes `scoreStatus: "nr"`.
  - Methodology invariant test for missing Pharos score remains explicit.

### 3. Bound Stale-If-Error And Preserve True Pharos Freshness

- **Problem:** Any cached Pharos data is accepted on fetch failure, and `pharosFetchedAt` is forced to `now`, making stale data look fresh.
- **Evidence:** `STALE_IF_ERROR_SECONDS` exists at `src/lib/roycopharos/pharos-client.ts:8`, but fallback underlyings are accepted unbounded at `src/lib/roycopharos/pharos-client.ts:61`; `src/lib/roycopharos/sync-runner.ts:84` and `src/lib/roycopharos/d1-sync.ts:44` force `pharosFetchedAt` to at least `now`.
- **Implementation tasks:**
  - Enforce `staleIfErrorUntil` or an equivalent age limit before accepting cached Pharos data.
  - Compute `pharosFetchedAt` from actual underlying/cache timestamps only.
  - Decide and document behavior for expired cached data: block publish when prior good exists, or publish degraded/`stale` only on first boot.
  - Surface warning/error code in `royco_sync_runs.metadata_json`.
- **Tests/checks:**
  - Expired cached Pharos data does not produce fresh `_meta.pharos`.
  - Stale-if-error within the allowed window is marked degraded/stale visibly.

### 4. Add Distributed Sync Locking And Publish Generation Guards For Workers

- **Problem:** Cloudflare cron and manual POST sync can overlap; older syncs can commit last.
- **Evidence:** local sync has a lock in `src/lib/roycopharos/sync-runner.ts:49`, but `workers/sync.ts:26` and `workers/sync.ts:38` run without a distributed lock.
- **Implementation tasks:**
  - Add a D1 `sync_locks` table with owner, started_at, expires_at, and TTL stealing, or introduce a Durable Object single-flight guard.
  - Require publish to check that `snapshot.generatedAt` is not older than the current published run.
  - Return a distinct skipped/locked result for concurrent manual sync.
- **Tests/checks:**
  - Two simulated D1 syncs cannot both publish.
  - Older generated snapshot is rejected if a newer published run exists.

### 5. Make D1 Publish/Read Respect Platform Limits

- **Problem:** D1 reads and writes assume the dataset stays tiny.
- **Evidence:** `src/lib/roycopharos/sql-read.ts:260` builds one `OR` query with `2 * marketCount + 1` params; `src/lib/roycopharos/sql-read.ts:306` builds one `IN (...)` query with `trancheCount + 1` params. Cloudflare documents 100 bound parameters per query and 50/1000 queries per Worker invocation depending on plan. `src/lib/roycopharos/d1-publish.ts:35` builds one large batch; the current 9-market/18-tranche snapshot already creates about 108 statements.
- **Implementation tasks:**
  - Chunk history reads under the 100-bound-parameter limit.
  - Reduce D1 publish statement count with multi-row insert builders where practical.
  - Consider a materialized `published_snapshots` JSON row plus pointer table for hot read paths, keeping normalized tables for history/debugging.
  - Add query-count/statement-count assertions to tests.
- **Tests/checks:**
  - Synthetic 60-market/120-tranche snapshot reads without exceeding parameter limits.
  - Publish path enforces statement chunking or materialized snapshot strategy.

### 6. Record Failed Sync Attempts Outside The Destructive Publish Batch

- **Problem:** If D1 batch publish fails, the sync-run row is rolled back with the rest of the publish.
- **Evidence:** `src/lib/roycopharos/d1-publish.ts:35` puts run recording and destructive replacement into the same D1 batch.
- **Implementation tasks:**
  - Record sync attempt start before publish.
  - On publish failure, update/insert a failed run row with error code and message.
  - Preserve last-known-good rows if the publish fails midway.
- **Tests/checks:**
  - Fake D1 batch failure leaves prior data intact and records failed run metadata.

### 7. Make Calibration Fail CI When Anchors Fail

- **Problem:** `npm run calibrate` can print failed anchors and still exit successfully.
- **Evidence:** `scripts/calibrate.ts:120` increments `failures`; `scripts/calibrate.ts:174` only prints the result. `docs/change-map.md:18` treats calibration as a scoring/data gate.
- **Implementation tasks:**
  - Set `process.exitCode = failures === 0 ? 0 : 1`.
  - Add a test wrapper or injectable check fixture proving failures exit non-zero.
- **Tests/checks:**
  - `npm run calibrate` remains green on current fixtures.
  - Forced failing anchor returns non-zero in test.

### 8. Add Post-Deploy Health Gates

- **Problem:** Deployment automation does not enforce the runbook’s health gate.
- **Evidence:** `docs/deployment.md:103` requires initial sync and `/api/health`; `.github/workflows/deploy.yml:36` only typechecks/tests/deploys.
- **Implementation tasks:**
  - Add post-deploy smoke checks for staging and production.
  - Fail deploy unless `/api/health` returns JSON with `ok: true`.
  - For first production deploy, document and automate the initial sync trigger path.
- **Tests/checks:**
  - Workflow includes environment URL input or derived endpoint.
  - Smoke script validates JSON shape, not just HTTP 200.

## P1 - Hardening, Simplification, And Parity

### 9. Give API Routes First-Class Error Contracts

- **Problem:** Missing snapshots currently throw through repository calls, including health.
- **Evidence:** `src/lib/roycopharos/repository.ts:6` throws when D1 snapshot is unavailable; `/api/health` calls `getHealth()` directly in `src/app/api/health/route.ts:4`.
- **Implementation tasks:**
  - Add shared API response helpers for JSON errors and cache headers.
  - Return `503 { error: "snapshot_unavailable" }` for data routes when no production snapshot exists.
  - Make `/api/health` tolerate missing snapshots with `ok: false`, `degraded: true`, and `503`.
  - Document error responses in `docs/api.md`.
- **Tests/checks:**
  - Route-handler tests for success, 404, invalid `days`, and snapshot unavailable.

### 10. Enforce Cloudflare Binding Types In CI

- **Problem:** Worker bindings are cast or hand-written rather than generated and checked.
- **Evidence:** `package.json:24` has `cf:types`, `src/cloudflare-env.d.ts` is ignored in `.gitignore:6`, CI does not run type generation, `src/lib/roycopharos/d1.ts:23` casts env, and `src/lib/roycopharos/d1-sync.ts:11` hand-writes sync env.
- **Implementation tasks:**
  - Run `npm run cf:types` before typecheck in CI.
  - Include generated types in `tsconfig.json`, either as checked-in generated file or CI-generated artifact.
  - Type Worker exports with `satisfies ExportedHandler<CloudflareEnv>`.
  - Remove avoidable D1 env casts.
- **Tests/checks:**
  - Binding rename in Wrangler config breaks typecheck.

### 11. Make Manual Sync Non-Blocking And Timing-Safe

- **Problem:** Manual sync awaits the full upstream sync request and compares bearer tokens directly.
- **Evidence:** `workers/sync.ts:20` compares `authorization` to `Bearer ${env.SYNC_ADMIN_TOKEN}`; `workers/sync.ts:47` awaits `runRoycoPharosD1Sync`; Pharos 429 handling can wait in `src/lib/roycopharos/pharos-client.ts:91`.
- **Implementation tasks:**
  - Add `ctx` to `fetch` and return `202` after enqueuing/manual `ctx.waitUntil()` work.
  - Protect manual sync with the distributed lock from P0.
  - Compare fixed-size token hashes using Web Crypto timing-safe comparison semantics.
  - Return current/accepted run id where possible.
- **Tests/checks:**
  - Unauthorized, accepted, and already-running manual sync responses.

### 12. Fix Fresh-Clone Local Sync Lock Directory Handling

- **Problem:** Fresh clone sync can be skipped because the DB directory does not exist before lock creation.
- **Evidence:** lock opens at `src/lib/roycopharos/sync-runner.ts:19`; DB directory is created later at `src/lib/roycopharos/sqlite.ts:37`.
- **Implementation tasks:**
  - Create `dirname(databasePath())` before lock open.
  - Treat `ENOENT` distinctly from “lock held.”
- **Tests/checks:**
  - Temp missing DB directory sync creates directory and does not return skipped.

### 13. Centralize Publish Validation And SQL Hydration

- **Problem:** SQLite and D1 have duplicated validation, publish, and read hydration logic.
- **Evidence:** validation is duplicated at `src/lib/roycopharos/sqlite.ts:421` and `src/lib/roycopharos/d1-publish.ts:354`; hydration is duplicated at `src/lib/roycopharos/sqlite.ts:439` and `src/lib/roycopharos/sql-read.ts:38`.
- **Implementation tasks:**
  - Extract `validateCandidate()` to a shared module with tests.
  - Make local SQLite reads use the generic `SqlReader` path.
  - Extract row/statement builders for publish paths.
  - Keep D1-specific batching/chunking isolated.
- **Tests/checks:**
  - SQLite and D1 fake publish tests cover the same validation cases.
  - Round-trip temp SQLite read equals generic SQL reader output.

### 14. Make Royco Parse Drops Observable

- **Problem:** malformed live Royco markets/tranches are dropped without a count.
- **Evidence:** live parse uses `flatMap` at `src/lib/roycopharos/royco-dawn.ts:131`; malformed entries return `null` around `src/lib/roycopharos/royco-dawn.ts:175`; persistence writes `parse_error_count` as `0` in `src/lib/roycopharos/sqlite.ts:120`.
- **Implementation tasks:**
  - Return parse drop counts and warning summaries from `loadRoycoDawnMarkets()`.
  - Persist real `parse_error_count` in SQLite and D1.
  - Include parse warnings in sync metadata and health.
- **Tests/checks:**
  - Fixture with malformed market increments parse_error_count.

### 15. Tighten Missing Royco Field Semantics

- **Problem:** missing non-fatal Royco fields do not consistently produce `low_confidence`.
- **Evidence:** docs require this at `docs/scoring.md:161`; missing drawdown is treated as no penalty at `src/lib/roycopharos/scoring.ts:420`; venue `unknown` marks missing but not low-confidence at `src/lib/roycopharos/scoring.ts:438`; no-positive APY can still be `computed` around `src/lib/roycopharos/scoring.ts:535`.
- **Implementation tasks:**
  - Define which missing fields trigger `low_confidence`, `stale`, or `NR`.
  - Apply consistently for drawdown, venue, APY, and friction fields.
  - Update methodology/docs if output interpretation changes.
- **Tests/checks:**
  - Focused scoring tests for each missing-field rule.
  - Run `npm run calibrate`; bump `METHODOLOGY_VERSION` if grade interpretation changes.

### 16. Add Targeted Repository Reads For API Hot Paths

- **Problem:** some API routes over-read the full snapshot.
- **Evidence:** history route loads full snapshot plus history at `src/app/api/history/tranche/[trancheId]/route.ts:10`; local SQLite snapshot reads market history per market at `src/lib/roycopharos/sqlite.ts:519`.
- **Implementation tasks:**
  - Add `getApiMeta()`, `getTrancheHistoryWithMeta()`, and targeted `getMarketByKey()` SQL paths.
  - Use batched local market-history reads like `sql-read.ts`.
  - Keep UI/API contracts unchanged.
- **Tests/checks:**
  - Route tests prove `_meta` still present without full snapshot hydration.

### 17. Normalize Snapshot Health And Flag Derivation

- **Problem:** status/flag derivation is duplicated and can drift.
- **Evidence:** homepage counts start at `src/app/page.tsx:106`; health counts are in `src/lib/roycopharos/repository.ts:54`; overview row flags start at `src/components/roycopharos/overview-table.tsx:51`; `DataBadge` treats `conflict` as watch at `src/components/roycopharos/badges.tsx:35` while other surfaces treat conflicts as hard flags.
- **Implementation tasks:**
  - Add shared `deriveSnapshotHealth()` and `classifyTrancheFlags()` helpers.
  - Centralize badge tone mapping for `conflict`, `stale`, `NR`, `low_confidence`, and `unmapped`.
  - Use helpers in homepage, health, overview table, and API health.
- **Tests/checks:**
  - Unit tests for each flag state and combined snapshot tone.

### 18. Load Local CLI Env Or Correct The Docs

- **Problem:** docs recommend `.env.local` for standalone `tsx` scripts, but scripts read `process.env` directly.
- **Evidence:** docs say `.env.local` in `docs/operations.md:44` and `README.md:21`; scripts run directly through `scripts/sync.ts:6`; env reads are in `src/lib/roycopharos/royco-dawn.ts:76` and `src/lib/roycopharos/pharos-client.ts:37`.
- **Implementation tasks:**
  - Either load `.env.local` via `@next/env` in CLI entry points, or revise docs to require inline/exported env vars.
  - Prefer one shared CLI bootstrap if loading env.
- **Tests/checks:**
  - CLI env-loading test or explicit docs sanity update.

### 19. Update Deployment Boundary Docs

- **Problem:** docs disagree about whether Cloudflare/D1/cron are implemented.
- **Evidence:** `README.md:54` says Cloudflare/D1/Worker cron are deferred; `docs/README.md:42` says Worker cron and D1 sync writes are outside boundary; `docs/deployment.md:131` says they are implemented; `docs/operations.md:172` says production migrations do not exist.
- **Implementation tasks:**
  - Make `docs/deployment.md` the source of truth for production deployment.
  - Update README, docs README, operations, and contributing to distinguish local-first development from deployed Cloudflare production.
  - Remove stale “deferred” wording for implemented infra.
- **Tests/checks:**
  - Link and command review only.

## P2 - UI Accessibility, Polish, And Ongoing Hygiene

### 20. Restore Keyboard Access To Scatter Chart Markets

- **Problem:** most scatter marker links are removed from keyboard tab order, and the fallback table has no links.
- **Evidence:** markers are links at `src/components/roycopharos/opportunity-scatter.tsx:176`, most get `tabIndex={-1}` at `src/components/roycopharos/opportunity-scatter.tsx:182`, and fallback table starts at `src/components/roycopharos/opportunity-scatter.tsx:262` without links.
- **Implementation tasks:**
  - Add roving tabindex with arrow navigation, or make all markers/fallback rows linkable.
  - Keep highlighted decision points easy to reach.
- **Tests/checks:**
  - Accessibility/component test for keyboard navigation to every visible market.

### 21. Honor Reduced Motion For Live Freshness Text

- **Problem:** ticking freshness text still updates every second under reduced motion.
- **Evidence:** product promise is in `PRODUCT.md:36`; interval is started in `src/components/roycopharos/relative-time.tsx:25`.
- **Implementation tasks:**
  - Detect `prefers-reduced-motion: reduce` and render static age, or update at a much slower non-animated cadence.
  - Keep SSR hydration stable.
- **Tests/checks:**
  - Component test that no interval is created when reduced motion is active.

### 22. Harden Overview Ledger ARIA Semantics

- **Problem:** desktop ledger uses ARIA table roles with irregular summary rows.
- **Evidence:** `role="table"` at `src/components/roycopharos/overview-table.tsx:234`, five column headers at `src/components/roycopharos/overview-table.tsx:236`, summary row has one cell at `src/components/roycopharos/overview-table.tsx:246`.
- **Implementation tasks:**
  - Add `aria-colspan={5}` if supported enough for the target, or switch desktop ledger to a real table.
  - Keep mobile cards separate.
- **Tests/checks:**
  - Accessibility tree/snapshot check for table semantics.

### 23. Increase Mobile Touch Targets

- **Problem:** several touch controls are below 44px.
- **Evidence:** overview segmented buttons are 34px at `src/components/roycopharos/overview-table.module.css:36`; focus filters are 30px at `src/components/roycopharos/overview-table.module.css:99`; scatter filters are 30px at `src/app/globals.css:635`.
- **Implementation tasks:**
  - Add coarse-pointer media rules with min-height/padding for segmented and pill filters.
- **Tests/checks:**
  - Mobile screenshot/interaction pass.

### 24. Decide What To Do With Generated `.impeccable` Reports

- **Problem:** generated critique reports are tracked and not consistently ignored.
- **Evidence:** AGENTS says reports should not be committed; `.gitignore` ignores common reports but not `.impeccable/critique/`; tracked critique reports exist under `.impeccable/critique/`.
- **Implementation tasks:**
  - Decide whether `.impeccable/design.json` is canonical.
  - Ignore `.impeccable/critique/` and remove tracked generated reports, or move curated reports into `docs/` with stable names.
- **Tests/checks:**
  - `git status --ignored` sanity check after ignore update.

### 25. Automate Runtime Dependency Audit

- **Problem:** runtime audit is documented but not automated.
- **Evidence:** `docs/operations.md:136` includes `npm audit --omit=dev`; `package.json:12` `verify` omits it; `.github/workflows/ci.yml:25` omits it.
- **Implementation tasks:**
  - Add `audit:runtime` script.
  - Run it in CI after `npm ci`, or document why it remains manual.
- **Tests/checks:**
  - CI passes with current clean audit.

### 26. Remove Unused Web Worker Upstream Vars

- **Problem:** web Worker config carries upstream read vars even though request handlers should not fetch live upstream.
- **Evidence:** `wrangler.jsonc:18` includes `ROYCO_DAWN_LIVE` and `PHAROS_API_BASE` for the web Worker.
- **Implementation tasks:**
  - Keep upstream vars only in `wrangler.sync.jsonc` unless OpenNext build/runtime truly needs them.
  - Keep `ROYCOPHAROS_STORAGE=d1` on web Worker.
- **Tests/checks:**
  - `npm run build:worker` and Wrangler dry-run.

### 27. Reconcile Local Fixture Seeding With No-Snapshot UI

- **Problem:** homepage has a no-snapshot branch that local repository behavior usually makes unreachable.
- **Evidence:** homepage branch at `src/app/page.tsx:90`; local repository seeds fixtures at `src/lib/roycopharos/repository.ts:13`; API docs say routes read latest published SQLite snapshot at `docs/api.md:5`.
- **Implementation tasks:**
  - Decide whether automatic local fixture seeding is part of the contract.
  - If yes, expose seeded fixture mode in health/meta/docs.
  - If no, remove unreachable UI or stop auto-seeding.
- **Tests/checks:**
  - Local fresh DB behavior documented and tested.

## Suggested Sequencing

1. P0 data safety: tasks 1-4.
2. P0 D1 limits and failed-run visibility: tasks 5-6.
3. CI/deploy gates: tasks 7-8.
4. API/runtime hardening: tasks 9-12.
5. Shared persistence/read cleanup: tasks 13-17.
6. Docs/env/hygiene: tasks 18-19 and 24-26.
7. UI accessibility polish: tasks 20-23 and 27.

## Verification Matrix For The Full Hardening Pass

Run after P0/P1 implementation:

```bash
npm run calibrate
npm run sync
npm run status
npm run typecheck
npm run test
npm run build
npm run build:worker
npx wrangler deploy --dry-run --env=""
npx wrangler deploy --config wrangler.sync.jsonc --dry-run --env=""
npm audit --omit=dev
```

For Cloudflare behavior, add staging smoke checks:

```bash
curl -fsS "https://<staging-host>/api/health"
curl -fsS "https://<staging-host>/api/tranches"
curl -fsS "https://<staging-host>/api/markets"
```

The smoke script should parse JSON and fail unless `/api/health` reports `ok: true` after a successful staging sync.
