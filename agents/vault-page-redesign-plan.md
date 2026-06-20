# Vault Page Redesign — A Real 3-Layer Risk Stack (Pharos-led Layer 1)

Status: approved, ready to build. Scope: the market/vault page and the Pharos data layer feeding it,
with the deepest work on **Layer 1 / Base Asset (Pharos)**.

Grounded against a live `/api/report-cards` + `/api/stablecoins` capture on 2026-06-20 (see §8).
The live API is materially richer than the fixtures, and the fixtures fabricated a "DEWS" signal
that does not exist upstream. This plan is written against the **real** schema.

---

## 0. Decisions (locked 2026-06-20)

| # | Decision | Choice |
| --- | --- | --- |
| Scope | What to build | **Phase A (UI) + Phase B (data) together.** |
| Data | Pharos source | **Live `PHAROS_API_KEY` in `.env.local`.** Schema captured; build against it. |
| Peg signal | DEWS replacement | **Replace DEWS everywhere** (vault + overview + masthead) with real `pegStability` + structured depeg facts. Retire the fabricated DEWS pill/fixtures. |
| Dimensions | Layer 1 depth | **All 5 Pharos dimensions** as compact 0–100 bars + grade; `detailItems` revealed on expand/hover. |
| Fixtures | Dev/test fallback | **Full refresh from live capture + recalibrate** (real base scores + evidence), then re-run `calibrate` and update scoring tests. |
| IA | Consolidation | **As planned** — one verdict (masthead), one derivation (3-layer stack), one yield comparison (Senior-vs-Junior trimmed to APY spread / net yield, no re-grading). |
| L3 | Senior cushion credit | **Explicit `+credit` step** in the seat derivation (no scoring math change). |
| L1 | Dimension/peg form | **Band track + marker** bars (the chosen gauge form) for the 5 dimensions and the peg readout. |
| L1 | Peg arrangement | **Separate readouts** — Pharos Safety panel + peg-stability readout, then the dimension bars. |
| L1 | Source badge | **"Just Pharos"**: `Pharos · as of {age}`, no mode word in the happy path. Qualifier only when *this asset* is degraded — driven by real per-asset signals (`liveToFallbackCoins`, `collateralDriftCoins`, `liquidityStale`/`redemptionStale`, `collateralFromLive`/`dependencyFromLive`). |

---

## 1. The problem, precisely

Pharos — the product's whole reason to exist — is the weakest-presented layer, and what little it
shows is partly fabricated. On the autoUSD page in the original screenshot:

1. **The Pharos verdict is buried.** The base-asset score renders as a small grey number; the most
   important upstream input reads as a caption, not a verdict.
2. **"DEWS Normal 15" is fiction.** Pharos returns no DEWS field at all (`dews: null` on all 463
   cards; no depeg field on `/api/stablecoins`). The fixtures invented it, and the prose leaked the
   word "Fixture" into the UI. The real, *better* peg signal (`pegStability` + `rawInputs` depeg
   facts) is discarded.
3. **The detailed breakdown is thrown away.** Every card carries 5 structured dimensions
   (`pegStability`, `liquidity`, `resilience`, `decentralization`, `dependencyRisk`), each with
   score/grade/detail/detailItems. The extractor keeps exactly one field (`dependencyRisk.detail`)
   as a single sentence and drops the rest — this *is* the "detailed risk per layer" the redesign is
   meant to deliver.
4. **"Backed by" is in the wrong layer.** Upstream dependencies (and their own Pharos grades) are a
   base-asset fact but render under Layer 2 (Exposure).
5. **Pharos freshness/degradation is invisible**, even though the API reports it per-asset.
6. **The stack doesn't stack.** The number never visibly flows `Pharos → exposure → seat`, and the
   Senior cushion credit (the only sanctioned way Senior beats Pharos) is hidden inside the anchor.
7. **The grade is explained three times** (masthead, Layer 3 bar, Senior-vs-Junior).

---

## 2. Target design

### 2.1 Information architecture (what each layer owns)

| Layer | Owns | Source | Visual job |
| --- | --- | --- | --- |
| **1 — Base asset** | Pharos overall score+grade (verbatim), peg-stability + depeg facts, the **5 Pharos dimensions**, **what it's backed by** (dependency + its own Pharos grade), variant/bridge context, Pharos freshness | **Pharos**, verbatim & attributed | "What Pharos says about the asset under everything." |
| **2 — Exposure** | Strategy class, yield source, what breaks it, exit mechanics, curated exposure score + the bounded **exposure haircut** | **Royco/curated** (`exposure.ts`) | "The wrapper Royco puts around it, and the points it costs." |
| **3 — Your seat** | Per-tranche penalty bar: exposure-adjusted base → **explicit Senior cushion credit** / first-loss → seat mechanics → final Safety | **Royco scoring** | "Your specific seat and its final grade." |

