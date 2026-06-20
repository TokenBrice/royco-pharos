import { createHash } from "node:crypto";
import { EXPOSURE_HAIRCUT_CAP, exposureRiskFor } from "./exposure";
import type { ApySource, GradeBand, MarketStatus, PenaltyBreakdownRow, ScoreInput, ScoreResult, TrancheSide } from "./types";

// Royco Opportunity v0.7 — three-layer risk model.
//
// The Pharos vault/base-asset score is Layer 1 and is shown verbatim. RoycoPharos adds:
//   Layer 2 exposure score  = curated strategy/protocol risk, with a bounded exposure haircut
//   Layer 3 structure score = tranche waterfall protection or first-loss drag
//   SAFETY                  = VaultScore − exposureHaircut + seniorCushionCredit − structureHaircut
//   OPPORTUNITY             = normalized(APY × (Safety/100)^gamma)
//
// Pharos rates the whole vault/base asset. RoycoPharos rates the tranche seat independently:
// Seniors can score above the vault when the Junior buffer is thick; Juniors carry first-loss risk.
// Exposure and structure haircuts are bounded separately and combined with diminishing returns.

export const METHODOLOGY_VERSION = "royco-opportunity-v0.7";

type SidePair = readonly [senior: number, junior: number];

// Per-side ceiling on the total tranche haircut. The saturating combine can never exceed this, so
// two bad factors cannot equal the sum of two cliffs (the v0.1 failure that pushed juniors to 0).
export const HAIRCUT_CAP = { senior: 14, junior: 28 } as const;

// Calibrated absolute Safety bands for direct Royco tranche seats. A given score maps to the
// same grade every snapshot, but the lower bands reserve F for near-collapsed tranche safety.
export const SAFETY_BANDS: readonly GradeBand[] = [
  { grade: "A", min: 70 },
  { grade: "B", min: 55 },
  { grade: "C", min: 40 },
  { grade: "D", min: 25 },
  { grade: "E", min: 10 },
  { grade: "F", min: 0 },
];

// Opportunity bands on risk-adjusted yield (netYield, in %).
export const OPPORTUNITY_BANDS: readonly GradeBand[] = [
  { grade: "A", min: 12 },
  { grade: "B", min: 8 },
  { grade: "C", min: 5 },
  { grade: "D", min: 3 },
  { grade: "E", min: 1.5 },
  { grade: "F", min: 0 },
];

// Risk-aversion exponent on the safety fraction. 1 = expected-yield haircut.
export const OPPORTUNITY_GAMMA = 1;
export const OPPORTUNITY_SCORE_FULL_YIELD = OPPORTUNITY_BANDS[0].min;
export const TRANCHE_STRUCTURE_NEUTRAL_SCORE = 70;

// Junior buffer counts as "thick" (full cushion, lightest first-loss term) once coverage reaches
// this multiple of the required ratio.
const JUNIOR_CUSHION_TARGET = 2.0;

// Senior can be safer than the whole-vault Pharos score when a real Junior buffer sits beneath it.
// Full credit is reached when current coverage is 5x the required coverage ratio.
export const SENIOR_CUSHION_CREDIT = { max: 32, targetCoverageMultiple: 5 } as const;

// Discrete structural weights [senior, junior]. Utilization and junior first-loss are curve-based
// (see scoreTranche) and summarized for the methodology page in structureFactorRows(). This table is
// the single source of truth the methodology page renders from, so displayed weights cannot drift.
export const STRUCTURE_WEIGHTS = {
  status: {
    protected: [5, 8] as SidePair,
    unhealthy: [9, 14] as SidePair,
    critical: [13, 18] as SidePair,
    missing: [4, 6] as SidePair,
  },
  coverage: {
    missing: [3, 4] as SidePair,
    belowRequiredBase: [8, 6] as SidePair,
    belowRequiredShortfall: [4, 4] as SidePair,
    underBuffer: [3, 0] as SidePair, // senior only: coverage < 1.25x required
  },
  utilizationMissing: [2, 6] as SidePair,
  juniorFirstLoss: { floor: 8, leverage: 8 }, // points = 16 − 8·cushion
  tvl: {
    missing: [5, 7] as SidePair,
    under100k: [5, 7] as SidePair,
    under250k: [3, 5] as SidePair,
    under1m: [1, 3] as SidePair,
  },
  venue: {
    medium: [2, 3] as SidePair,
    high: [5, 6] as SidePair,
    unknown: [1, 2] as SidePair, // coarse chain placeholder — deliberately low-weight
  },
  drawdown: { cap: [8, 12] as SidePair, factor: [0.6, 1.2] as SidePair },
  withdrawal: [1, 2] as SidePair,
  access: [2, 3] as SidePair,
  redemptionDelay: 3, // junior only
} as const;

