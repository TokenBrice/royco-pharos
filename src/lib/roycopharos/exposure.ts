// Curated exposure taxonomy — Layer 2 of agents/roycopharos-calibrated.md ("where the coins farm").
//
// Reference data, NOT observed data: hand-maintained like token_mappings and looked up directly by
// the UI from a tranche's pharosStablecoinId. v1 is distilled from the Pharos report-card summaries;
// migrate to Pharos report-card dimensions when those are wired live. Keep confidence honest.
//
// pegBehavior distinguishes yield-ACCRUING wrappers (share price drifts above $1 by design — a
// "deviation" is expected) from $1-TARGETING assets (where drift from $1 is a real peg signal), so
// the UI never mislabels an accruing wrapper at $1.18 as depegged.

export interface ExposureProfile {
  strategyClass: string;
  yieldSource: string;
  primaryRisk: string;
  liquidityProfile: string;
  pegBehavior: "accruing" | "stable";
  /**
   * Curated Layer 2 score, 0..100 where higher means cleaner exposure.
   * Coarse reference data until Pharos exposes structured strategy dimensions.
   */
  riskScore: number;
  riskRationale: string;
}

export const EXPOSURE_HAIRCUT_CAP = 16;
export const UNKNOWN_EXPOSURE_SCORE = 50;

export const EXPOSURE_BY_PHAROS_ID: Record<string, ExposureProfile> = {
  "autousd-auto-finance": {
    strategyClass: "Automated on-chain vault",
    yieldSource: "Automated routing across on-chain vault strategies",
    primaryRisk: "Execution venue and thin tranche liquidity",
    liquidityProfile: "Vault redemption (underlying-dependent)",
    pegBehavior: "stable",
    riskScore: 52,
    riskRationale: "Automated routing and thin market depth keep the exposure score below neutral.",
  },
  "syrupusdc-maple": {
    strategyClass: "Institutional private credit",
    yieldSource: "Fixed-term lending to vetted institutional borrowers",
    primaryRisk: "Borrower concentration and FIFO withdrawal queue",
    liquidityProfile: "FIFO withdrawal queue",
    pegBehavior: "accruing",
    riskScore: 67,
    riskRationale: "Established credit underwriting helps, but borrower concentration and queued exits remain material.",
  },
  "aa-falconx-mev-capital": {
    strategyClass: "Senior credit tranche (market-maker financing)",
    yieldSource: "Credit lines extended to trading firms (FalconX)",
    primaryRisk: "Credit-line default and monthly exit gating",
    liquidityProfile: "Monthly exit window",
    pegBehavior: "accruing",
    riskScore: 60,
    riskRationale: "Market-maker credit exposure is understandable but concentrated and gated.",
  },
  "susdai-usd-ai": {
    strategyClass: "Real-world compute lending",
    yieldSource: "Interest on GPU/compute-backed loans",
    primaryRisk: "Loan performance and queued exits",
    liquidityProfile: "Queued redemption",
    pegBehavior: "accruing",
    riskScore: 54,
    riskRationale: "Compute-backed lending is newer and exit liquidity is queued, so the exposure score stays conservative.",
  },
  "nusd-neutrl": {
    strategyClass: "Delta-neutral basis",
    yieldSource: "Hedged funding-rate (basis) capture",
    primaryRisk: "Basis blowout and redemption gating",
    liquidityProfile: "Redemption window",
    pegBehavior: "stable",
    riskScore: 56,
    riskRationale: "Basis strategies can work in normal markets but are exposed to hedge and redemption stress.",
  },
  "stcusd-cap": {
    strategyClass: "Stablecoin basket / index",
    yieldSource: "Proportional basket of yield-bearing stablecoins",
    primaryRisk: "Constituent depeg and liquidity caps",
    liquidityProfile: "Proportional-basket redemption",
    pegBehavior: "stable",
    riskScore: 62,
    riskRationale: "Basket diversification helps, while constituent depeg and cap risk keep the score moderate.",
  },
  "eearn-ember": {
    strategyClass: "Yield aggregator",
    yieldSource: "Routed across multiple yield strategies",
    primaryRisk: "Strategy dependency risk",
    liquidityProfile: "Vault redemption",
    pegBehavior: "stable",
    riskScore: 55,
    riskRationale: "Multiple strategy dependencies add operational and routing risk.",
  },
  "apyusd-apyx": {
    strategyClass: "Wrapped yield vault (ERC-4626)",
    yieldSource: "Wrapped vault yield",
    primaryRisk: "Issuer and governance watch items",
    liquidityProfile: "ERC-4626 redemption",
    pegBehavior: "stable",
    riskScore: 58,
    riskRationale: "ERC-4626 mechanics are legible, but issuer and governance dependencies stay on watch.",
  },
  "acred-apollo-securitize": {
    strategyClass: "Tokenized private credit fund",
    yieldSource: "Apollo Diversified Credit fund NAV and credit income",
    primaryRisk: "Private-credit losses, NAV opacity, and centralized fund administration",
    liquidityProfile: "Fund redemption process and secondary-market liquidity",
    pegBehavior: "accruing",
    riskScore: 49,
    riskRationale: "Recognizable manager and fund reporting help, but private-credit liquidity and centralized administration keep exposure risk elevated.",
  },
  "savusd-avant": {
    strategyClass: "Concentrated yield wrapper",
    yieldSource: "Single concentrated yield strategy",
    primaryRisk: "Issuer and strategy concentration",
    liquidityProfile: "Wrapper redemption",
    pegBehavior: "accruing",
    riskScore: 50,
    riskRationale: "Single-strategy concentration leaves little diversification in the exposure layer.",
  },
};

export function exposureFor(pharosStablecoinId: string | null | undefined): ExposureProfile | null {
  if (!pharosStablecoinId) return null;
  return EXPOSURE_BY_PHAROS_ID[pharosStablecoinId] ?? null;
}

export interface ExposureRiskReading {
  profile: ExposureProfile | null;
  score: number;
  missing: boolean;
  explanation: string;
}

export function exposureRiskFor(pharosStablecoinId: string | null | undefined): ExposureRiskReading {
  const profile = exposureFor(pharosStablecoinId);
  if (!profile) {
    return {
      profile: null,
      score: UNKNOWN_EXPOSURE_SCORE,
      missing: true,
      explanation: "No curated exposure profile is available, so a neutral uncertainty score is used.",
    };
  }
  return {
    profile,
    score: profile.riskScore,
    missing: false,
    explanation: profile.riskRationale,
  };
}

export interface PegReading {
  price: number | null;
  deviationPct: number | null; // signed (price − 1) × 100
  behavior: "accruing" | "stable" | "unknown";
  note: string;
}

/** Frame a price against the asset's intended peg behavior so accruing wrappers aren't called depegged. */
export function pegReading(price: number | null | undefined, profile: ExposureProfile | null): PegReading {
  const p = price != null && Number.isFinite(price) ? price : null;
  const deviationPct = p == null ? null : Math.round((p - 1) * 1000) / 10;
  const behavior = profile?.pegBehavior ?? "unknown";
  if (p == null) return { price: null, deviationPct: null, behavior, note: "Price unavailable." };
  if (behavior === "accruing") {
    return { price: p, deviationPct, behavior, note: "Yield-accruing share price; trading above $1 is by design, not a depeg." };
  }
  const drift = Math.abs(deviationPct ?? 0);
  return {
    price: p,
    deviationPct,
    behavior,
    note: drift <= 0.5 ? "Holding its $1 target." : drift <= 2 ? "Minor drift from the $1 target." : "Notable drift from the $1 target. Worth watching.",
  };
}
