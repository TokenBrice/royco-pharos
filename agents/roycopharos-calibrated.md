# RoycoPharos — Calibrated Redesign Plan

Author: redesign pass, 2026-06-14
Target methodology version: `royco-opportunity-v0.2` (bump from `v0.1`)
Basis: live `npm run calibrate` run on the recorded Dawn fixture (9 markets / 18 tranches) + recorded Pharos underlyings, cross-read against `scoring.ts`, `fixtures.ts`, `types.ts`, the market detail page, and `agents/calibration-v0.1.md`.

Scope note: this is the sanctioned change that `agents/wave-2-plan.md` §3 reserved for "W2-5 may change weights, and only behind a version bump." It changes the scoring **scale, banding, and headline split** — so it bumps `METHODOLOGY_VERSION` and re-pins the scoring tests.

---

## 1. The problem, with the real numbers

Two distinct failures: a **calibration** failure (the grade carries almost no information) and a **decomposition** failure (one number hides the three risks a user actually needs to separate).

### 1a. Calibration — why nothing beats C and most things are F

The engine computes `opportunity = clamp(underlyingSafetyScore − Σpenalties, 0, 100)` and grades it on fixed bands `A≥90 / B≥80 / C≥70 / D≥60 / E≥50 / F<50`. On the real pull:

| Symptom | Evidence (this fixture) |
| --- | --- |
| **A/B are mathematically unreachable** | Strongest underlying is autoUSD = **78**. The opportunity score can never exceed its underlying, and no underlying reaches 80. So the product can only ever issue C–F, before any penalty. |
| **The grade barely ranks anything** | Distribution: **1×C, 3×E, 14×F**. An "F" spans score 0→48. A 48 and a 0 get the same letter. |
| **The two visible columns contradict** | Pharos grades 60–78 as C-range (C+/C/C-); RoycoPharos' own `gradeFromScore` calls 60–69 "D" and 50–59 "E". The overview shows rows like "Underlying **C+** → Opportunity **E**" — two scales disagreeing in public. (The underlying grade↔score map is itself non-monotonic in the recorded data: 78→C but 64→C+ — Pharos' own grades, not derived from the number. RoycoPharos must keep showing Pharos' grade verbatim and stop implying its own bands agree with it.) |
| **Penalties are absolute and additive, sized for a base they never see** | Junior first-loss is a flat **−18**; junior utilization-at-limit is **−24**. Two factors strip 42 pts off a ~60 base → single digits. `junior-first-loss` (Σ162) and `utilization` (Σ164) dominate the entire penalty mass. |
| **Every junior is F** | First-loss is treated as a defect, not the product. A reasonable junior on a strong asset (autoUSD jr, base 78) lands **50 (E)**; a dangerous one (eEARN jr) lands **17 (F)** — both effectively "avoid." |

### 1b. Decomposition — the vault page can't answer the three questions

The user needs, per vault, to separate:

1. **Where are the coins farming?** (exposure / strategy / venue) — today only buried in the underlying `summary` prose and a coarse chain-derived `venueTier` that fires near-constantly (16/18) and barely changes ranking.
2. **Which base-asset risk?** (the stablecoin itself) — present as the Pharos score, but visually fused into the opportunity number by subtraction.
3. **Which tranche-specific risk?** (senior/junior, buffer, utilization, redemption) — present in `penaltyBreakdown`, but collapsed into one headline that never tells you *which* layer is the problem.

The peg signal is also unused: `price` shows savUSD **$1.18**, syrupUSDC **$1.07**, AA **$1.04** — these are yield-accruing wrappers, not $1 pegs, and that distinction never reaches the UI.

---

## 2. Decisions locked (from review)

- **Grade scale → re-anchored absolute.** Bands are re-fit to the asset class (DeFi stablecoin yield tranches), so the strongest realistic tranche reaches ~A-/B and the population spreads. A given score maps to the same grade every snapshot — defensible to a Royco reviewer. *Not* cohort-percentile (which would make "A" mean "least-bad today").
- **Headline → split Safety + Opportunity.** Two grades per tranche: a **Safety** grade (pure downside / capital risk) and a separate **Opportunity** grade that brings APY in as risk-adjusted yield. A junior can be Safety-C but Opportunity-A when its yield richly pays for first-loss.