function pick(side: TrancheSide, pair: SidePair) {
  return side === "senior" ? pair[0] : pair[1];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function safetyGradeFromScore(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) return "NR";
  for (const band of SAFETY_BANDS) if (score >= band.min) return band.grade;
  return "F";
}

export function opportunityGradeFromYield(netYield: number | null | undefined) {
  if (netYield == null || !Number.isFinite(netYield)) return "NR";
  for (const band of OPPORTUNITY_BANDS) if (netYield >= band.min) return band.grade;
  return "F";
}

export function opportunityScoreFromYield(netYield: number | null | undefined) {
  if (netYield == null || !Number.isFinite(netYield)) return null;
  return clamp(Math.round((netYield / OPPORTUNITY_SCORE_FULL_YIELD) * 100), 0, 100);
}

/** Diminishing-returns ("probabilistic OR") combine: saturates at `cap`. */
function saturatingHaircut(points: number[], cap: number) {
  const surviving = points.reduce((acc, p) => acc * (1 - clamp(p, 0, cap) / cap), 1);
  return cap * (1 - surviving);
}

/** Use current APY; fall back to 7d when current is 0/null; flag when neither is positive. */
export function resolveApyPct(apyCurrentPct: number | null, apy7dPct: number | null): { value: number | null; source: ApySource } {
  if (apyCurrentPct != null && apyCurrentPct > 0) return { value: apyCurrentPct, source: "current" };
  if (apy7dPct != null && apy7dPct > 0) return { value: apy7dPct, source: "7d" };
  return { value: apyCurrentPct ?? apy7dPct ?? null, source: "none" };
}

export interface StructureFactorRow {
  factor: string;
  senior: number | string;
  junior: number | string;
}

/** Methodology-page view of STRUCTURE_WEIGHTS — same constants the scorer uses. */
export function structureFactorRows(): StructureFactorRow[] {
  const w = STRUCTURE_WEIGHTS;
  const pair = (factor: string, value: SidePair): StructureFactorRow => ({ factor, senior: value[0], junior: value[1] });
  return [
    pair("Status: Protection mode", w.status.protected),
    pair("Status: unhealthy", w.status.unhealthy),
    pair("Status: critical", w.status.critical),
    { factor: "Senior cushion credit (coverage-scaled)", senior: `0–${SENIOR_CUSHION_CREDIT.max}`, junior: 0 },
    { factor: "Junior first-loss (buffer-scaled)", senior: 0, junior: `${w.juniorFirstLoss.floor}–${w.juniorFirstLoss.floor + w.juniorFirstLoss.leverage}` },
    { factor: "Utilization pressure (saturating)", senior: "0–7", junior: "0–14" },
    pair("Coverage below required (base)", w.coverage.belowRequiredBase),
    pair("Tranche TVL < $100k", w.tvl.under100k),
    pair("Venue tier: high", w.venue.high),
    pair("Withdrawal underlying-dependent", w.withdrawal),
    pair("Access restricted / KYC", w.access),
    { factor: "Junior redemption delay", senior: 0, junior: w.redemptionDelay },
    { factor: "Per-side haircut cap", senior: HAIRCUT_CAP.senior, junior: HAIRCUT_CAP.junior },
  ];
}

function severityForPenalty(penalty: number): PenaltyBreakdownRow["severity"] {
  if (penalty >= 12) return "critical";
  if (penalty >= 6) return "warning";
  if (penalty > 0) return "watch";
  return "info";
}

