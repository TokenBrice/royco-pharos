import {
  METHODOLOGY_VERSION,
  OPPORTUNITY_BANDS,
  OPPORTUNITY_SCORE_FULL_YIELD,
  SAFETY_BANDS,
  TRANCHE_STRUCTURE_NEUTRAL_SCORE,
  scoreTranche,
} from "./scoring";
import { EXPOSURE_HAIRCUT_CAP } from "./exposure";
import { ROYCO_MARKET_FIXTURES, UNDERLYING_FIXTURES } from "./fixtures";
import type {
  ApiMeta,
  FreshnessBlock,
  HistoryPoint,
  MethodologyPayload,
  RoycoMarketFixture,
  RoycoMarketView,
  RoycoPharosSnapshot,
  RoycoTrancheFixture,
  RoycoTrancheView,
  UnderlyingSummary,
  Watchlist,
} from "./types";

export const DISCLAIMER =
  "RoycoPharos is informational only and is not financial, investment, legal, tax, or credit-rating advice. It does not guarantee principal, APY, liquidity, tranche coverage, redemption, source accuracy, or future market behavior. Access/KYC indicators are not legal determinations. Data may be delayed, incomplete, or wrong.";

export function marketKey(chainId: number, marketId: string) {
  return `${chainId}:${marketId}`;
}

export function buildSnapshot(
  now = Math.floor(Date.now() / 1000),
  marketFixtures: RoycoMarketFixture[] = ROYCO_MARKET_FIXTURES,
  underlyingFixtures: UnderlyingSummary[] = UNDERLYING_FIXTURES,
  timing: { collectedAt?: number; pharosFetchedAt?: number; publishedAt?: number } = {},
): RoycoPharosSnapshot {
  const collectedAt = timing.collectedAt ?? now - 180;
  const fallbackPharosFetchedAt = timing.pharosFetchedAt ?? now - 420;
  const publishedAt = timing.publishedAt ?? now - 120;
  const underlyings = underlyingFixtures.map((underlying) => ({
    ...underlying,
    fetchedAt: underlying.fetchedAt ?? fallbackPharosFetchedAt,
    sourceUpdatedAt: underlying.sourceUpdatedAt ?? fallbackPharosFetchedAt - 240,
  }));
  const fetchedAts = underlyings.map((underlying) => underlying.fetchedAt ?? 0).filter((value) => value > 0);
  const pharosFetchedAt = timing.pharosFetchedAt ?? (fetchedAts.length > 0 ? Math.max(...fetchedAts) : fallbackPharosFetchedAt);
  const underlyingById = new Map(underlyings.map((underlying) => [underlying.pharosStablecoinId, underlying]));
  const underlyingBySymbol = new Map(underlyings.map((underlying) => [underlying.symbol, underlying]));
  const markets: RoycoMarketView[] = marketFixtures.map((marketFixture, marketIndex) =>
    buildMarketView(marketFixture, marketIndex, underlyingById, underlyingBySymbol, now, collectedAt, publishedAt),
  );
  const tranches = markets
    .flatMap((market) => market.tranches)
    .slice()
    .sort(compareTranches);

  return {
    generatedAt: now,
    markets,
    tranches,
    underlyings,
    watchlist: buildWatchlist(tranches),
    meta: buildApiMeta(now, collectedAt, pharosFetchedAt, publishedAt),
    methodology: methodology(),
  };
}