---

## 3. The redesigned model

Three **independent risk layers** that the UI displays separately, feeding **two re-anchored grades**. The layers are the user's three questions; the grades are the headline.

```
 Layer 1  BASE-ASSET SAFETY      Pharos score on the stablecoin        "what you ultimately hold"
 Layer 2  EXPOSURE PROFILE       strategy class + venue + peg          "where the coins farm"
 Layer 3  TRANCHE STRUCTURE      position, buffer, utilization, friction "your seat in the waterfall"
                    │
                    ▼
   SAFETY grade  =  re-anchor( BaseAssetScore − saturating tranche haircut )
   OPPORTUNITY   =  re-anchor( APY × Safety/100 )      (risk-adjusted yield)
```

### 3.1 Safety score — keep base-as-ceiling, fix the two real bugs

Two model shapes were considered:

- **(X) Keep subtractive** (`Safety = Base − haircut`), re-anchor the bands, and make the haircut **bounded + saturating**. Conceptually correct: Royco's wrapper only *adds* risk on top of the stablecoin, so the base is a soft ceiling — a tranche should never score *safer* than the asset it holds.
- **(Y) Blend two sub-scores** (`Safety = wA·Base + wC·Structure`). More expressive, but lets a senior score *above* its underlying, which is conceptually wrong (the senior also carries Royco contract/market mechanics on top of the same stablecoin).

**Recommend (X)** — it is the surgical change (keeps `scoring.ts` shape and the `penaltyBreakdown` explainability), and it is conceptually honest. The calibration problem was never that the base is a ceiling; it was (a) the bands and (b) the haircut magnitude. Fix exactly those.

Two concrete fixes to the haircut:

1. **Saturating, capped per side.** Replace the additive sum with diminishing-returns aggregation and hard caps: **senior haircut ≤ ~14**, **junior haircut ≤ ~28** (Phase 0 lowered this from 32 to lift mid-base juniors off the floor). Two bad factors must not equal the sum of two cliffs.
2. **First-loss becomes buffer-scaled, not flat.** Drop the flat junior `−18`. A junior's first-loss risk is a graduated function of how thin/leveraged its buffer is — a junior sitting under a deep senior with low utilization is far safer than one at the limit. The *compensation* for first-loss moves entirely into the Opportunity grade, so junior is no longer punished twice.

Utilization and coverage move to saturating curves (e.g. `term = cap · (1 − e^{−k·pressure})`) instead of step cliffs, so the worst case is bounded and the gradient is smooth.

### 3.2 Re-anchored Safety bands

Fit bands to the realised, softened distribution so the asset-class anchors land and the population spreads. **Starting proposal (harness must confirm/tune):**

| Grade | Score | Anchor meaning (this asset class) |
| --- | --- | --- |
| A | ≥ 70 | Strong base (≥75) + senior + deep buffer + low utilization. Institutional-grade *for DeFi stablecoin yield*. |
| B | 60–69 | Strong structure, or strong base with one soft factor. |
| C | 50–59 | Genuinely middling — the honest center of mass. |
| D | 40–49 | Weak base **or** stressed structure. |
| E | 30–39 | Weak base **and** stressed structure. |
| F | < 30 | Weak base with junior-at-limit / protection-mode. |

### 3.3 Illustrative effect on the real 18 (hand-simulated, pending harness fit)

Softened/saturating haircuts (senior cap 14, junior buffer-scaled cap 32) re-applied to the actual bases, then re-anchored:

