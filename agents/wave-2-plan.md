# RoycoPharos — Wave 2 Plan: "Real Data, Real Trust"

> **Status: implemented 2026-06-14.** W2-1 … W2-6 landed (git init deferred — local prototype, owner's call). See `runbook.md` and `calibration-v0.1.md`. Gates: `typecheck` clean, 16 tests pass, build clean, fresh sync publishes 18 tranches.

Author: original spec designer (review pass), 2026-06-14
Basis: re-review of the live repo against `pharos-watch/agents/RoycoPharos.md` (the finalized MVP spec) and `agents/followup-plan.md` (the first review). Upstream shapes cross-checked against the real `pharos-watch/worker/src/cron/yield-sync/royco-dawn.ts` and the Pharos `/api/stablecoins` + `/api/report-cards` handlers.

---

## 1. Verdict (what changed since `followup-plan.md`)

The first review called this a **fixtures-only demo with a write-only DB**. That is no longer true. GPT5.5 closed almost the entire P0/P1 list:

| `followup-plan.md` item | Status now | Evidence |
| --- | --- | --- |
| P0-1 Live Royco ingestion | **Done** | `royco-dawn.ts`: paginated `POST /market/explore`, `filters:[]` (YI gates stripped), fixture-file + recorded-fixture fallback. Shapes match the real `royco-dawn.ts` (`seniorVault`/`juniorVault`, `coverage.currentRatio`, `vault.tvl.tokenAmountUsd`). |
| P0-2 Pharos client | **Done** | `pharos-client.ts`: `X-API-Key` fetch of `/api/stablecoins` + `/api/report-cards`, `X-Data-Age` parsing, stale-if-error fallback. Keys match real shapes (`peggedAssets`, `cards`, `overallScore`/`overallGrade`). |
| P0-3 Read from DB, not fixtures | **Done** | `repository.ts` → `readSnapshotFromDatabase()`; UI/API read published SQLite rows. This was the highest-leverage change and it landed. |
| P1-4 Real freshness | **Done** | `readApiMeta()` derives ages from real `MAX(collected_at/fetched_at/published_at)`. |
| P1-5 Loss-order module | **Done** | Market detail renders an explicit Junior-absorbs-first → Senior-threshold → drawdown waterfall. |
| P1-6 candidate→publish gate | **Mostly** | `seedDatabase()` writes the run row, then publishes only if `tranches ≥ 18` (else keeps prior snapshot, marks `degraded`). Validation is count-only; not a true staging generation. |
| P1-7 History endpoint honors `?days=` | **Wired, but data is fake** | Route clamps `days` 1–30 and queries `royco_*_history`; **the rows it reads are synthesized, not observed** (see W2-1). |
| P2-8 Applied-penalty reconciliation | **Done** | `reconcileAppliedPenalties()` makes breakdown rows sum to the headline adjustment; test covers it. |
| P2-9 Decimals | **Done in fixtures** (`syrupUSDC`/`eEARN` = 6); **still wrong in live mode** (Dawn payload has no decimals field). |
| P2-11 Indexes | **Done** | History + sync-run indexes present. **git still uninitialized.** |

`typecheck` clean; `vitest` 10/10 green (normal/junior/coverage/utilization/low-TVL/NR/low-confidence/zero-APY/reconciliation/invalid-side). Scoring is 1:1 with the spec.

**One-line thesis for Wave 2:** the scaffolding, scoring, schema, reliability surface, and UI are correct — but the product still runs on **synthetic time and partially-guessed live fields**. Wave 2 makes the data real end-to-end and makes the result defensible for a Royco review.

---

## 2. The cohesive next wave

Six workstreams, ordered by leverage. The spine is W2-1 → W2-2 → W2-3 (make the data true and the pipeline trustworthy), then W2-4 (let a reviewer use it), then W2-5 (prove the numbers), then W2-6 (ship hygiene). W2-1 is the keystone: it converts a large amount of already-built read-path/charting/watchlist machinery from decorative to real.

---

## 3. Already done — do NOT redo (surgical guardrail)

Per repo `CLAUDE.md` (surgical changes, simplicity): leave these alone unless a task below names them.

- Scoring math and tables in `scoring.ts` — frozen at `royco-opportunity-v0.1`. Only W2-5 may change weights, and only behind a version bump.
- The three-part score split, loss-order module, risk panel, disclaimer/copy guardrails, "Protection mode" label.
- The DB read path (`readSnapshotFromDatabase`), `_meta` freshness derivation, API cache headers.
- Schema table set (only additive/removal tasks named in W2-6).

---

## 4. Workstreams

### W2-1 — Real time-series history *(keystone)*

**Problem.** `snapshot.ts:287 history()` fabricates a 5-point sine curve; `buildSnapshot()` runs it every sync and `seedDatabase()` writes it into `royco_market_history` / `royco_tranche_history`. History tables are *not* in the DELETE set, so each sync appends a fresh synthetic curve at shifting `observed_at` values → accumulating near-duplicate fake points. Every chart, the `/api/history` endpoint, and the whole watchlist ("coverage declining", "utilization rising") are built on invented trends. This directly defeats MVP user job #4 ("Has coverage or utilization deteriorated recently?").

**Fix (write-path only; the read path already queries the real tables).**

1. Delete the synthetic `history()` generator and the `history:` blocks built in `buildMarketView`/`buildTrancheView` (`snapshot.ts:104-108`, `:182-185`, `:287-292`). The snapshot stops carrying fake series.
   → verify: `buildSnapshot()` no longer returns `history` arrays; typecheck passes after the read path is repointed.
2. In `seedDatabase()` append **exactly one** observation per market and per tranche per published sync, at the real `collected_at` (bucketed to the sync, e.g. floor to the minute to make re-runs idempotent via the `observed_at` PK). Insert real current values: market coverage/required/util/limit/drawdown/total_drawdowns/status/tvl; tranche apy_current/apy_7d/tvl.
   → verify: run `npm run sync` 3× spaced; `SELECT COUNT(*), MIN(observed_at), MAX(observed_at) FROM royco_tranche_history` shows 3 distinct points per tranche, not 15 overlapping ones.
3. Repoint chart reads: `readMarketHistoryRows`/`readTrancheHistoryRows` already window correctly — confirm they render real points and degrade gracefully to a single point (sparkline of length 1) when history is thin.
   → verify: fresh DB → one point; charts show "collecting history" affordance instead of a flat fake line.
4. Retention cleanup: add a bounded delete of `observed_at < now - 30d` at end of a successful publish (spec: 30 days raw). Keep it one statement per history table.
   → verify: backdated rows beyond 30d are pruned after a sync.

**Exit:** charts and `/api/history` reflect observed values that accumulate across syncs; a single-sync DB shows one honest point, not a fabricated curve.

---

### W2-2 — Live-mode fidelity (turn `ROYCO_DAWN_LIVE=1` into correct rows)

The live clients mirror the real upstream shapes, but four field-level assumptions will silently produce wrong/empty data against the live APIs. Validate against one real pull, then fix.

1. **Record a real pull first.** With a provisioned key, capture a live Dawn `explore` response and a live `/api/stablecoins` + `/api/report-cards` response to `data/fixtures/` (headers/secrets stripped). Diff field-by-field against `royco-dawn.ts` / `pharos-client.ts`. This single artifact de-risks the rest of this workstream.
   → verify: `ROYCO_DAWN_FIXTURE_PATH=data/fixtures/dawn-live.json npm run sync` publishes ≥18 tranches with no parse drops.
2. **Decimals.** Dawn's payload has no `depositToken.decimals`; `royco-dawn.ts:213` defaults to 18, so live `eEARN`/`syrupUSDC` (6) are wrong. Resolve decimals from the authoritative `token_mappings`/a static per-address decimals map (not a hardcoded 18), or fetch on-chain once and cache.
   → verify: live-mode `syrupUSDC`/`eEARN` tranches persist `deposit_token_decimals = 6`.
3. **`apy7d` field name** is unverified upstream (`royco-dawn.ts:224` reads `vault.apy7d`). Confirm the real key from the recorded pull; if absent, set 7D APY null rather than mislabeling.
   → verify: live 7D APY matches the recorded payload or is honestly null.
4. **Report-card summary text** (`pharos-client.ts:121` reads `dimensions.dependencyRisk.detail`) is unverified. Confirm the real path for a one-line summary (the real cards expose `dimensions.<k>.score`/`.grade`); fall back cleanly.
   → verify: live underlying summaries show real text, not the "unavailable" fallback.
5. **Promote address-based mapping to authoritative.** The spec mandates chain+address resolution and an auditable `token_mappings` table; live resolution currently runs on `PHAROS_ID_BY_SYMBOL` (symbol), which the spec explicitly warns against. Make `token_mappings` (chain_id, deposit_token_address) the resolver, seed it from the signed mapping table, and keep symbol only as a last-resort `confidence:"probable"` fallback that flags `conflict` on mismatch.
   → verify: a deliberately renamed-symbol/same-address fixture still resolves `mapped`; a same-symbol/different-address one resolves `unmapped`/`conflict`.
6. **Supply math.** `pharos-client.ts:178 supplyUsd()` sums all `circulating` buckets; confirm this isn't double-counting peg buckets vs USD value.
   → verify: live `supply_usd` is within tolerance of the Pharos UI figure for one known asset.

**Exit:** a live run (`ROYCO_DAWN_LIVE=1` + real key) produces rows whose decimals, 7D APY, summaries, mappings, and supply match the recorded real payloads.

---

### W2-3 — Reliability hardening (the Phase-1 robustness items never built)

The pipeline works on the happy path but lacks the spec's failure controls.

1. **Sync no-overlap lock.** Two `npm run sync` (or a future cron + manual) can race the destructive DELETE+INSERT. Add an advisory lock (a `sync_locks` row or `BEGIN IMMEDIATE` held + lock-file) so a second sync exits fast.
   → verify: two concurrent syncs → one publishes, one no-ops with a clear message; DB not corrupted.
2. **Fetch timeouts + abort.** `royco-dawn.ts` and `pharos-client.ts` `fetch()` calls have no timeout/`AbortController`; a hung upstream hangs the sync. Add per-request timeouts and abort.
   → verify: a stubbed slow endpoint aborts within the timeout and falls back to last-known-good.
3. **429 / Retry-After backoff.** Pharos self-serve is 30 RPM; honor `Retry-After` with bounded ret/backoff before falling to stale-if-error.
   → verify: a stubbed 429 with `Retry-After` triggers one backoff then succeeds; repeated 429s degrade, not crash.
4. **Real candidate→validate→publish.** Replace count-only validation with a generation/shadow approach: write candidate rows tagged by `royco_run_id`, validate (expected market set present, no parse_error spike, no all-NR collapse), then atomically flip "published" pointer. Failed validation leaves the prior published generation intact and records why.
   → verify: a candidate missing a known market is rejected; prior snapshot still served; run row shows `degraded` + reason.
5. **Telemetry.** Surface degraded/stale/failure counters and last-good age in `/api/health` and `npm run status` (currently health reports counts but not failure/degradation reasons). Add structured logs in the sync path.
   → verify: after a forced degraded sync, `/api/health` reports `published:false`-equivalent state and the reason.

**Exit:** upstream slowness, rate-limits, and partial failures never overwrite good data or hang the sync, and the operator can see it happened.

---

### W2-4 — Product depth (make it usable in a Royco review)

The UI is on-message but read-only and static. Close the gap between the overview's promises and its behavior.

1. **Interactive overview controls (spec-listed, currently absent).** Add Senior/Junior segmented control, chain/status/underlying/grade/watchlist filters, and sort controls (opportunity grade, coverage headroom, utilization, APY, TVL). Client-side over the already-served snapshot; no new endpoints.
   → verify: each control narrows/reorders the 18 rows; default remains risk-first (grade → coverage → utilization → freshness).
2. **Fix sort-vs-copy drift** (old P2-10): the documented multi-key sort now actually exists via the controls.
   → verify: documented sort options all function.
3. **"Why Junior pays more" depth (user job #2).** On market detail, pair the APY spread (Junior − Senior) against the first-loss baseline + utilization penalty delta, so the extra yield is visibly the price of first-loss risk.
   → verify: each market shows the APY spread and the corresponding extra Junior penalty side by side.
4. **Real change-feed (depends on W2-1).** Recompute the watchlist from real prior-vs-current deltas (coverage headroom declining, utilization rising, status worsened, drawdown increased, underlying grade changed) instead of absolute thresholds.
   → verify: a market whose coverage fell between two syncs appears in "what changed"; a stably-low-but-flat one does not.
5. **States & ergonomics.** Add genuine empty/error states (no DB, no Pharos data, zero markets), and address the dense table's mobile horizontal-scroll friction.
   → verify: with an empty DB the UI renders a "no published snapshot" state, not a crash.

**Exit:** a reviewer can filter/sort/compare all 18 tranches, see why Junior pays more, and see real recent deterioration — without reading raw data.

---

### W2-5 — Calibration & trust gate (the spec's pre-display gate)

Spec Phase 2 blocks external display on a calibration pass; it has never run because real data didn't exist until now.

1. **Calibration harness.** A script that scores the full recorded/live pull and emits a ranking table (every tranche: underlying score, raw/applied penalty, opportunity score+grade, top penalty drivers) for human review.
   → verify: `npm run calibrate` prints a sortable 18-row table + per-factor contribution summary.
2. **Sanity review + tune.** Eyeball for inversions (e.g., a critical market out-ranking a normal one; Junior ever scoring ≥ its Senior). Tune v0.1 weights only if a defensible inversion exists; otherwise record "no change, weights validated."
   → verify: a written calibration note in `agents/` records findings and the decision.
3. **Version + provenance.** Any weight change bumps `METHODOLOGY_VERSION`; the methodology page and `tranche_scores.methodology_version` reflect it; golden tests updated.
   → verify: tests pin the chosen weights; version string propagates to UI + DB.
4. **Methodology page from code constants.** Derive the penalty tables on `/methodology` from the actual scoring constants (single source of truth) so the page can never drift from `scoring.ts`.
   → verify: changing a weight changes the methodology page without separate edits.

**Exit:** a recorded calibration sign-off exists; the displayed weights are the calibrated ones; methodology and code cannot diverge.

---

### W2-6 — Ops & hygiene

1. **`git init` + first commit** with the existing `.gitignore` (no VCS exists today — a real gap for a deliverable). Then conventional commits per workstream.
   → verify: `git log` shows an initial import; `data/*.db` and `.env*` ignored.
2. **Prune or populate decorative schema.** `coverage_wad`/`utilization_wad`/`protection_*`/`accounting_state`/`ydm_state` are never written (real Dawn gives ratios). Either drop them or wire them if the recorded pull exposes them. Default: drop the unused WAD/protection columns to match real ingestion (surgical, removes confusion).
   → verify: schema columns all have a writer, or are removed; typecheck/tests green.
3. **Runbook.** A short `agents/runbook.md`: sync cadence, env flags, live vs fixture, degraded-state interpretation, retention. (Bridges toward the deferred Phase 4 Cloudflare port without doing it.)
   → verify: a new operator can run a live sync and read `/api/health` from the runbook alone.

**Exit:** versioned repo, no decorative schema, an operator runbook.

---

## 5. Execution order & dependencies

```
W2-1 (real history) ──┬──► W2-4.4 (real change-feed)
                      └──► W2-5 (calibration uses real series for context)
W2-2 (live fidelity) ──► W2-5 (calibrate on correct live data)
W2-3 (reliability) ── independent, can parallel W2-2
W2-4 (UI depth, except .4) ── independent, can parallel W2-2/W2-3
W2-6 (git first!) ── do W2-6.1 immediately, rest last
```

Recommended sequence: **W2-6.1 (git) → W2-1 → W2-2 → W2-3 → W2-4 → W2-5 → W2-6.2/.3.** W2-1 first because it unlocks the change-feed and gives calibration real context; W2-2 before W2-5 so calibration runs on correct fields.

Suggested execution: small subagents per workstream are reasonable (each is independently verifiable), but **W2-1 and W2-2 touch the same sync/snapshot files** — run those two sequentially, not in parallel, to avoid merge churn. W2-3/W2-4 can run as parallel worktrees. Mechanical stages (recording fixtures, schema prune) suit a cheaper model; calibration judgment (W2-5.2) and live-shape diffing (W2-2.1) want a top model.

---

## 6. Decisions still needing Royco (carry forward from spec Phase 0)

Unchanged and still blocking *external* display (not local work): status-enum display approval, coverage/utilization authoritativeness for external display, `blockTimestamp` source-observed semantics, final disclaimer/branding, and the **signed per-address token-mapping table** (needed to finish W2-2.5 authoritatively). Until signed, the static address map stands in.

## 7. Test additions (gate each workstream)

- W2-1: history accumulates one point/sync (not N synthetic); 30d retention prune; single-point chart renders.
- W2-2: decimals from address map (eEARN=6); symbol-renamed/same-address still `mapped`; same-symbol/diff-address → `conflict`; recorded-pull parse drops zero rows.
- W2-3: concurrent-sync lock; fetch timeout → last-known-good; 429+Retry-After backoff; candidate missing a market is rejected and prior snapshot served.
- W2-4: filters/sort change the rendered set; empty-DB state; change-feed reflects a real coverage drop between two seeded syncs.
- W2-5: golden tests pin calibrated weights; methodology page reflects code constants.

---

## 8. What this wave deliberately still defers

Cloudflare Pages/Worker/D1 port, Worker cron, Access-gated admin POSTs, public integration API, wallet/positions/alerts, allocator look-through, dedicated tranche/underlying pages, long-term downsampled warehouse. All remain Phase 4 / non-MVP per the original spec.