function buildMarketView(
  fixture: RoycoMarketFixture,
  marketIndex: number,
  underlyingById: Map<string | null, UnderlyingSummary>,
  underlyingBySymbol: Map<string, UnderlyingSummary>,
  now: number,
  collectedAt: number,
  publishedAt: number,
): RoycoMarketView {
  const key = marketKey(fixture.chainId, fixture.marketId);
  const sourceObservedAt = collectedAt - marketIndex * 30;
  const tranches = fixture.tranches.map((tranche) =>
    buildTrancheView(fixture, tranche, key, underlyingById, now, collectedAt, publishedAt, sourceObservedAt),
  );
  const distinctUnderlyings = new Map<string, UnderlyingSummary>();
  for (const tranche of tranches) {
    const underlying = underlyingById.get(tranche.pharosStablecoinId) ?? underlyingBySymbol.get(tranche.depositTokenSymbol ?? "") ?? null;
    if (underlying) distinctUnderlyings.set(underlying.pharosStablecoinId ?? underlying.symbol, underlying);
  }

  return {
    chainId: fixture.chainId,
    chainSlug: fixture.chainSlug,
    marketId: fixture.marketId,
    marketKey: key,
    name: fixture.name,
    listingType: fixture.listingType,
    statusNormalized: fixture.statusNormalized,
    tvlUsd: fixture.tvlUsd,
    coverageRatio: fixture.coverageRatio,
    requiredCoverageRatio: fixture.requiredCoverageRatio,
    coverageHeadroomPct: coverageHeadroom(fixture.coverageRatio, fixture.requiredCoverageRatio),
    utilizationRatio: ratioToPct(fixture.utilizationRatio),
    utilizationLimitRatio: ratioToPct(fixture.utilizationLimitRatio),
    drawdownRatio: fixture.drawdownRatio,
    totalDrawdowns: fixture.totalDrawdowns,
    juniorRedemptionDelaySeconds: fixture.juniorRedemptionDelaySeconds,
    sourceObservedAt,
    collectedAt,
    publishedAt,
    tranches,
    underlyings: [...distinctUnderlyings.values()],
    // History is accumulated one observation per sync in the DB (see seedDatabase);
    // the build-path snapshot carries none and the read-path fills it from royco_market_history.
    history: { coverage: [], utilization: [], tvl: [] },
  };
}

function buildTrancheView(
  market: RoycoMarketFixture,
  tranche: RoycoTrancheFixture,
  key: string,
  underlyingById: Map<string | null, UnderlyingSummary>,
  now: number,
  collectedAt: number,
  publishedAt: number,
  sourceObservedAt: number,
): RoycoTrancheView {
  const underlying = underlyingById.get(tranche.pharosStablecoinId) ?? null;
  const trancheId = `${market.chainId}:${market.marketId}:${tranche.side}`;
  const score = scoreTranche(
    {
      trancheId,
      side: tranche.side,
      mappingStatus: tranche.mappingStatus,
      pharosStablecoinId: tranche.pharosStablecoinId,
      underlyingSafetyScore: underlying?.underlyingSafetyScore ?? null,
      underlyingSafetyGrade: underlying?.underlyingSafetyGrade ?? null,
      statusNormalized: market.statusNormalized,
      coverageRatio: market.coverageRatio,
      requiredCoverageRatio: market.requiredCoverageRatio,
      utilizationRatio: market.utilizationRatio,
      utilizationLimitRatio: market.utilizationLimitRatio,
      tvlUsd: tranche.tvlUsd,
      drawdownRatio: market.drawdownRatio,
      venueTier: market.venueTier,
      accessRestricted: market.accessRestricted,
      withdrawalUnderlyingDependent: market.withdrawalUnderlyingDependent,
      juniorRedemptionDelaySeconds: market.juniorRedemptionDelaySeconds,
      apyCurrentPct: tranche.apyCurrentPct,
      apy7dPct: tranche.apy7dPct,
      observedAt: sourceObservedAt,
    },
    now,
  );

  return {
    ...score,
    trancheId,
    chainId: market.chainId,
    chainSlug: market.chainSlug,
    marketId: market.marketId,
    marketKey: key,
    marketName: market.name,
    side: tranche.side,
    vaultAddress: tranche.vaultAddress,
    depositTokenSymbol: tranche.depositTokenSymbol,
    depositTokenName: tranche.depositTokenName,
    depositTokenAddress: tranche.depositTokenAddress,
    depositTokenDecimals: tranche.depositTokenDecimals,
    shareTokenSymbol: tranche.shareTokenSymbol,
    shareTokenName: tranche.shareTokenName,
    shareTokenAddress: tranche.shareTokenAddress,
    shareTokenDecimals: tranche.shareTokenDecimals,
    mappingStatus: tranche.mappingStatus,
    pharosStablecoinId: tranche.pharosStablecoinId,
    apyCurrentRaw: tranche.apyCurrentRaw,
    apyCurrentPct: tranche.apyCurrentPct,
    apy7dRaw: tranche.apy7dRaw,
    apy7dPct: tranche.apy7dPct,
    tvlUsd: tranche.tvlUsd,
    coverageRatio: market.coverageRatio,
    requiredCoverageRatio: market.requiredCoverageRatio,
    coverageHeadroomPct: coverageHeadroom(market.coverageRatio, market.requiredCoverageRatio),
    utilizationRatio: ratioToPct(market.utilizationRatio),
    utilizationLimitRatio: ratioToPct(market.utilizationLimitRatio),
    statusNormalized: market.statusNormalized,
    sourceObservedAt,
    collectedAt,
    publishedAt,
    // See note in buildMarketView: real history is appended per sync and read back from the DB.
    history: { apy: [], tvl: [] },
  };
}

