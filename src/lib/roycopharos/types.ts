export type TrancheSide = "senior" | "junior";
export type MappingStatus = "mapped" | "unmapped" | "conflict";
export type MarketStatus = "normal" | "protected" | "unhealthy" | "critical" | null;
export type ScoreStatus = "computed" | "low_confidence" | "nr" | "stale";
export type FreshnessStatus = "fresh" | "degraded" | "stale";
export type VenueTier = "low" | "medium" | "high" | "unknown";
export type RiskLayer = "exposure" | "tranche-structure";

export interface FreshnessBlock {
  collectedAt?: number | null;
  fetchedAt?: number | null;
  sourceObservedAt?: number | null;
  sourceUpdatedAt?: number | null;
  publishedAt?: number | null;
  computedAt?: number | null;
  inputHash?: string | null;
  ageSeconds: number | null;
  status: FreshnessStatus;
  warning: string | null;
}

export interface ApiMeta {
  royco: FreshnessBlock;
  pharos: FreshnessBlock;
  score: FreshnessBlock;
}

export interface UnderlyingSummary {
  pharosStablecoinId: string | null;
  symbol: string;
  name: string;
  price: number | null;
  supplyUsd: number | null;
  underlyingSafetyScore: number | null;
  underlyingSafetyGrade: string | null;
  pharosUrl: string | null;
  dews: PharosDewsSignal | null;
  upstreamDependencies: PharosDependency[];
  summary: string;
  sourceUpdatedAt: number | null;
  fetchedAt: number | null;
}

export interface PharosDewsSignal {
  status: string;
  stressScore: number | null;
  summary: string | null;
  observedAt: number | null;
  updatedAt: number | null;
}

export interface PharosDependency {
  id: string | null;
  name: string;
  symbol: string | null;
  weightPct: number | null;
  safetyScore: number | null;
  safetyGrade: string | null;
  pharosUrl: string | null;
  relationship: string | null;
}

export interface PenaltyBreakdownRow {
  key: string;
  label: string;
  riskLayer: RiskLayer;
  riskCategory: "loss-risk" | "liquidity-friction" | "data-confidence" | "access-friction";
  sourceField: string;
  value: number | string | null;
  threshold: number | string | null;
  direction: "higher-worse" | "lower-worse" | "state" | "missing";
  rawPenalty: number;
  appliedPenalty: number;
  missing: boolean;
  severity: "info" | "watch" | "warning" | "critical";
  observedAt: number | null;
  explanation: string;
}

export interface RoycoMarketFixture {
  chainId: number;
  chainSlug: string;
  marketId: string;
  name: string;
  listingType: string;
  statusNormalized: MarketStatus;
  tvlUsd: number | null;
  coverageRatio: number | null;
  requiredCoverageRatio: number | null;
  utilizationRatio: number | null;
  utilizationLimitRatio: number | null;
  drawdownRatio: number | null;
  totalDrawdowns: number | null;
  juniorRedemptionDelaySeconds: number | null;
  venueTier: VenueTier;
  accessRestricted: boolean;
  withdrawalUnderlyingDependent: boolean;
  tranches: RoycoTrancheFixture[];
}

export interface RoycoTrancheFixture {
  side: TrancheSide;
  vaultAddress: string;
  depositTokenSymbol: string;
  depositTokenName: string;
  depositTokenAddress: string;
  depositTokenDecimals: number;
  shareTokenSymbol: string;
  shareTokenName: string;
  shareTokenAddress: string;
  shareTokenDecimals: number;
  pharosStablecoinId: string | null;
  mappingStatus: MappingStatus;
  mappingSource: string;
  mappingConfidence: string;
  apyCurrentRaw: number | null;
  apyCurrentPct: number | null;
  apy7dRaw: number | null;
  apy7dPct: number | null;
  apyUnit: "ratio";
  apyWindow: string;
  tvlUsd: number | null;
}

export interface ScoreInput {
  trancheId: string;
  side: TrancheSide | null;
  mappingStatus: MappingStatus;
  pharosStablecoinId: string | null;
  underlyingSafetyScore: number | null;
  underlyingSafetyGrade: string | null;
  statusNormalized: MarketStatus;
  coverageRatio: number | null;
  requiredCoverageRatio: number | null;
  utilizationRatio: number | null;
  utilizationLimitRatio: number | null;
  tvlUsd: number | null;
  drawdownRatio: number | null;
  venueTier: VenueTier;
  accessRestricted: boolean;
  withdrawalUnderlyingDependent: boolean;
  juniorRedemptionDelaySeconds: number | null;
  apyCurrentPct: number | null;
  apy7dPct: number | null;
  observedAt: number | null;
  stale?: boolean;
}

