# RoycoPharos — Review & Follow-up Plan

Reviewed 2026-06-14 against `pharos-watch/agents/RoycoPharos.md` (the finalized spec).

## Verdict

A strong, faithful prototype. The **scoring engine is 1:1 with the spec** and well-tested, the **UI is complete and on-message**, the **schema is comprehensive and D1-portable**, and `typecheck` + 9 vitest cases pass clean. The gap is scope, not quality: it's a **fixtures-only demo**, and the **SQLite DB is write-only — the read path (`buildSnapshot()`) bypasses it**, so the entire reliability model is unexercised. Two of Phase 1's three pillars (live Royco ingestion, live Pharos client) are absent.

## What's solid (keep)

- **Scoring** (`scoring.ts`): every penalty table matches the spec exactly (status/coverage/utilization/TVL, Junior baseline 18, drawdown, venue, access, withdrawal, redemption delay); higher=safer; grade A–F; `nr` only on missing underlying score / invalid side; `low_confidence` on missing non-fatal fields. 9 tests cover the key branches incl. zero/negative APY scoreable and per-tranche unmapped→NR.
- **Schema** (`schema.ts`): all 9 spec tables incl. WAD columns; uses built-in `node:sqlite` (D1-portable).
- **UI**: overview + KPIs + watchlist, market detail (Senior/Junior compare, charts, inline underlying summary handling **two underlyings per market**), mandatory risk panels with the three-part score split (`Underlying Pharos Safety Score` / `Royco tranche adjustment` / `Royco Opportunity Score`), `methodology`, "Protection mode" copy, baseline disclaimer.
- **README** is honest about deferred boundaries.

## P0 — core deliverables still missing

1. **Live Royco ingestion.** Build the copy-and-adapt of `worker/src/cron/yield-sync/royco-dawn.ts`: `POST dawn.royco.org/api/v1/market/explore`, paginate beyond 100, **strip the YI filters** (`MAX_APY_RATIO=2`, `MIN_TRANCHE_TVL=100k`, `MIN_MARKET_TVL=100k`, `apy<=0`, `listingType!=="verified"`, drop-untracked-deposit-token). Replace the synthetic markets ("Mixed Underlying Test Market", "…Incomplete Telemetry", "…Zero Yield Window") with a **recorded real Dawn fixture** + a live mode behind env.
2. **Pharos client.** Implement the `X-API-Key` fetch for `/api/stablecoins` + `/api/report-cards`; populate `pharos_underlying_summaries` + `pharos_api_cache`; honor `X-Data-Age` and stale-if-error. **Note:** `README.md` and `.env.example` already advertise this path, but no code exists — build it, or correct the docs until it does.
3. **Read from the DB, not fixtures.** Point the API/UI read path at the published SQLite snapshot instead of recomputing `buildSnapshot()` per request. This is what *activates* run-fencing, publish-latest, and last-known-good — all currently decorative. Until then, none of the spec's reliability exit-criteria are actually met.

## P1 — correctness / spec fidelity

4. **Real freshness.** `buildApiMeta()` fabricates ages (`now-180`, `now-420`, `inputHash:"sha256-fixture"`). Wire to real `collected_at`/`fetched_at`/`published_at` once reads come from the DB.
5. **Loss-order module (spec-required).** Market detail has Senior-vs-Junior + "Current Junior buffer" but not the explicit loss waterfall: Junior-absorbs-first → Senior exposure threshold → current drawdown, in consistent units. Add it.
6. **candidate-write → validate → publish.** `seedDatabase()` does a destructive DELETE+INSERT in one txn (atomic but not validated-publish). Add the validation gate (e.g. `<18 tranches` ⇒ keep prior snapshot, mark run degraded) once real ingestion lands.
7. **History endpoint.** `?days=` is clamped but ignored; history is a 5-point synthetic curve. Query `royco_*_history` with the day window.

## P2 — polish

8. **applied-penalty reconciliation.** Per-row `appliedPenalty` drains sequentially off the *unrounded* underlying score, while the headline adjustment uses the *rounded* score — the breakdown can fail to sum to the displayed `-adjustment`. Reconcile.
9. **Decimals.** `seedDatabase` hardcodes deposit/share decimals = 18; use the real value (eEARN is 6).
10. **Sort vs copy.** Overview claims "grade, coverage headroom, utilization, freshness" but sorts score-desc → coverage-headroom only. Add the util/freshness tiebreakers or fix the copy.
11. **Infra hygiene.** No `git init`; no indexes beyond PKs (add history indexes before scaling); `generateStaticParams` + `force-dynamic` on market pages is contradictory (harmless).
12. **Calibration gate.** Unblocked only once live data exists; tune v0.1 weights before any external display.

## Suggested order

P0-1 (record fixture + live Royco) → P0-3 (DB read path) → P0-2 (Pharos client) → P1-4/6/7 (freshness, publish-gate, history) → P1-5 (loss-order UI) → P2 → calibration. P0-3 is the highest-leverage single change: it turns the existing (good) schema from decoration into the actual product surface.