Dependencies move from Layer 2 → Layer 1. Layer 2 becomes purely the Royco wrapper. The Senior
cushion credit becomes an explicit positive step in Layer 3.

### 2.2 A visible spine

A thin running-number caption under the module title, restating the number once per transition,
never re-grading:

```
 Pharos base 39  ──exposure −7──▶  32  ──seat──▶   Senior 61 · Junior 24
```

### 2.3 Layer 1 — Base Asset dossier (the centerpiece, real data)

```
┌ LAYER 1 · BASE ASSET ──────────────────────────  Pharos · as of 13m ago ┐
│  [F] autoUSD  Auto Finance autoUSD     strategy-vault on USDC · NAV token │
│                                                                           │
│  ┌ PHAROS SAFETY ┐    PEG STABILITY  93 A+                                 │
│  │   39   F      │    no active depeg · 3 events · worst −1211 bps         │
│  │  base 41      │    (yield-bearing — expected appreciation excluded)     │
│  └───────────────┘                                                        │
│                                                                           │
│  PHAROS DIMENSIONS                                          ⌄ expand all   │
│   Peg stability    93 A+  ▓▓▓▓▓▓▓▓▓░   Liquidity         3 F  ▓░░░░░░░░░   │
│   Resilience       63 C+  ▓▓▓▓▓▓░░░░   Decentralization 35 F  ▓▓▓░░░░░░░   │
│   Dependency risk  71 B   ▓▓▓▓▓▓▓░░░                                       │
│     └ expand: exit 3/100 · DEX liquidity unavailable · 0 pools …          │
│                                                                           │
│  BACKED BY                                                                 │
│   • USD Coin · USDC      100% · wrapper            Pharos 76 B+ →          │
│                                                                           │
│  SUPPLY $6.7M · bridge route: single-chain native (100)   [Open Pharos →] │
└───────────────────────────────────────────────────────────────────────────┘
```

Element specs:

- **Header attribution.** `Pharos · as of {age}`. Degraded qualifier only when this asset is in
  `liveToFallbackCoins` (`Pharos · fallback`), `collateralDriftCoins` (`Pharos · drift`), or stale
  (`Pharos · stale`). Drives from `fetchedAt`/`sourceUpdatedAt` + the captured per-asset flags.
- **Pharos Safety panel.** Large `overallScore` + `overallGrade`, "shown verbatim", with `baseScore`
  as a small secondary (`base 41`) and an `overallCapped` note when capped. `NR` when null.
- **Peg-stability readout.** `pegStability.score`+grade headline, plus the structured depeg facts
  from `rawInputs`: `activeDepeg` (bool → "no active depeg" / "ACTIVE depeg {bps}"), `depegEventCount`,
  worst-deviation bps, and the yield-bearing-excluded note when present. This replaces the DEWS pill.
- **5-dimension bars.** `pegStability`, `liquidity`, `resilience`, `decentralization`,
  `dependencyRisk` — each a 0–100 band-track bar coloured by grade, with score+grade. Expand reveals
  the `detailItems` (`{label, value, detail}`) as a compact list. Honest empties for unrated dims.
- **Backed by.** From `rawInputs.dependencies` `[{id, weight, type}]`, each resolved against the
  cards map to show the dependency's **own** Pharos score+grade (USDC → 76 B+) and linked to its
  dossier. Reuse `DependencyList`.
- **Context line.** `variantKind`/`variantParentId`/`navToken`, supply (`circulating.peggedUSD`),
  `bridgeRouteRisk.label`+score, `[Open Pharos dossier →]`.

### 2.4 Layer 2 — Exposure (Royco wrapper, slimmed)

Drop the dependency block (now L1). Keep curated facts; show the haircut as a real transition and
label it honest reference data:

```
┌ LAYER 2 · EXPOSURE ─────────────────────────────  curated reference data ┐
│  Automated on-chain vault            exposure score 49 → base −7.3 pts     │
│  Yield source   Automated routing across on-chain vault strategies         │
│  What breaks it Execution venue and thin tranche liquidity                 │
│  Exit mechanics Vault redemption (underlying-dependent)                     │
└────────────────────────────────────────────────────────────────────────────┘
```

(Optional, low priority: cross-check `exposure.ts` curated strings against the now-available live
`rawInputs` like `redemptionRouteFamily`, `collateralQuality`, `custodyModel`. Out of scope for v1.)

### 2.5 Layer 3 — Your seat (penalty bar + explicit credit)

Keep `PenaltyBar`, but make the Senior cushion credit an explicit positive step so the
"base → anchor" jump stops being magic:

```
Senior   exposure-adjusted base 32   + Senior cushion +29   − seat 3.2   →  61
Junior   exposure-adjusted base 32   first-loss seat  −8    − friction   →  24
```