export type ApySource = "current" | "7d" | "none";

export interface ScoreResult {
  scoreStatus: ScoreStatus;
  nrReason: string | null;
  // Vault input — Pharos, shown verbatim. It informs the tranche score but is not a hard ceiling.
  baseAssetScore: number | null;
  underlyingSafetyScore: number | null;
  underlyingSafetyGrade: string | null;
  // Layer 2: curated exposure score and bounded exposure haircut.
  exposureScore: number | null;
  exposureHaircut: number | null;
  // Layer 3: tranche mechanics score and saturated, bounded structure haircut.
  trancheStructureScore: number | null;
  trancheHaircut: number | null;
  // Safety headline — independent tranche capital-risk grade.
  safetyScore: number | null;
  safetyGrade: string | null;
  // Opportunity headline — risk-adjusted yield (netYield = APY x (Safety/100)^gamma).
  apyUsedPct: number | null;
  apySource: ApySource;
  opportunityYield: number | null;
  opportunityScore: number | null;
  opportunityGrade: string | null;
  penaltyBreakdown: PenaltyBreakdownRow[];
  inputHash: string;
  methodologyVersion: string;
  computedAt: number;
}

export interface HistoryPoint {
  observedAt: number;
  value: number | null;
}

export interface RoycoTrancheView extends ScoreResult {
  trancheId: string;
  chainId: number;
  chainSlug: string;
  marketId: string;
  marketKey: string;
  marketName: string;
  side: TrancheSide;
  vaultAddress: string;
  depositTokenSymbol: string | null;
  depositTokenName: string | null;
  depositTokenAddress: string | null;
  depositTokenDecimals: number | null;
  shareTokenSymbol: string | null;
  shareTokenName: string | null;
  shareTokenAddress: string | null;
  shareTokenDecimals: number | null;
  mappingStatus: MappingStatus;
  pharosStablecoinId: string | null;
  apyCurrentRaw: number | null;
  apyCurrentPct: number | null;
  apy7dRaw: number | null;
  apy7dPct: number | null;
  tvlUsd: number | null;
  coverageRatio: number | null;
  requiredCoverageRatio: number | null;
  coverageHeadroomPct: number | null;
  utilizationRatio: number | null;
  utilizationLimitRatio: number | null;
  statusNormalized: MarketStatus;
  sourceObservedAt: number | null;
  collectedAt: number;
  publishedAt: number;
  history: {
    apy: HistoryPoint[];
    tvl: HistoryPoint[];
  };
}

export interface RoycoMarketView {
  chainId: number;
  chainSlug: string;
  marketId: string;
  marketKey: string;
  name: string;
  listingType: string;
  statusNormalized: MarketStatus;
  tvlUsd: number | null;
  coverageRatio: number | null;
  requiredCoverageRatio: number | null;
  coverageHeadroomPct: number | null;
  utilizationRatio: number | null;
  utilizationLimitRatio: number | null;
  drawdownRatio: number | null;
  totalDrawdowns: number | null;
  juniorRedemptionDelaySeconds: number | null;
  sourceObservedAt: number | null;
  collectedAt: number;
  publishedAt: number;
  tranches: RoycoTrancheView[];
  underlyings: UnderlyingSummary[];
  history: {
    coverage: HistoryPoint[];
    utilization: HistoryPoint[];
    tvl: HistoryPoint[];
  };
}

export interface Watchlist {
  coverageDeclining: RoycoTrancheView[];
  utilizationPressure: RoycoTrancheView[];
  statusWarnings: RoycoTrancheView[];
  staleOrMissing: RoycoTrancheView[];
}

export interface GradeBand {
  grade: string;
  min: number;
}

export interface MethodologyPayload {
  version: string;
  safetyScoreName: "Royco Safety Score";
  opportunityScoreName: "Royco Opportunity Score";
  safetyFormula: string;
  opportunityFormula: string;
  safetyBands: GradeBand[];
  opportunityBands: GradeBand[];
  layerFactors: string[];
  structureFactors: string[];
  disclaimer: string;
}

export interface RoycoPharosSnapshot {
  generatedAt: number;
  markets: RoycoMarketView[];
  tranches: RoycoTrancheView[];
  underlyings: UnderlyingSummary[];
  watchlist: Watchlist;
  meta: ApiMeta;
  methodology: MethodologyPayload;
}

export interface PharosApiCacheEntry {
  endpoint: string;
  cacheKey: string;
  bodyJson: string;
  bodyHash: string;
  httpStatus: number;
  xDataAge: string | null;
  warning: string | null;
  fetchedAt: number;
  sourceUpdatedAt: number | null;
  expiresAt: number | null;
  staleIfErrorUntil: number | null;
  generation: number;
  errorCode: string | null;
}