| Tranche | Base | v0.1 (old) | New Safety (≈) | New grade |
| --- | --- | --- | --- | --- |
| autoUSD senior | 78 | 72 **C** | ~72 | **A** |
| autoUSD junior | 78 | 50 E | ~66 | **B** |
| eEARN senior | 74 | 58 E | ~62 | **B** |
| syrupUSDC senior | 63 | 59 E | ~59 | **C** |
| sNUSD senior | 64 | 48 F | ~55 | **C** |
| sUSDai senior | 60 | 47 F | ~52 | **C** |
| eEARN junior | 74 | 17 F | ~52 | **C** |
| syrupUSDC junior | 63 | 33 F | ~49 | **D** |
| sNUSD junior | 64 | 6 F | ~42 | **D** |
| apyUSD senior (protected) | 49 | 37 F | ~40 | **D** |
| AA senior | 52 | 34 F | ~42 | **D** |
| AA junior | 52 | 0 F | ~28 | **F** |
| savUSD senior | 33 | 17 F | ~24 | **F** |
| stcUSD senior | 28 | 19 F | ~19 | **F** |
| stcUSD junior | 28 | 0 F | ~8 | **F** |

Old: **1 C, 3 E, 14 F**. New (illustrative): roughly **1 A, 2 B, 4 C, 4 D, ~4 F** — every band populated, centered on C/D. That spread is the whole point; the exact weights are tuned in Phase 0, not asserted here.

### 3.4 Opportunity score — risk-adjusted yield

v1, transparent and explainable:

```
netYield      = APY_current × (Safety / 100)        // haircut yield by the safety fraction
Opportunity   = re-anchored bands on netYield
```

Read it as "expected yield after a crude loss-probability haircut." Bands (tunable): **A ≥ 12% · B 8–12% · C 5–8% · D 3–5% · E 1.5–3% · F < 1.5%**. Worked examples:

| Tranche | APY | Safety | netYield | Opp grade | vs Safety grade |
| --- | --- | --- | --- | --- | --- |
| autoUSD senior | 13.4% | 72 | 9.6% | **B** | A |
| sNUSD junior | 22.4% | 42 | 9.4% | **B** | D |
| apyUSD junior (protected) | 51.7% | 25 | 12.9% | **A** | F |
| syrupUSDC senior | 4.5% | 59 | 2.7% | **E** | C |
| sUSDai senior | 2.5% | 52 | 1.3% | **F** | C |

The divergence is the feature: high-APY juniors earn strong Opportunity grades *while their Safety grade honestly stays low*. apyUSD junior, Opportunity-A / Safety-F, is the clearest "the yield is the compensation, and here's the risk you take for it" case.

Knobs: a risk-aversion exponent `γ` on `(Safety/100)^γ` (γ=1 in v1; γ>1 punishes risk harder). APY source: use `apyCurrentPct`, fall back to `apy7dPct` when current is 0/transient (eEARN, apyUSD senior show 0 current), and flag rather than silently treating 0 as "no opportunity."

---

## 4. Vault page information architecture (the three layers)

Restructure `markets/[marketKey]/page.tsx` into the three labeled layers, led by the two grades. Keep the existing loss-order waterfall and "Why Junior pays more" — reframe them, don't rebuild.

**Header (per tranche): two grade chips + APY.** `Safety B-` · `Opportunity A` · `APY 13.7%`. One line tells the whole story: how risky, how well-paid, and the headline yield.

**Layer 1 — Base asset (the stablecoin).** "What you ultimately hold."
Pharos grade + score (verbatim, never re-graded), **peg/price with deviation called out** (savUSD $1.18 ≠ $1 → "yield-accruing wrapper, not a $1 peg"), supply, Pharos one-line summary. This is the base-asset-linked risk, isolated.

**Layer 2 — Exposure (where the yield comes from).** "Where your coins farm."
A structured `exposure` classification per underlying — recoverable today from the Pharos summaries, curated like `token_mappings` for v1, sourced from Pharos dimensions later:

| Stablecoin | Strategy class | Yield source | Primary "what breaks it" |
| --- | --- | --- | --- |
| autoUSD | Automated vault strategy | DEX/vault automation | venue + thin liquidity |
| syrupUSDC | Institutional private credit | borrower lending, FIFO exit | borrower concentration / withdrawal queue |
| AA_FalconXUSDC | Senior credit tranche (MM/MEV financing) | credit lines, monthly exit | credit-line default / exit gating |
| sUSDai | Real-world compute lending | GPU-loan interest | loan performance / queued exits |
| sNUSD | Delta-neutral basis | funding-rate capture | basis blowout / redemption |
| stcUSD | Stablecoin basket/index | proportional basket | constituent depeg / liquidity caps |
| eEARN | Yield aggregator | routed strategies | dependency risk |
| apyUSD | ERC-4626 wrapper | wrapped vault | issuer / governance |
| savUSD | Concentrated yield wrapper | single concentrated strategy | issuer + concentration |