Derive the credit from the existing score result (`anchor − exposureAdjustedBase`); if not cleanly
recoverable, render as a labelled note. No scoring math change.

### 2.6 Consolidate (so depth doesn't bloat)

Masthead = the verdict. The 3-layer stack = the single derivation. "Senior vs Junior" keeps only the
yield story (APY spread, net yield, extra haircut), not another score-pair restatement.

---

## 3. Data work (Phase B) — surface the evidence we already fetch

`report_card_summary_json` is a JSON blob → **no DB/schema migration**. All additive except the
DEWS removal.

### 3.1 Types (`types.ts`)
- `PharosDimensionItem { label; value; detail }`
- `PharosDimension { key; label; score: number|null; grade: string|null; detail: string|null; items: PharosDimensionItem[] }`
- `PharosPegHealth { score: number|null; grade: string|null; activeDepeg: boolean|null; activeDepegBps: number|null; depegEventCount: number|null; lastEventAt: number|null; yieldBearing: boolean }`
- Extend `PharosDependency` with resolved `safetyScore`/`safetyGrade` (already present) + `relationship` from `type`.
- Add to `UnderlyingSummary`: `overallBaseScore: number|null`, `dimensions: PharosDimension[]`,
  `peg: PharosPegHealth|null`, `variantKind`/`variantParentId`/`navToken`,
  `bridgeRoute: { label; score }|null`, `freshness: { fallback: boolean; collateralDrift: boolean; stale: boolean }`.
- **Remove** `PharosDewsSignal` and `dews` (replaced by `peg`).

### 3.2 Extractor (`pharos-report-card.ts`)
- Map `card.dimensions.*` → `PharosDimension[]` (label via `titleCase`, plus score/grade/detail/items).
- Build `peg` from `dimensions.pegStability` + `card.rawInputs` (`pegScore`, `activeDepeg`,
  `activeDepegBps`, `depegEventCount`, `lastEventAt`); detect yield-bearing from the pegStability
  adjustment item.
- Build dependencies from `rawInputs.dependencies` `[{id, weight, type}]`, **resolving each id against
  the cards map** for its own overallScore/grade + dossier URL.
- Pull `overallBaseScore` (`baseScore`), `variant*`, `navToken`, `bridgeRouteRisk.{label,score}`.
- Compute `freshness` flags from the top-level `liveToFallbackCoins`/`collateralDriftCoins`/
  `liquidityStale`/`redemptionStale` and per-card `collateralFromLive`/`dependencyFromLive`.
- **Delete** all DEWS extraction (`extractDewsSignal`, `findDewsContainer`, `normalizeDews`,
  `statusFromDewsStress`).
- Update `serializeUnderlyingReportCard` + `reportCardExtrasFromJson` to round-trip the new fields.
- `buildUnderlyingSummaries` (`pharos-client.ts`) must pass the cards map into the extractor so
  dependency own-scores resolve.

### 3.3 Fixtures refresh + recalibrate
- Regenerate `UNDERLYING_FIXTURES` for all 9 tracked ids from a live capture: real `overallScore`/
  grade/baseScore, the 5 dimensions, `peg`, resolved dependencies, variant/bridge context. Remove the
  fabricated DEWS helper.
- `npm run calibrate`; inspect distribution/inversions/anchors; update `scoring.test.ts` expectations
  and `agents/calibration-v0.1.md` / `roycopharos-calibrated.md` to the new anchors.
- (Royco market fixtures — coverage/util/APY — are separate and unchanged.)

### 3.4 Shared peg component + DEWS removal
- New `PegStabilityReadout` + per-dimension `DimensionBar` in `pharos-signals.tsx` (band-track form).
- **Remove** `DewsPill`/`DewsNote`/`dewsTone`; replace usages in the overview table and masthead with
  the compact peg-stability indicator.

---

## 4. File-by-file change list

**Data layer (do first — UI renders this):**
- `src/lib/roycopharos/types.ts` — new Pharos types; remove DEWS.
- `src/lib/roycopharos/pharos-report-card.ts` — dimension/peg/dependency/freshness extraction; remove DEWS; round-trip.
- `src/lib/roycopharos/pharos-client.ts` — pass cards map for dependency resolution.
- `src/lib/roycopharos/fixtures.ts` — refresh from live capture; drop fabricated DEWS.
- `src/lib/roycopharos/sql-read.ts`, `sqlite.ts`, `d1-publish.ts` — already route through the
  serialize/parse pair; verify the new fields persist (no schema change).
- `scripts/calibrate.ts` (review) + `src/lib/roycopharos/scoring.test.ts` + `pharos-client.test.ts` /
  report-card tests — update to the real schema and recalibrated anchors.