export function buildApiMeta(
  now: number,
  collectedAt: number,
  pharosFetchedAt: number,
  publishedAt: number,
  inputHash = "sha256-fixture",
): ApiMeta {
  const roycoAge = now - collectedAt;
  const pharosAge = now - pharosFetchedAt;
  return {
    royco: freshness({ now, at: collectedAt, publishedAt, freshSeconds: 15 * 60, staleSeconds: 60 * 60 }),
    pharos: freshness({ now, at: pharosFetchedAt, publishedAt: pharosFetchedAt, freshSeconds: 60 * 60, staleSeconds: 3 * 60 * 60 }),
    score: {
      computedAt: publishedAt,
      inputHash,
      ageSeconds: now - publishedAt,
      status: roycoAge <= 15 * 60 && pharosAge <= 60 * 60 ? "fresh" : "degraded",
      warning: null,
    },
  };
}

function freshness({
  now,
  at,
  publishedAt,
  freshSeconds,
  staleSeconds,
}: {
  now: number;
  at: number;
  publishedAt: number;
  freshSeconds: number;
  staleSeconds: number;
}): FreshnessBlock {
  const ageSeconds = now - at;
  return {
    collectedAt: at,
    fetchedAt: at,
    sourceObservedAt: at,
    sourceUpdatedAt: at,
    publishedAt,
    ageSeconds,
    status: ageSeconds <= freshSeconds ? "fresh" : ageSeconds <= staleSeconds ? "degraded" : "stale",
    warning: ageSeconds > staleSeconds ? "Data exceeds the MVP stale threshold." : null,
  };
}

export interface ChangeFeedEntry {
  marketKey: string;
  marketName: string;
  label: string;
  detail: string;
  severity: "watch" | "warning";
}

function lastTwo(points: HistoryPoint[]): { prev: number; last: number } | null {
  const values = points.map((point) => point.value).filter((value): value is number => value != null && Number.isFinite(value));
  return values.length >= 2 ? { prev: values[values.length - 2], last: values[values.length - 1] } : null;
}

function formatChangePair(prev: number, last: number, unit: string, initialDigits: number) {
  let digits = initialDigits;
  let prevText = prev.toFixed(digits);
  let lastText = last.toFixed(digits);
  while (prevText === lastText && digits < 4) {
    digits += 1;
    prevText = prev.toFixed(digits);
    lastText = last.toFixed(digits);
  }
  return `${prevText}${unit} -> ${lastText}${unit}`;
}

/**
 * Real deterioration feed derived from the two most recent observed points per market (requires
 * >= 2 syncs of accumulated history). Unlike the absolute-threshold watchlist, this reports actual
 * movement: coverage falling, utilization rising, or TVL dropping. Empty until history accumulates
 * or when nothing materially moved.
 */
