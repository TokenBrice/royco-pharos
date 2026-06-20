# Scoring

Current methodology version: `royco-opportunity-v0.6`.

The scoring engine lives in `src/lib/roycopharos/scoring.ts`. Tests live in `src/lib/roycopharos/scoring.test.ts`. The methodology page renders its bands and factor rows from the same constants to reduce drift.

## Model Summary

RoycoPharos produces two numeric Royco scores per tranche:

| Score | Answers | Formula |
| --- | --- | --- |
| Royco Safety Score | How much capital-risk cushion the tranche seat has. | `clamp(round(pharosBaseScore - exposureHaircut + seniorCushionCredit - trancheStructureHaircut), 0, 100)` |
| Royco Opportunity Score | Whether APY pays enough for the risk. | `clamp(round((APY x (Safety / 100) ^ gamma) / 12% * 100), 0, 100)` |

Pharos remains the vault/base-asset source of truth and is shown verbatim, including its letter grade. The UI also surfaces Pharos DEWS and upstream dependency evidence for the base asset when Pharos reports it. Those evidence fields do not change `royco-opportunity-v0.6` scoring; they explain the base asset context beside the score.

RoycoPharos scores the tranche seat independently in three layers: Pharos base asset, curated exposure, and tranche structure. A well-buffered Senior can score above the whole-vault Pharos score only through explicit Senior cushion credit, while a Junior can score below it because it absorbs first loss.

## Inputs

`scoreTranche()` consumes a `ScoreInput`:

| Input area | Examples |
| --- | --- |
| Identity | `trancheId`, `side`, `pharosStablecoinId`, `mappingStatus` |
| Vault input | `underlyingSafetyScore`, `underlyingSafetyGrade` |
| Market status | `statusNormalized` |
| Coverage | `coverageRatio`, `requiredCoverageRatio` |
| Utilization | `utilizationRatio`, `utilizationLimitRatio` |
| Liquidity | `tvlUsd` |
| Loss and venue | `drawdownRatio`, `venueTier` |
| Friction | `accessRestricted`, `withdrawalUnderlyingDependent`, `juniorRedemptionDelaySeconds` |
| Yield | `apyCurrentPct`, `apy7dPct` |
| Freshness | `observedAt`, optional `stale` |

## Outputs

`ScoreResult` includes:

| Field | Meaning |
| --- | --- |
| `scoreStatus` | `computed`, `low_confidence`, `nr`, or `stale`. |
| `nrReason` | Why the tranche cannot be rated, when applicable. |
| `baseAssetScore` | Layer 1 Pharos vault/base-asset score, shown verbatim. |
| `underlyingSafetyScore` / `underlyingSafetyGrade` | Pharos vault/base-asset values, shown verbatim. |
| `exposureScore` / `exposureHaircut` | Layer 2 curated exposure score and bounded exposure haircut. |
| `trancheStructureScore` / `trancheHaircut` | Layer 3 tranche structure score and bounded structure haircut. |
| `safetyScore` / `safetyGrade` | Capital-risk score and compatibility band. |
| `apyUsedPct` / `apySource` | Current APY, 7d fallback, or no positive APY. |
| `opportunityYield` / `opportunityScore` / `opportunityGrade` | Risk-adjusted yield, normalized 0-100 score, and compatibility band. |
| `penaltyBreakdown` | Factor-level raw and applied penalties with explanations. |
| `inputHash` | Hash of the scoring inputs. |
| `methodologyVersion` | Version string persisted with scores. |
| `computedAt` | Unix timestamp for score computation. |

## Bands

Safety bands:

| Grade | Minimum score |
| --- | ---: |
| A | 70 |
| B | 55 |
| C | 40 |
| D | 25 |
| E | 10 |
| F | 0 |

Safety grades are calibrated for direct Royco tranche seats, not reused from Pharos vault grades or traditional credit labels. The raw 0-100 Safety score remains visible; the letter bands reserve `F` for near-collapsed tranche safety while keeping weak but functioning seats in `D`/`E`.

Opportunity bands are based on net yield percent:

| Grade | Minimum net yield |
| --- | ---: |
| A | 12% |
| B | 8% |
| C | 5% |
| D | 3% |
| E | 1.5% |
| F | 0% |

`NR` is not a band. It means the tranche could not be rated. Product UI should lead with the numeric Royco scores; bands remain useful for color, calibration, and API compatibility.

## APY Resolution

`resolveApyPct()` uses:

1. `apyCurrentPct` when it is positive.
2. `apy7dPct` when current APY is null or zero and 7d APY is positive.
3. The available non-positive value, or null, with `apySource: "none"`.

