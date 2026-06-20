import { ROYCO_MARKET_FIXTURES } from "./fixtures";
import { fetchWithTimeout } from "./http";
import { resolveMapping } from "./mappings";
import type { MarketStatus, RoycoMarketFixture, RoycoTrancheFixture, TrancheSide, VenueTier } from "./types";

const ROYCO_DAWN_EXPLORE_URL = "https://dawn.royco.org/api/v1/market/explore";
const ROYCO_DAWN_PAGE_SIZE = 100;
const VENUE_TIER_BY_CHAIN_ID: Record<number, VenueTier> = {
  1: "medium",
  10: "medium",
  42161: "medium",
  43114: "medium",
  8453: "medium",
};

type RoycoToken = {
  symbol?: string | null;
  name?: string | null;
  chainId?: number | null;
  contractAddress?: string | null;
  decimals?: number | null;
};

type RoycoVault = {
  address?: string | null;
  name?: string | null;
  apy?: number | null;
  apy7d?: number | null;
  tvl?: {
    tokenAmountUsd?: number | null;
  } | null;
  depositToken?: RoycoToken | null;
  shareToken?: RoycoToken | null;
};

type RoycoMarket = {
  id?: string | null;
  chainId?: number | null;
  marketId?: string | null;
  slug?: string | null;
  name?: string | null;
  listingType?: string | null;
  status?: string | null;
  tvlUsd?: number | null;
  coverage?: {
    currentRatio?: number | null;
    requiredRatio?: number | null;
  } | null;
  utilization?: {
    currentRatio?: number | null;
    requiredRatio?: number | null;
  } | null;
  drawdown?: {
    ratio?: number | null;
  } | null;
  totalDrawdowns?: number | null;
  juniorRedemptionDelay?: number | null;
  seniorVault?: RoycoVault | null;
  juniorVault?: RoycoVault | null;
};

type RoycoExploreResponse = {
  data?: RoycoMarket[];
  count?: number;
};

export type RoycoDawnLoadMode = "recorded-fixture" | "fixture-file" | "live";

export interface RoycoDawnLoadResult {
  mode: RoycoDawnLoadMode;
  markets: RoycoMarketFixture[];
  upstreamCount: number;
  parseErrorCount: number;
  rawPayloadSampleJson: string;
  warning: string | null;
}

export interface RoycoDawnLoadOptions {
  dawnLive?: string;
  fixturePath?: string;
}

export async function loadRoycoDawnMarkets(options: RoycoDawnLoadOptions = {}): Promise<RoycoDawnLoadResult> {
  const fixturePath = options.fixturePath ?? process.env.ROYCO_DAWN_FIXTURE_PATH;
  if (fixturePath) {
    const markets = await loadFixtureFile(fixturePath);
    return {
      mode: "fixture-file",
      markets,
      upstreamCount: markets.length,
      parseErrorCount: 0,
      rawPayloadSampleJson: JSON.stringify({ fixturePath, markets: markets.map((market) => market.marketId) }).slice(0, 12_000),
      warning: null,
    };
  }

  if ((options.dawnLive ?? process.env.ROYCO_DAWN_LIVE) === "1") {
    try {
      return await fetchLiveRoycoDawnMarkets();
    } catch (error) {
      return recordedFixtureResult(`Live Royco Dawn fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return recordedFixtureResult(null);
}

async function fetchLiveRoycoDawnMarkets(): Promise<RoycoDawnLoadResult> {
  const allMarkets: RoycoMarket[] = [];
  let count: number | null = null;
  let pageIndex = 0;

  while (true) {
    const res = await fetchWithTimeout(ROYCO_DAWN_EXPLORE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "royco-pharos-local/0.1",
      },
      body: JSON.stringify({
        page: { index: pageIndex, size: ROYCO_DAWN_PAGE_SIZE },
        filters: [],
        sorting: [{ id: "tvlUsd", desc: true }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Royco Dawn returned HTTP ${res.status}`);
    }

    const body = (await res.json()) as RoycoExploreResponse;
    const pageMarkets = Array.isArray(body.data) ? body.data : [];
    allMarkets.push(...pageMarkets);
    count = typeof body.count === "number" ? body.count : count;
    pageIndex += 1;

    if (pageMarkets.length < ROYCO_DAWN_PAGE_SIZE || (count != null && pageIndex * ROYCO_DAWN_PAGE_SIZE >= count)) break;
  }

  const parsedMarkets = allMarkets.map((market) => parseRoycoMarket(market));
  const markets = parsedMarkets.filter((market): market is RoycoMarketFixture => market != null);
  const parseErrorCount = parsedMarkets.length - markets.length;

  return {
    mode: "live",
    markets,
    upstreamCount: count ?? allMarkets.length,
    parseErrorCount,
    rawPayloadSampleJson: JSON.stringify({ count, sample: allMarkets.slice(0, 5) }).slice(0, 12_000),
    warning: parseErrorCount > 0 ? `${parseErrorCount} Royco Dawn market row(s) could not be parsed.` : null,
  };
}

function recordedFixtureResult(warning: string | null): RoycoDawnLoadResult {
  return {
    mode: "recorded-fixture",
    markets: ROYCO_MARKET_FIXTURES,
    upstreamCount: ROYCO_MARKET_FIXTURES.length,
    parseErrorCount: 0,
    rawPayloadSampleJson: JSON.stringify({
      source: "recorded-dawn-fixture",
      markets: ROYCO_MARKET_FIXTURES.map((market) => ({ chainId: market.chainId, marketId: market.marketId, name: market.name })),
    }).slice(0, 12_000),
    warning,
  };
}