Plus `venueTier` (flagged as coarse/placeholder until Royco supplies real venue data — per `calibration-v0.1.md`). Each row: one line on *how the yield is made* and *what breaks it*.

**Layer 3 — Tranche structure.** "Your seat in the waterfall."
The existing loss-order waterfall + buffer adequacy (coverage vs required, headroom) + utilization headroom + redemption/withdrawal friction + the **tranche haircut breakdown** (the reframed `penaltyBreakdown`, grouped by `riskCategory`). Reframe junior first-loss as "this is the product; its compensation is the Opportunity grade above," linked to Layer's APY.

**Overview table:** replace the single Opportunity column with **two grade columns (Safety, Opportunity)** + APY; keep sort/filter on either grade. Add an "Exposure" filter (strategy class) so users can ask "show me only private-credit seniors."

---

## 5. Workstreams (phased, each with a verify gate)

> **Status: P0–P5 all shipped (2026-06-14).** `METHODOLOGY_VERSION = royco-opportunity-v0.2`. Production engine in `scoring.ts` (candidate module removed), exposure taxonomy in `exposure.ts`, two-grade overview + three-layer vault page + rewritten methodology page live. `npm run calibrate` Safety **1A/3B/4C/3D/2E/5F**, all anchors pass; `npm test` 18/18; typecheck clean; `npm run sync` publishes v0.2 to SQLite (a `migrateTrancheScores` ALTER-TABLE upgrade keeps existing DBs working). New CSS for the two-grade header, three layers, and methodology band grid added to `globals.css`.

Ordered so the scoring truth is proven *before* any UI is built on it.

### P0 — Calibration harness upgrade *(gate; build first, no scoring change yet)* — ✅ DONE
Extend `scripts/calibrate.ts` to print, side-by-side: v0.1 score/grade, **new Safety score/grade**, **new Opportunity score/grade**, plus a grade-distribution histogram and explicit **anchor checks** (autoUSD senior must be ≥A-; weakest junior must be F; no junior outranks its senior on Safety).
→ verify: harness emits both models and the histogram; anchors print pass/fail. No production scoring touched.

**Result (recorded fixture, `npm run calibrate`):** candidate model lives in `src/lib/roycopharos/scoring-v2-candidate.ts` (additive; `scoring.ts` untouched, 16/16 tests green, typecheck clean). Safety distribution went from v0.1 **0A/0B/1C/0D/3E/14F** → v0.2 **1A / 3B / 4C / 3D / 2E / 5F** (every band populated, centered on C). Opportunity diverges as intended: apyUSD junior **Safety-E → Opportunity-A** (51.7% APY), sNUSD junior **D → B**, AA junior **F → C**. All five anchors pass.

Two Phase-0 tunings off the first run (which produced a heavy 6F bottom): **junior cap 32→28** and **venue weights trimmed** (high 8→6, medium 4→3, unknown 3→2 junior; venue mass Σ66→Σ48). venue is a coarse placeholder per `calibration-v0.1.md`, so a heavy near-constant weight was just depressing the whole population. Net effect: apyUSD junior F→E; the remaining **5 F's are defensible** — 4 are savUSD/stcUSD seniors+juniors whose *underlying* is Pharos-F-rated (base 33/28, so base-as-ceiling forbids anything above F), and the 5th (AA junior, 29) is a C--base junior at maxed utilization with sub-$100k TVL, one point under the E line. Per-factor mass: utilization 112 / first-loss 91 / venue 48. The weights/bands in §3.2–3.4 are **confirmed as the v0.2 starting point**; final tuning + test-pinning happens in P1.