**UI layer:**
- `src/components/roycopharos/pharos-signals.tsx` (+ `.module.css`) — `PegStabilityReadout`,
  `DimensionBar`/`DimensionList`, `PharosSourceBadge`; remove DEWS components.
- `src/app/markets/[marketKey]/page.tsx` (+ `.module.css`) — rebuild Layer 1 dossier; dependency →
  L1; slim Layer 2 + haircut transition; explicit cushion-credit step; spine; trim Senior-vs-Junior;
  strip any leaked source prose.
- `src/components/roycopharos/overview-table.tsx` + masthead usage — DEWS → peg-stability indicator.

**No changes to:** `scoring.ts` math, `/methodology` constants, `schema.ts` (JSON blob absorbs new
fields), or any request handler (Pharos still read from the published snapshot only).

---

## 5. Constraints honored

No upstream fetch in handlers · Pharos shown verbatim and visually distinct · honest empties for
NR/unrated/fallback/stale · colour never the only signal · reuse existing badges/tokens/components ·
scoring math and `/methodology` unchanged (recalibration updates anchors/tests, not the formula).

---

## 6. Build order & verification

```
1. Data: types + extractor + client + report-card tests   → npm run typecheck && npm run test
2. Fixtures refresh + recalibrate                          → npm run calibrate && npm run test
3. Shared peg components; remove DEWS (overview+masthead)  → npm run typecheck && npm run build
4. Layer 1 dossier rebuild (5 dims + peg + backed-by)      → npm run build + visual
5. Layer 2 slim + Layer 3 cushion credit + spine + dedup   → npm run build + visual
6. Full pass                                               → npm run typecheck && test && build,
                                                              npm run sync && npm run status,
                                                              visual: autoUSD (F), savUSD, syrupUSDC, an NR case
```

Success criteria: a reader can state in seconds what Pharos thinks of the base asset (overall +
5 dimensions), whether it's near a depeg (peg readout), what backs it (dependency + its own grade),
and whether the Pharos read is live or degraded — and the number visibly flows Pharos → exposure →
seat with the Senior-above-Pharos jump explained. No fabricated signals; page no longer than today.

---

## 7. Remaining verifications (in code, not blocking)

1. **Cushion-credit derivability** from the score result (`anchor − exposureAdjustedBase`); else a
   labelled note.
2. **Recalibration ripple** — real base scores are much harsher (autoUSD 39/F vs old 78/C); confirm
   invariants still hold (Junior ≤ Senior Safety; Senior-above-Pharos only via cushion credit) after
   `calibrate`.
3. **`ratedDimensions` vs present dimensions** — render only rated dims; treat the rest as unrated.

---

## 8. Captured live Pharos schema (2026-06-20, reference)

`/api/report-cards` → `{ cards[], methodology, dependencyGraph{edges:[{from,to,weight,type}]},
updatedAt, liquidityStale, redemptionStale, inputFreshness{dexLiquidity,redemptionBackstops},
collateralDriftCoins:[{id,liveScore,curatedScore,delta}], liveToFallbackCoins:[id] }` (463 cards).

**card**: `id, name, symbol, overallScore, overallGrade, baseScore, overallCapped,
uncappedOverallScore, dimensions, ratedDimensions(int), rawInputs, oracleRisk,
bridgeRouteRisk{tier,score,label,summary}, isDefunct`. **`dews` is always null — no DEWS upstream.**

**dimensions** (5, consistent): `pegStability, liquidity, resilience, decentralization,
dependencyRisk`, each `{ grade, score, detail, detailItems:[{label,value,detail}] }`.

**rawInputs** (depeg/liquidity/etc.): `pegScore, activeDepeg, activeDepegBps, depegEventCount,
lastEventAt, liquidityScore, effectiveExitScore, redemptionBackstopScore, redemptionRouteFamily,
redemptionImmediateCapacityUsd, concentrationHhi, collateralQuality, custodyModel, canBeBlacklisted,
governanceTier, chainTier, oracleRiskTier/Score, bridgeRouteRiskTier/Score,
dependencies:[{id,weight,type}], variantParentId, variantKind, navToken, collateralFromLive,
dependencyFromLive`.

`/api/stablecoins` → `{ peggedAssets[], fxFallbackRates, _meta }`. asset: `id, symbol, name, pegType,
pegMechanism, price (often null), priceSource, circulating{peggedUSD}, chains, contracts` — **no
depeg field here either.** Supply via `circulating.peggedUSD`.

Sample (live): autoUSD `39/F` base 41 — peg 93 A+, liquidity 3 F, resilience 63 C+,
decentralization 35 F, dependencyRisk 71 B; backed by USDC (own card 76 B+); strategy-vault, NAV.
savUSD `41/D` → backed by avUSD (own card 42/D). syrupUSDC `59/C` → USDC 76/B+.