async function readFixtureFile(path: string) {
  const [{ readFileSync }, { resolve }] = await Promise.all([import("node:fs"), import("node:path")]);
  return JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
}

async function loadFixtureFile(path: string) {
  const parsed = await readFixtureFile(path);
  if (Array.isArray(parsed)) return parsed as RoycoMarketFixture[];
  if (isObject(parsed) && Array.isArray(parsed.data)) {
    return parsed.data.flatMap((market) => {
      const parsedMarket = parseRoycoMarket(market as RoycoMarket);
      return parsedMarket ? [parsedMarket] : [];
    });
  }
  throw new Error(`Unsupported Royco Dawn fixture shape at ${path}`);
}

function parseRoycoMarket(market: RoycoMarket): RoycoMarketFixture | null {
  const chainId = finiteNumber(market.chainId);
  const marketId = market.marketId?.trim() || market.id?.trim() || market.slug?.trim();
  if (chainId == null || !marketId) return null;

  const tranches = [
    parseRoycoTranche(chainId, "senior", market.seniorVault ?? null),
    parseRoycoTranche(chainId, "junior", market.juniorVault ?? null),
  ].filter((tranche): tranche is RoycoTrancheFixture => tranche != null);

  if (tranches.length === 0) return null;

  return {
    chainId,
    chainSlug: chainSlugForId(chainId),
    marketId,
    name: market.name?.trim() || `Royco Dawn ${marketId}`,
    listingType: market.listingType?.trim() || "unknown",
    statusNormalized: normalizeStatus(market.status),
    tvlUsd: finiteNumber(market.tvlUsd),
    coverageRatio: finiteNumber(market.coverage?.currentRatio),
    requiredCoverageRatio: finiteNumber(market.coverage?.requiredRatio),
    utilizationRatio: finiteNumber(market.utilization?.currentRatio),
    utilizationLimitRatio: finiteNumber(market.utilization?.requiredRatio),
    drawdownRatio: finiteNumber(market.drawdown?.ratio),
    totalDrawdowns: integerOrNull(market.totalDrawdowns),
    juniorRedemptionDelaySeconds: integerOrNull(market.juniorRedemptionDelay),
    venueTier: venueTierForChain(chainId),
    accessRestricted: false,
    withdrawalUnderlyingDependent: true,
    tranches,
  };
}

function parseRoycoTranche(chainId: number, side: TrancheSide, vault: RoycoVault | null): RoycoTrancheFixture | null {
  if (!vault) return null;
  const depositSymbol = vault.depositToken?.symbol?.trim();
  if (!depositSymbol) return null;
  const depositAddress = vault.depositToken?.contractAddress?.trim() || "";
  // Address-authoritative resolution (with conflict detection); symbol is only a fallback.
  const mapping = resolveMapping(chainId, depositAddress, depositSymbol);
  const shareSymbol = vault.shareToken?.symbol?.trim() || `${side === "senior" ? "sr" : "jr"}${depositSymbol}`;
  // Royco Dawn does not return deposit-token decimals; prefer any upstream value, then the
  // authoritative mapping table, then a conservative 18 default.
  const decimals = integerOrNull(vault.depositToken?.decimals) ?? mapping.decimals ?? 18;

  return {
    side,
    vaultAddress: vault.address?.trim() || vault.shareToken?.contractAddress?.trim() || "",
    depositTokenSymbol: depositSymbol,
    depositTokenName: vault.depositToken?.name?.trim() || `${depositSymbol} deposit token`,
    depositTokenAddress: depositAddress,
    depositTokenDecimals: decimals,
    shareTokenSymbol: shareSymbol,
    shareTokenName: vault.shareToken?.name?.trim() || vault.name?.trim() || `${side} ${depositSymbol} Royco share`,
    shareTokenAddress: vault.shareToken?.contractAddress?.trim() || vault.address?.trim() || "",
    shareTokenDecimals: integerOrNull(vault.shareToken?.decimals) ?? 18,
    pharosStablecoinId: mapping.pharosStablecoinId,
    mappingStatus: mapping.mappingStatus,
    mappingSource: mapping.mappingSource,
    mappingConfidence: mapping.mappingConfidence,
    apyCurrentRaw: finiteNumber(vault.apy),
    apyCurrentPct: ratioToPct(finiteNumber(vault.apy)),
    // apy7d field name is unverified against a live Dawn payload; absent -> null (honest, no mislabel).
    apy7dRaw: finiteNumber(vault.apy7d),
    apy7dPct: ratioToPct(finiteNumber(vault.apy7d)),
    apyUnit: "ratio",
    apyWindow: "current",
    tvlUsd: finiteNumber(vault.tvl?.tokenAmountUsd),
  };
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function ratioToPct(value: number | null) {
  return value == null ? null : value * 100;
}

function normalizeStatus(status: string | null | undefined): MarketStatus {
  return status === "normal" || status === "protected" || status === "unhealthy" || status === "critical" ? status : null;
}

function chainSlugForId(chainId: number) {
  const slugs: Record<number, string> = {
    1: "ethereum",
    10: "optimism",
    42161: "arbitrum",
    43114: "avalanche",
    8453: "base",
  };
  return slugs[chainId] ?? `chain-${chainId}`;
}

function venueTierForChain(chainId: number): VenueTier {
  return VENUE_TIER_BY_CHAIN_ID[chainId] ?? "unknown";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}