This prevents transient zero current APY from automatically collapsing the Opportunity grade when a 7d value is available.

## Three-Layer Safety

Layer 1 is the Pharos vault/base-asset score, shown verbatim. Layer 2 applies curated exposure risk from `exposure.ts`, converted into a bounded exposure haircut. Layer 3 applies tranche structure mechanics.

Senior tranches receive a coverage-scaled cushion credit:

| Term | Value |
| --- | ---: |
| Maximum Senior cushion credit | 32 points |
| Full-credit coverage multiple | 5x required coverage |

Senior cushion credit is zero when coverage is missing, at or below the required ratio, or the tranche is Junior. It scales linearly from 0 to 32 points between 1x and 5x required coverage. This is the explicit path that allows Senior Safety to exceed the whole-vault Pharos score.

Exposure haircut is capped separately by `EXPOSURE_HAIRCUT_CAP`.

The tranche structure haircut is bounded per side:


| Side | Cap |
| --- | ---: |
| Senior | 14 |
| Junior | 28 |

Raw factor penalties are combined with a diminishing-returns saturating function. The exposure and structure haircuts cannot exceed their separate caps.

The displayed `appliedPenalty` rows are reconciled within each layer so their rounded sums match the exposure and structure haircuts. This keeps the grade explanation numerically consistent with the score line.

## Factor Groups

The scorer currently considers:

| Factor | Notes |
| --- | --- |
| Exposure profile | Curated strategy/protocol risk from `exposure.ts`; unknown exposure is visible as data confidence risk. |
| Market status | `normal` adds no haircut. `protected`, `unhealthy`, `critical`, and missing status add risk or uncertainty. |
| Senior cushion credit | Senior receives explicit upside from thick Junior buffer depth. |
| Coverage | Senior watches thin or missing buffer. Junior uses a buffer-scaled first-loss term. |
| Utilization | Saturating curve. Junior feels pressure earlier and harder. |
| Tranche TVL | Missing or low TVL adds liquidity friction. |
| Drawdown | Observed drawdown adds loss-risk pressure. |
| Venue tier | Coarse placeholder with low weight until better venue data exists. |
| Access restriction | Adds access-friction points when restricted or KYC-dependent. |
| Withdrawal dependency | Adds liquidity-friction points when exit depends on underlying mechanics. |
| Junior redemption delay | Junior-only liquidity-friction term. |

Each penalty row carries a risk layer:

- `exposure`
- `tranche-structure`

Each row also carries a risk category:

- `loss-risk`
- `liquidity-friction`
- `data-confidence`
- `access-friction`

Each row also has a severity:

- `info`
- `watch`
- `warning`
- `critical`

## Score Status Rules

| Status | Rule |
| --- | --- |
| `computed` | Required Pharos vault input exists and no non-fatal missing-data uncertainty was triggered. |
| `low_confidence` | Required Pharos vault score exists, but non-fatal Royco fields are missing or uncertain. This includes missing status, coverage, utilization, tranche TVL, drawdown data, unknown venue tier, or no positive current/7d APY. |
| `stale` | The input explicitly marks the score stale. |
| `nr` | Underlying Pharos Safety Score is missing, or tranche side is invalid. |

Mapping conflicts and unmapped assets commonly lead to missing Pharos IDs and `NR` once no underlying score can be resolved.

## Change Control

Before changing scoring constants, bands, APY resolution, or penalty math:

1. Update or review `scripts/calibrate.ts`.
2. Run `npm run calibrate` and inspect distribution, inversions, and anchor checks.
3. Update tests in `src/lib/roycopharos/scoring.test.ts`.
4. Bump `METHODOLOGY_VERSION` if the output interpretation changes.
5. Confirm `/methodology` still renders the constants from code.
6. Run `npm run typecheck` and `npm run test`.

Scoring changes should preserve these invariants:

- Junior must not outrank Senior on Safety when both are rated in the same market.
- Pharos vault/base-asset scores and grades must be shown verbatim and remain distinct from RoycoPharos tranche scores.
- Senior Safety may exceed the whole-vault Pharos score only through explicit Senior cushion credit.
- Missing Pharos vault score must remain `NR`.
- Missing non-fatal fields must be visible as low confidence, not hidden as clean computed scores.
- The methodology page and score engine must not drift.

## Disclaimer

RoycoPharos is informational only. It is not financial, investment, legal, tax, or credit-rating advice, and it does not guarantee principal, APY, liquidity, coverage, redemption, source accuracy, or future market behavior.