### P1 — Safety scoring v0.2 *(behind version bump)*
In `scoring.ts`: make the tranche haircut **bounded + saturating** (per-side caps), replace flat junior first-loss with a **buffer-scaled** term, and add **re-anchored bands** in `gradeFromScore` (rename to `safetyGradeFromScore`). Keep `penaltyBreakdown` (it powers Layer 3). Bump `METHODOLOGY_VERSION = "royco-opportunity-v0.2"`.
→ verify: `npm run calibrate` distribution spreads A–F and hits the §3.3 anchors; **re-pin `scoring.test.ts`** to the new fixtures (the wave-2 tests are the change-control gate).

### P2 — Opportunity score
Add `opportunityScore` / `opportunityGrade` (`netYield = APY × Safety/100`, re-anchored yield bands, `γ` knob, 7d-APY fallback) to `ScoreResult` + `RoycoTrancheView`.
→ verify: harness shows Opportunity diverging from Safety on high-APY juniors (apyUSD jr → Opp ≫ Safety); unit test pins the formula + the APY-fallback + the zero-APY flag.

### P3 — Exposure taxonomy
Add a curated `exposure` classification (strategy class / yield source / primary risk) keyed by `pharosStablecoinId`, alongside `token_mappings`. Surface peg deviation from the existing `price` field.
→ verify: every mapped underlying resolves an exposure row; unmapped → "exposure unknown," still visible.

### P4 — Vault page + overview IA (§4)
Three-layer vault sections + two grade chips; two grade columns + exposure filter on the overview.
→ verify (playwright): vault page renders Layers 1/2/3 distinctly with both grades; overview sorts/filters on Safety, Opportunity, and exposure.

### P5 — Methodology rewrite + final calibration note
Rewrite `methodology/page.tsx` for the two-grade, three-layer, re-anchored model (render bands + caps from the constants, same anti-drift pattern as today's penalty table). Write `agents/calibration-v0.2.md` with the live distribution, anchor results, and the chosen weights/bands.
→ verify: methodology page shows the new formula + bands from source constants; calibration note reproduces via `npm run calibrate`.

---

## 6. Do NOT redo (surgical guardrails)

- The **base-as-ceiling concept** and the Pharos score being shown **verbatim** — keep. We only re-anchor bands and soften the haircut.
- The **`penaltyBreakdown` machinery + `reconcileAppliedPenalties`** — reused as Layer 3, not replaced.
- The **loss-order waterfall** and **"Why Junior pays more"** panels — reframed, not rebuilt.
- The **mapping resolver / `token_mappings`** (address-authoritative) — untouched; exposure is additive.
- The **DB read path, freshness `_meta`, candidate→publish gate** — untouched.
- The synthetic-history and live-fidelity items — those belong to `wave-2-plan.md`; this plan is scoring + presentation only.

---

## 7. Open knobs & risks (carry into Phase 0)

- **Haircut caps (senior 14 / junior 32), band edges, opportunity-yield bands, `γ`** are all starting proposals — Phase 0 tunes them against live data to hit the anchors + spread, then they freeze under the version bump.
- **`venueTier` is a coarse chain placeholder** (`calibration-v0.1.md`): it shifts absolute scores but barely changes ranking. Keep it low-weight and visibly flagged until Royco supplies real venue classification.
- **Exposure taxonomy is curated v1**, hand-maintained like the mapping table. Acceptable for a prototype; flag each row's source/confidence, and migrate to Pharos dimensions when available.
- **netYield is a heuristic, not a Sharpe ratio.** Label it as such. It rewards juniors by design (that is the Opportunity story), but it is not a claim about realized risk-adjusted return.
- **APY is volatile** (several rows show 0 current). The 7d fallback + zero flag must be honest, never silently graded as F-opportunity.

---

## 8. Exit criteria

1. `npm run calibrate` shows Safety grades spread **A–F**, centered on C/D, with the §3.3 anchors passing — no more 14×F.
2. Each tranche carries **two grades** (Safety + Opportunity) that **diverge** on high-APY juniors.
3. The vault page answers the three questions in **three distinct, labeled layers**: base-asset (stablecoin + peg), exposure (where it farms), tranche structure (waterfall seat).
4. `METHODOLOGY_VERSION` bumped to `v0.2`, `scoring.test.ts` re-pinned, methodology page + `calibration-v0.2.md` reproduce the numbers from source constants.