export function buildChangeFeed(markets: RoycoMarketView[]): ChangeFeedEntry[] {
  const entries: ChangeFeedEntry[] = [];
  for (const market of markets) {
    const base = { marketKey: market.marketKey, marketName: market.name };

    const coverage = lastTwo(market.history.coverage);
    if (coverage && coverage.last < coverage.prev) {
      entries.push({
        ...base,
        label: "Coverage headroom declining",
        detail: formatChangePair(coverage.prev, coverage.last, "x", 2),
        severity: coverage.last < market.requiredCoverageRatio! ? "warning" : "watch",
      });
    }

    const utilization = lastTwo(market.history.utilization);
    if (utilization && utilization.last > utilization.prev) {
      entries.push({
        ...base,
        label: "Utilization rising",
        detail: formatChangePair(utilization.prev, utilization.last, "%", 1),
        severity: utilization.last >= 85 ? "warning" : "watch",
      });
    }

    const tvl = lastTwo(market.history.tvl);
    if (tvl && tvl.prev > 0 && tvl.last < tvl.prev * 0.95) {
      entries.push({
        ...base,
        label: "TVL dropping",
        detail: `${(((tvl.last - tvl.prev) / tvl.prev) * 100).toFixed(1)}%`,
        severity: "watch",
      });
    }
  }
  return entries.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1));
}

export function buildWatchlist(tranches: RoycoTrancheView[]): Watchlist {
  return {
    coverageDeclining: tranches
      .filter((tranche) => tranche.coverageHeadroomPct != null && tranche.coverageHeadroomPct < 10)
      .slice(0, 4),
    utilizationPressure: tranches.filter((tranche) => (tranche.utilizationRatio ?? 0) >= 85).slice(0, 4),
    statusWarnings: tranches.filter((tranche) => tranche.statusNormalized && tranche.statusNormalized !== "normal").slice(0, 4),
    staleOrMissing: tranches
      .filter((tranche) => tranche.scoreStatus !== "computed" || tranche.mappingStatus !== "mapped")
      .slice(0, 4),
  };
}

export function methodology(): MethodologyPayload {
  return {
    version: METHODOLOGY_VERSION,
    safetyScoreName: "Royco Safety Score",
    opportunityScoreName: "Royco Opportunity Score",
    safetyFormula:
      "clamp(round(pharosBaseScore - exposureHaircut + seniorCushionCredit - trancheStructureHaircut), 0, 100)",
    opportunityFormula: `clamp(round((APY x (Safety / 100) ^ gamma) / ${OPPORTUNITY_SCORE_FULL_YIELD}% * 100), 0, 100)`,
    safetyBands: [...SAFETY_BANDS],
    opportunityBands: [...OPPORTUNITY_BANDS],
    layerFactors: [
      "Layer 1 Base asset: Pharos Safety Score and grade are shown verbatim.",
      `Layer 2 Exposure: curated service/protocol score, converted to a bounded haircut with a ${EXPOSURE_HAIRCUT_CAP}-point cap.`,
      `Layer 3 Tranche structure: neutral score ${TRANCHE_STRUCTURE_NEUTRAL_SCORE}, plus Senior cushion credit, minus bounded structure haircut.`,
    ],
    structureFactors: [
      "Market status: normal, Protection mode, unhealthy, or critical.",
      "Junior first-loss, buffer-scaled: the thinner the buffer beneath, the heavier the term.",
      "Utilization: saturating pressure against the limit; Junior feels it earlier and harder.",
      "Coverage: current Junior buffer vs required buffer.",
      "Tranche TVL: below $100k, $250k, or $1M adds liquidity-friction terms.",
      "Venue tier, drawdown, access friction, withdrawal friction, Junior redemption delay.",
    ],
    disclaimer: DISCLAIMER,
  };
}

export function coverageHeadroom(coverageRatio: number | null, requiredCoverageRatio: number | null) {
  if (coverageRatio == null || requiredCoverageRatio == null || requiredCoverageRatio <= 0) return null;
  return ((coverageRatio - requiredCoverageRatio) / requiredCoverageRatio) * 100;
}

export function ratioToPct(value: number | null) {
  return value == null ? null : value * 100;
}

export function compareTranches(a: RoycoTrancheView, b: RoycoTrancheView) {
  const aScore = a.safetyScore ?? -1;
  const bScore = b.safetyScore ?? -1;
  if (bScore !== aScore) return bScore - aScore;
  const coverageDelta = (b.coverageHeadroomPct ?? -999) - (a.coverageHeadroomPct ?? -999);
  if (coverageDelta !== 0) return coverageDelta;
  const utilizationDelta = (a.utilizationRatio ?? 999) - (b.utilizationRatio ?? 999);
  if (utilizationDelta !== 0) return utilizationDelta;
  return b.collectedAt - a.collectedAt;
}