function row(
  params: Omit<PenaltyBreakdownRow, "appliedPenalty" | "riskLayer" | "severity"> & {
    riskLayer?: PenaltyBreakdownRow["riskLayer"];
    severity?: PenaltyBreakdownRow["severity"];
  },
) {
  return {
    riskLayer: "tranche-structure" as const,
    ...params,
    appliedPenalty: params.rawPenalty,
    severity: params.severity ?? severityForPenalty(params.rawPenalty),
  } satisfies PenaltyBreakdownRow;
}

function scoreHash(input: ScoreInput) {
  return `sha256-${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

function normalizedUtilization(input: ScoreInput): number | null {
  if (input.utilizationRatio == null) return null;
  if (input.utilizationLimitRatio != null && input.utilizationLimitRatio > 0) {
    return input.utilizationRatio / input.utilizationLimitRatio;
  }
  return input.utilizationRatio;
}

function statusPoints(side: TrancheSide, status: MarketStatus): number {
  switch (status) {
    case "normal":
      return 0;
    case "protected":
      return pick(side, STRUCTURE_WEIGHTS.status.protected);
    case "unhealthy":
      return pick(side, STRUCTURE_WEIGHTS.status.unhealthy);
    case "critical":
      return pick(side, STRUCTURE_WEIGHTS.status.critical);
    default:
      return pick(side, STRUCTURE_WEIGHTS.status.missing); // null/missing
  }
}

function seniorCushionCredit(input: ScoreInput) {
  if (input.side !== "senior") return 0;
  if (input.coverageRatio == null || input.requiredCoverageRatio == null || input.requiredCoverageRatio <= 0) return 0;
  const multiple = input.coverageRatio / input.requiredCoverageRatio;
  const progress = (multiple - 1) / (SENIOR_CUSHION_CREDIT.targetCoverageMultiple - 1);
  return SENIOR_CUSHION_CREDIT.max * clamp(progress, 0, 1);
}

export function scoreTranche(input: ScoreInput, now = Math.floor(Date.now() / 1000)): ScoreResult {
  if (input.side !== "senior" && input.side !== "junior") {
    return nrScore(input, "Invalid tranche side", now);
  }
  if (input.underlyingSafetyScore == null || !Number.isFinite(input.underlyingSafetyScore)) {
    return nrScore(input, "Missing underlying Pharos Safety Score", now);
  }

  const side = input.side;
  const base = input.underlyingSafetyScore;
  const cap = pick(side, [HAIRCUT_CAP.senior, HAIRCUT_CAP.junior]);
  const rows: PenaltyBreakdownRow[] = [];
  let lowConfidence = false;

  // --- Exposure profile (Layer 2) ---
  const exposure = exposureRiskFor(input.pharosStablecoinId);
  if (exposure.missing) lowConfidence = true;
  rows.push(
    row({
      key: "exposure-profile",
      label: exposure.profile?.strategyClass ?? "Exposure profile",
      riskLayer: "exposure",
      riskCategory: exposure.missing ? "data-confidence" : "loss-risk",
      sourceField: "pharos_stablecoin_id",
      value: exposure.profile?.strategyClass ?? input.pharosStablecoinId,
      threshold: "curated exposure score",
      direction: exposure.missing ? "missing" : "state",
      rawPenalty: ((100 - exposure.score) / 100) * EXPOSURE_HAIRCUT_CAP,
      missing: exposure.missing,
      observedAt: input.observedAt,
      explanation: exposure.explanation,
    }),
  );

  // --- Market status ---
  const status = input.statusNormalized;
  if (status == null) lowConfidence = true;
  rows.push(
    row({
      key: "status",
      label: "Market status",
      riskCategory: status == null ? "data-confidence" : "loss-risk",
      sourceField: "status_normalized",
      value: status,
      threshold: "normal",
      direction: status == null ? "missing" : "state",
      rawPenalty: statusPoints(side, status),
      missing: status == null,
      observedAt: input.observedAt,
      explanation:
        status == null
          ? "Market status is missing, so the haircut includes an uncertainty term."
          : status === "normal"
            ? "Market status is normal."
            : status === "protected"
              ? "Protection mode indicates market-level safeguards or constraints are active."
              : `Market status is ${status}.`,
    }),
  );

  // --- Coverage / first-loss position ---
  const coverageMissing = input.coverageRatio == null || input.requiredCoverageRatio == null || input.requiredCoverageRatio <= 0;
  if (side === "junior") {
    // First-loss is buffer-scaled: a thick buffer (coverage >> required) = a well-cushioned, less
    // leveraged junior; a thin one absorbs losses almost immediately.
    const cushion = coverageMissing ? 0 : clamp(input.coverageRatio! / input.requiredCoverageRatio! / JUNIOR_CUSHION_TARGET, 0, 1);
    if (coverageMissing) lowConfidence = true;
    const firstLoss = STRUCTURE_WEIGHTS.juniorFirstLoss.floor + STRUCTURE_WEIGHTS.juniorFirstLoss.leverage * (1 - cushion);
    rows.push(
      row({
        key: "junior-first-loss",
        label: "Junior first-loss (buffer-scaled)",
        riskCategory: "loss-risk",
        sourceField: "side",
        value: side,
        threshold: "junior",
        direction: "state",
        rawPenalty: firstLoss,
        missing: false,
        observedAt: input.observedAt,
        explanation: coverageMissing
          ? "Junior absorbs losses first; buffer depth is unknown, so the heaviest first-loss term applies."
          : "Junior absorbs losses first; the term scales with how thin the buffer beneath it is.",
      }),
    );
    if (!coverageMissing && input.coverageRatio! < input.requiredCoverageRatio!) {
      const shortfall = (input.requiredCoverageRatio! - input.coverageRatio!) / input.requiredCoverageRatio!;
      rows.push(
        row({
          key: "coverage",
          label: "Junior buffer below required",
          riskCategory: "loss-risk",
          sourceField: "coverage_ratio",
          value: input.coverageRatio,
          threshold: input.requiredCoverageRatio,
          direction: "lower-worse",
          rawPenalty: pick(side, STRUCTURE_WEIGHTS.coverage.belowRequiredBase) + shortfall * pick(side, STRUCTURE_WEIGHTS.coverage.belowRequiredShortfall),
          missing: false,
          observedAt: input.observedAt,
          explanation: "The current Junior buffer is below the required buffer.",
        }),
      );
    }
  } else {
    let coveragePenalty = 0;
    let coverageExplanation = "Coverage is above the watch threshold.";
    if (coverageMissing) {
      coveragePenalty = pick(side, STRUCTURE_WEIGHTS.coverage.missing);
      coverageExplanation = "Coverage current or required ratio is missing.";
      lowConfidence = true;
    } else if (input.coverageRatio! < input.requiredCoverageRatio!) {
      const shortfall = (input.requiredCoverageRatio! - input.coverageRatio!) / input.requiredCoverageRatio!;
      coveragePenalty = pick(side, STRUCTURE_WEIGHTS.coverage.belowRequiredBase) + shortfall * pick(side, STRUCTURE_WEIGHTS.coverage.belowRequiredShortfall);
      coverageExplanation = "Current Junior buffer is below the required buffer.";
    } else if (input.coverageRatio! < input.requiredCoverageRatio! * 1.25) {
      coveragePenalty = pick(side, STRUCTURE_WEIGHTS.coverage.underBuffer);
      coverageExplanation = "Current Junior buffer is less than 1.25x the required buffer.";
    }
    rows.push(
      row({
        key: "coverage",
        label: "Senior buffer (junior cushion)",
        riskCategory: coverageMissing ? "data-confidence" : "loss-risk",
        sourceField: "coverage_ratio",
        value: input.coverageRatio,
        threshold: input.requiredCoverageRatio,
        direction: coverageMissing ? "missing" : "lower-worse",
        rawPenalty: coveragePenalty,
        missing: coverageMissing,
        observedAt: input.observedAt,
        explanation: coverageExplanation,
      }),
    );
  }

  // --- Utilization (saturating; junior feels it earlier and harder) ---
  const normUtil = normalizedUtilization(input);
  const utilizationMissing = input.utilizationRatio == null || normUtil == null;
  let utilizationPenalty: number;
  let utilizationExplanation: string;
  if (utilizationMissing) {
    utilizationPenalty = pick(side, STRUCTURE_WEIGHTS.utilizationMissing);
    utilizationExplanation = "Utilization is missing.";
    lowConfidence = true;
  } else if (side === "junior") {
    utilizationPenalty = 14 * (1 - Math.exp(-3 * Math.max(0, normUtil - 0.25)));
    utilizationExplanation = "Junior utilization pressure (first-loss capital is more exposed as utilization rises).";
  } else {
    utilizationPenalty = 7 * (1 - Math.exp(-4 * Math.max(0, normUtil - 0.5)));
    utilizationExplanation = "Senior utilization pressure relative to the limit.";
  }
  rows.push(
    row({
      key: "utilization",
      label: "Utilization pressure",
      riskCategory: utilizationMissing ? "data-confidence" : "loss-risk",
      sourceField: "utilization_ratio",
      value: input.utilizationRatio,
      threshold: input.utilizationLimitRatio,
      direction: utilizationMissing ? "missing" : "higher-worse",
      rawPenalty: utilizationPenalty,
      missing: utilizationMissing,
      observedAt: input.observedAt,
      explanation: utilizationExplanation,
    }),
  );

  // --- Tranche TVL (liquidity) ---
  let tvlPenalty = 0;
  let tvlExplanation = "Tranche TVL is above the MVP liquidity floor.";
  if (input.tvlUsd == null || input.tvlUsd <= 0) {
    tvlPenalty = pick(side, STRUCTURE_WEIGHTS.tvl.missing);
    tvlExplanation = "Tranche TVL is missing or zero.";
    lowConfidence = true;
  } else if (input.tvlUsd < 100_000) {
    tvlPenalty = pick(side, STRUCTURE_WEIGHTS.tvl.under100k);
    tvlExplanation = "Tranche TVL is below $100k and visually de-emphasized.";
  } else if (input.tvlUsd < 250_000) {
    tvlPenalty = pick(side, STRUCTURE_WEIGHTS.tvl.under250k);
    tvlExplanation = "Tranche TVL is below $250k.";
  } else if (input.tvlUsd < 1_000_000) {
    tvlPenalty = pick(side, STRUCTURE_WEIGHTS.tvl.under1m);
    tvlExplanation = "Tranche TVL is below $1M.";
  }
  rows.push(
    row({
      key: "tvl",
      label: "Tranche TVL",
      riskCategory: input.tvlUsd == null ? "data-confidence" : "liquidity-friction",
      sourceField: "tranche_tvl_usd",
      value: input.tvlUsd,
      threshold: 100_000,
      direction: input.tvlUsd == null ? "missing" : "lower-worse",
      rawPenalty: tvlPenalty,
      missing: input.tvlUsd == null,
      observedAt: input.observedAt,
      explanation: tvlExplanation,
    }),
  );

  // --- Drawdown ---
  const drawdownMissing = input.drawdownRatio == null;
  if (drawdownMissing) lowConfidence = true;
  const drawdownPct = drawdownMissing ? 0 : input.drawdownRatio! * 100;
  const drawdownPenalty = Math.min(pick(side, STRUCTURE_WEIGHTS.drawdown.cap), drawdownPct * pick(side, STRUCTURE_WEIGHTS.drawdown.factor));
  rows.push(
    row({
      key: "drawdown",
      label: "Drawdown",
      riskCategory: drawdownMissing ? "data-confidence" : "loss-risk",
      sourceField: "drawdown_ratio",
      value: input.drawdownRatio,
      threshold: 0,
      direction: drawdownMissing ? "missing" : "higher-worse",
      rawPenalty: drawdownPenalty,
      missing: drawdownMissing,
      observedAt: input.observedAt,
      explanation: drawdownMissing
        ? "Drawdown data is missing, so the score is marked low-confidence."
        : drawdownPenalty > 0
          ? "Observed drawdown increases tranche-layer risk."
          : "No drawdown penalty is applied.",
    }),
  );

  // --- Venue tier (coarse placeholder, low weight) ---
  if (input.venueTier === "unknown") lowConfidence = true;
  const venuePenalty =
    input.venueTier === "low"
      ? 0
      : input.venueTier === "medium"
        ? pick(side, STRUCTURE_WEIGHTS.venue.medium)
        : input.venueTier === "high"
          ? pick(side, STRUCTURE_WEIGHTS.venue.high)
          : pick(side, STRUCTURE_WEIGHTS.venue.unknown);
  rows.push(
    row({
      key: "venue-tier",
      label: "Venue tier",
      riskLayer: "exposure",
      riskCategory: input.venueTier === "unknown" ? "data-confidence" : "access-friction",
      sourceField: "venue_tier",
      value: input.venueTier,
      threshold: "low",
      direction: input.venueTier === "unknown" ? "missing" : "state",
      rawPenalty: venuePenalty,
      missing: input.venueTier === "unknown",
      observedAt: input.observedAt,
      explanation:
        input.venueTier === "unknown" ? "Venue tier is unknown, so a small uncertainty term applies." : `Venue tier is ${input.venueTier}.`,
    }),
  );

  // --- Friction ---
  if (input.accessRestricted) {
    rows.push(
      row({
        key: "access-friction",
        label: "Access friction",
        riskLayer: "exposure",
        riskCategory: "access-friction",
        sourceField: "access_restricted",
        value: "restricted",
        threshold: "open",
        direction: "state",
        rawPenalty: pick(side, STRUCTURE_WEIGHTS.access),
        missing: false,
        observedAt: input.observedAt,
        explanation: "Access is restricted or KYC-dependent.",
      }),
    );
  }
  if (input.withdrawalUnderlyingDependent) {
    rows.push(
      row({
        key: "withdrawal-friction",
        label: "Withdrawal friction",
        riskLayer: "exposure",
        riskCategory: "liquidity-friction",
        sourceField: "withdrawal_underlying_dependent",
        value: "underlying-dependent",
        threshold: "direct",
        direction: "state",
        rawPenalty: pick(side, STRUCTURE_WEIGHTS.withdrawal),
        missing: false,
        observedAt: input.observedAt,
        explanation: "Withdrawals can depend on underlying market mechanics.",
      }),
    );
  }
  if (side === "junior" && input.juniorRedemptionDelaySeconds && input.juniorRedemptionDelaySeconds > 0) {
    rows.push(
      row({
        key: "junior-redemption-delay",
        label: "Junior redemption delay",
        riskCategory: "liquidity-friction",
        sourceField: "junior_redemption_delay_seconds",
        value: input.juniorRedemptionDelaySeconds,
        threshold: 0,
        direction: "higher-worse",
        rawPenalty: STRUCTURE_WEIGHTS.redemptionDelay,
        missing: false,
        observedAt: input.observedAt,
        explanation: "The market has an explicit Junior redemption delay.",
      }),
    );
  }

  const apy = resolveApyPct(input.apyCurrentPct, input.apy7dPct);
  const apyMissing = input.apyCurrentPct == null && input.apy7dPct == null;
  if (apyMissing) {
    lowConfidence = true;
    rows.push(
      row({
        key: "apy-availability",
        label: "APY availability",
        riskCategory: "data-confidence",
        sourceField: "apy_current_pct",
        value: null,
        threshold: "current or 7d APY observation",
        direction: "missing",
        rawPenalty: 0,
        missing: true,
        observedAt: input.observedAt,
        explanation: "Current and 7d APY are both missing, so Opportunity is low-confidence.",
      }),
    );
  }

  // --- Aggregate: three-layer Safety and numeric Opportunity ---
  const cushionCredit = seniorCushionCredit(input);
  const exposureRows = rows.filter((item) => item.riskLayer === "exposure");
  const structureRows = rows.filter((item) => item.riskLayer === "tranche-structure");
  const exposureHaircut = saturatingHaircut(exposureRows.map((item) => item.rawPenalty), EXPOSURE_HAIRCUT_CAP);
  const structureHaircut = saturatingHaircut(structureRows.map((item) => item.rawPenalty), cap);
  const exposureScore = clamp(Math.round(100 - (exposureHaircut / EXPOSURE_HAIRCUT_CAP) * 100), 0, 100);
  const structureDelta = cushionCredit - structureHaircut;
  const trancheStructureScore = clamp(Math.round(TRANCHE_STRUCTURE_NEUTRAL_SCORE + structureDelta), 0, 100);
  const safetyScore = clamp(Math.round(base - exposureHaircut + structureDelta), 0, 100);
  const penaltyBreakdown = [
    ...reconcileAppliedPenalties(exposureRows, round1(exposureHaircut)),
    ...reconcileAppliedPenalties(structureRows, round1(structureHaircut)),
  ];

  const opportunityYield = apy.value == null ? null : round2(apy.value * Math.pow(safetyScore / 100, OPPORTUNITY_GAMMA));
  const opportunityScore = opportunityScoreFromYield(opportunityYield);

  return {
    scoreStatus: input.stale ? "stale" : lowConfidence ? "low_confidence" : "computed",
    nrReason: null,
    baseAssetScore: base,
    underlyingSafetyScore: base,
    underlyingSafetyGrade: input.underlyingSafetyGrade,
    exposureScore,
    exposureHaircut: round1(exposureHaircut),
    trancheStructureScore,
    trancheHaircut: round1(structureHaircut),
    safetyScore,
    safetyGrade: safetyGradeFromScore(safetyScore),
    apyUsedPct: apy.value,
    apySource: apy.source,
    opportunityYield,
    opportunityScore,
    opportunityGrade: opportunityGradeFromYield(opportunityYield),
    penaltyBreakdown,
    inputHash: scoreHash(input),
    methodologyVersion: METHODOLOGY_VERSION,
    computedAt: now,
  };
}

function nrScore(input: ScoreInput, reason: string, now: number): ScoreResult {
  const apy = resolveApyPct(input.apyCurrentPct, input.apy7dPct);
  return {
    scoreStatus: "nr",
    nrReason: reason,
    baseAssetScore: input.underlyingSafetyScore,
    underlyingSafetyScore: input.underlyingSafetyScore,
    underlyingSafetyGrade: input.underlyingSafetyGrade,
    exposureScore: null,
    exposureHaircut: null,
    trancheStructureScore: null,
    trancheHaircut: null,
    safetyScore: null,
    safetyGrade: "NR",
    apyUsedPct: apy.value,
    apySource: apy.source,
    opportunityYield: null,
    opportunityScore: null,
    opportunityGrade: "NR",
    penaltyBreakdown: [],
    inputHash: scoreHash(input),
    methodologyVersion: METHODOLOGY_VERSION,
    computedAt: now,
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function reconcileAppliedPenalties(rows: PenaltyBreakdownRow[], headline: number) {
  const roundedHeadline = round1(headline);
  const rawPenalty = rows.reduce((sum, item) => sum + item.rawPenalty, 0);
  if (rawPenalty <= 0 || roundedHeadline <= 0) {
    return rows.map((item) => ({ ...item, appliedPenalty: 0 }));
  }

  const reconciled = rows.map((item) => ({
    ...item,
    appliedPenalty: round1(item.rawPenalty * (roundedHeadline / rawPenalty)),
  }));
  let lastAppliedIndex = -1;
  for (let index = reconciled.length - 1; index >= 0; index -= 1) {
    if (reconciled[index].appliedPenalty > 0) {
      lastAppliedIndex = index;
      break;
    }
  }
  if (lastAppliedIndex >= 0) {
    const currentTotal = round1(reconciled.reduce((sum, item) => sum + item.appliedPenalty, 0));
    reconciled[lastAppliedIndex] = {
      ...reconciled[lastAppliedIndex],
      appliedPenalty: round1(Math.max(0, reconciled[lastAppliedIndex].appliedPenalty + roundedHeadline - currentTotal)),
    };
  }

  return reconciled;
}
