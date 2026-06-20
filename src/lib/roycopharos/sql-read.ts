import { buildApiMeta, buildWatchlist, compareTranches, coverageHeadroom, methodology, ratioToPct } from "./snapshot";
import { reportCardExtrasFromJson } from "./pharos-report-card";
import type {
  ApiMeta,
  ApySource,
  HistoryPoint,
  MappingStatus,
  MarketStatus,
  PenaltyBreakdownRow,
  RoycoMarketView,
  RoycoPharosSnapshot,
  RoycoTrancheView,
  ScoreStatus,
  TrancheSide,
  UnderlyingSummary,
} from "./types";

export type DbRow = Record<string, unknown>;
export type SqlValue = string | number | null;

export interface SqlReader {
  all(sql: string, params?: SqlValue[]): Promise<DbRow[]>;
  get(sql: string, params?: SqlValue[]): Promise<DbRow | null>;
}

export interface SyncRunSummary {
  runId: string | null;
  job: string | null;
  status: string | null;
  errorCode: string | null;
  startedAt: number | null;
  completedAt: number | null;
  publishedAt: number | null;
  published: boolean;
  trancheCount: number | null;
  marketCount: number | null;
}

export async function readSnapshotFromSql(reader: SqlReader): Promise<RoycoPharosSnapshot | null> {
  const marketRows = await reader.all("SELECT * FROM royco_markets ORDER BY tvl_usd DESC, name ASC");
  if (marketRows.length === 0) return null;

  const underlyings = await readPharosUnderlyingsFromSql(reader);
  const underlyingById = new Map(underlyings.map((underlying) => [underlying.pharosStablecoinId, underlying]));
  const underlyingBySymbol = new Map(underlyings.map((underlying) => [underlying.symbol, underlying]));
  const trancheRows = await reader.all(
    `SELECT
      t.tranche_id, t.chain_id, t.market_id, t.side, t.vault_address,
      t.deposit_token_symbol, t.deposit_token_name, t.deposit_token_address, t.deposit_token_decimals,
      t.share_token_symbol, t.share_token_name, t.share_token_address, t.share_token_decimals,
      t.mapping_status, t.pharos_stablecoin_id, t.apy_current_raw, t.apy_current_pct,
      t.apy_7d_raw, t.apy_7d_pct, t.tvl_usd AS tranche_tvl_usd,
      t.source_observed_at AS tranche_source_observed_at, t.collected_at AS tranche_collected_at,
      t.published_at AS tranche_published_at,
      m.chain_slug, m.market_key, m.name AS market_name, m.listing_type, m.status_normalized,
      m.coverage_ratio, m.required_coverage_ratio, m.utilization_ratio, m.utilization_limit_ratio,
      s.score_status, s.nr_reason, s.underlying_safety_score, s.underlying_safety_grade,
      s.base_asset_score, s.exposure_score, s.exposure_haircut, s.tranche_structure_score,
      s.tranche_haircut, s.safety_score, s.safety_grade, s.apy_used_pct, s.apy_source,
      s.opportunity_yield, s.opportunity_score, s.opportunity_grade,
      s.penalty_breakdown_json, s.input_hash, s.methodology_version, s.computed_at
    FROM royco_tranches t
    JOIN royco_markets m ON m.chain_id = t.chain_id AND m.market_id = t.market_id
    LEFT JOIN tranche_scores s ON s.tranche_id = t.tranche_id`,
  );

  const trancheIds = trancheRows.map((row) => stringValue(row, "tranche_id")).filter((id): id is string => Boolean(id));
  const trancheHistoryById = await readTrancheHistoryRowsByIds(reader, trancheIds, 30);

  const tranches = trancheRows.map((row) => buildTrancheViewFromRow(row, trancheHistoryById)).sort(compareTranches);
  const tranchesByMarketKey = new Map<string, RoycoTrancheView[]>();
  for (const tranche of tranches) {
    const entries = tranchesByMarketKey.get(tranche.marketKey) ?? [];
    entries.push(tranche);
    tranchesByMarketKey.set(tranche.marketKey, entries);
  }

  const marketHistories = await readMarketHistoryRowsByMarkets(
    reader,
    marketRows.map((row) => ({
      chainId: numberValue(row, "chain_id") ?? 0,
      marketId: stringValue(row, "market_id") ?? "",
    })),
    30,
  );

  const markets: RoycoMarketView[] = marketRows.map((row) => {
    const marketKey = stringValue(row, "market_key") ?? `${numberValue(row, "chain_id")}:${stringValue(row, "market_id")}`;
    const marketTranches = tranchesByMarketKey.get(marketKey) ?? [];
    const distinctUnderlyings = new Map<string, UnderlyingSummary>();
    for (const tranche of marketTranches) {
      const underlying =
        underlyingById.get(tranche.pharosStablecoinId) ?? underlyingBySymbol.get(tranche.depositTokenSymbol ?? "") ?? null;
      if (underlying) distinctUnderlyings.set(underlying.pharosStablecoinId ?? underlying.symbol, underlying);
    }

    const coverageRatio = numberValue(row, "coverage_ratio");
    const requiredCoverageRatio = numberValue(row, "required_coverage_ratio");
    const chainId = numberValue(row, "chain_id") ?? 0;
    const marketId = stringValue(row, "market_id") ?? "";
    return {
      chainId,
      chainSlug: stringValue(row, "chain_slug") ?? "unknown",
      marketId,
      marketKey,
      name: stringValue(row, "name") ?? "Royco Dawn market",
      listingType: stringValue(row, "listing_type") ?? "unknown",
      statusNormalized: marketStatusValue(row, "status_normalized"),
      tvlUsd: numberValue(row, "tvl_usd"),
      coverageRatio,
      requiredCoverageRatio,
      coverageHeadroomPct: coverageHeadroom(coverageRatio, requiredCoverageRatio),
      utilizationRatio: ratioToPct(numberValue(row, "utilization_ratio")),
      utilizationLimitRatio: ratioToPct(numberValue(row, "utilization_limit_ratio")),
      drawdownRatio: numberValue(row, "drawdown_ratio"),
      totalDrawdowns: numberValue(row, "total_drawdowns"),
      juniorRedemptionDelaySeconds: numberValue(row, "junior_redemption_delay_seconds"),
      sourceObservedAt: numberValue(row, "source_observed_at"),
      collectedAt: numberValue(row, "collected_at") ?? 0,
      publishedAt: numberValue(row, "published_at") ?? 0,
      tranches: marketTranches.sort(compareTranches),
      underlyings: [...distinctUnderlyings.values()],
      history: marketHistories.get(`${chainId}:${marketId}`) ?? { coverage: [], utilization: [], tvl: [] },
    };
  });

  const now = Math.floor(Date.now() / 1000);
  const run = await latestPublishedRun(reader);
  const generatedAt = numberValue(run, "published_at") ?? Math.max(...markets.map((market) => market.publishedAt));
  return {
    generatedAt,
    markets,
    tranches,
    underlyings,
    watchlist: buildWatchlist(tranches),
    meta: await readApiMeta(reader, now, run),
    methodology: methodology(),
  };
}

export async function readTrancheHistoryFromSql(reader: SqlReader, trancheId: string, days: number) {
  const row = await reader.get("SELECT tranche_id FROM royco_tranches WHERE tranche_id = ?", [trancheId]);
  if (!row) return null;
  return readTrancheHistoryRows(reader, trancheId, days);
}

export async function readLatestSyncRunFromSql(reader: SqlReader): Promise<SyncRunSummary | null> {
  const row = await reader.get(
    `SELECT run_id, job, status, error_code, started_at, completed_at, published_at, tranche_count, market_count
     FROM royco_sync_runs ORDER BY started_at DESC LIMIT 1`,
  );
  if (!row) return null;
  return {
    runId: stringValue(row, "run_id"),
    job: stringValue(row, "job"),
    status: stringValue(row, "status"),
    errorCode: stringValue(row, "error_code"),
    startedAt: numberValue(row, "started_at"),
    completedAt: numberValue(row, "completed_at"),
    publishedAt: numberValue(row, "published_at"),
    published: numberValue(row, "published_at") != null,
    trancheCount: numberValue(row, "tranche_count"),
    marketCount: numberValue(row, "market_count"),
  };
}

export async function readApiMetaFromSql(reader: SqlReader): Promise<ApiMeta> {
  const now = Math.floor(Date.now() / 1000);
  return readApiMeta(reader, now, await latestPublishedRun(reader));
}

export async function readPharosUnderlyingsFromSql(reader: SqlReader): Promise<UnderlyingSummary[]> {
  const rows = await reader.all(
    `SELECT pharos_stablecoin_id, symbol, name, price, supply_usd, underlying_safety_score,
      underlying_safety_grade, report_card_summary_json, source_updated_at, fetched_at
     FROM pharos_underlying_summaries
     ORDER BY symbol ASC`,
  );

  return rows.map((row) => {
    const summaryJson = stringValue(row, "report_card_summary_json");
    const pharosStablecoinId = stringValue(row, "pharos_stablecoin_id");
    const extras = reportCardExtrasFromJson(summaryJson, pharosStablecoinId);
    return {
      pharosStablecoinId,
      symbol: stringValue(row, "symbol") ?? "unknown",
      name: stringValue(row, "name") ?? stringValue(row, "symbol") ?? "Unknown",
      price: numberValue(row, "price"),
      supplyUsd: numberValue(row, "supply_usd"),
      underlyingSafetyScore: numberValue(row, "underlying_safety_score"),
      underlyingSafetyGrade: stringValue(row, "underlying_safety_grade"),
      pharosUrl: extras.pharosUrl,
      dews: extras.dews,
      upstreamDependencies: extras.upstreamDependencies,
      summary: extras.summary,
      sourceUpdatedAt: numberValue(row, "source_updated_at"),
      fetchedAt: numberValue(row, "fetched_at"),
    };
  });
}

function buildTrancheViewFromRow(row: DbRow, trancheHistoryById: Map<string, { apy: HistoryPoint[]; tvl: HistoryPoint[] }>): RoycoTrancheView {
  const trancheId = stringValue(row, "tranche_id") ?? "";
  const coverageRatio = numberValue(row, "coverage_ratio");
  const requiredCoverageRatio = numberValue(row, "required_coverage_ratio");
  return {
    trancheId,
    chainId: numberValue(row, "chain_id") ?? 0,
    chainSlug: stringValue(row, "chain_slug") ?? "unknown",
    marketId: stringValue(row, "market_id") ?? "",
    marketKey: stringValue(row, "market_key") ?? `${numberValue(row, "chain_id")}:${stringValue(row, "market_id")}`,
    marketName: stringValue(row, "market_name") ?? "Royco Dawn market",
    side: trancheSideValue(row, "side"),
    vaultAddress: stringValue(row, "vault_address") ?? "",
    depositTokenSymbol: stringValue(row, "deposit_token_symbol"),
    depositTokenName: stringValue(row, "deposit_token_name"),
    depositTokenAddress: stringValue(row, "deposit_token_address"),
    depositTokenDecimals: numberValue(row, "deposit_token_decimals"),
    shareTokenSymbol: stringValue(row, "share_token_symbol"),
    shareTokenName: stringValue(row, "share_token_name"),
    shareTokenAddress: stringValue(row, "share_token_address"),
    shareTokenDecimals: numberValue(row, "share_token_decimals"),
    mappingStatus: mappingStatusValue(row, "mapping_status"),
    pharosStablecoinId: stringValue(row, "pharos_stablecoin_id"),
    apyCurrentRaw: numberValue(row, "apy_current_raw"),
    apyCurrentPct: numberValue(row, "apy_current_pct"),
    apy7dRaw: numberValue(row, "apy_7d_raw"),
    apy7dPct: numberValue(row, "apy_7d_pct"),
    tvlUsd: numberValue(row, "tranche_tvl_usd"),
    coverageRatio,
    requiredCoverageRatio,
    coverageHeadroomPct: coverageHeadroom(coverageRatio, requiredCoverageRatio),
    utilizationRatio: ratioToPct(numberValue(row, "utilization_ratio")),
    utilizationLimitRatio: ratioToPct(numberValue(row, "utilization_limit_ratio")),
    statusNormalized: marketStatusValue(row, "status_normalized"),
    sourceObservedAt: numberValue(row, "tranche_source_observed_at"),
    collectedAt: numberValue(row, "tranche_collected_at") ?? 0,
    publishedAt: numberValue(row, "tranche_published_at") ?? 0,
    scoreStatus: scoreStatusValue(row, "score_status"),
    nrReason: stringValue(row, "nr_reason"),
    baseAssetScore: numberValue(row, "base_asset_score") ?? numberValue(row, "underlying_safety_score"),
    underlyingSafetyScore: numberValue(row, "underlying_safety_score"),
    underlyingSafetyGrade: stringValue(row, "underlying_safety_grade"),
    exposureScore: numberValue(row, "exposure_score"),
    exposureHaircut: numberValue(row, "exposure_haircut"),
    trancheStructureScore: numberValue(row, "tranche_structure_score"),
    trancheHaircut: numberValue(row, "tranche_haircut"),
    safetyScore: numberValue(row, "safety_score"),
    safetyGrade: stringValue(row, "safety_grade"),
    apyUsedPct: numberValue(row, "apy_used_pct"),
    apySource: apySourceValue(row, "apy_source"),
    opportunityYield: numberValue(row, "opportunity_yield"),
    opportunityScore: numberValue(row, "opportunity_score"),
    opportunityGrade: stringValue(row, "opportunity_grade"),
    penaltyBreakdown: penaltyRows(stringValue(row, "penalty_breakdown_json")),
    inputHash: stringValue(row, "input_hash") ?? "sha256-missing",
    methodologyVersion: stringValue(row, "methodology_version") ?? "unknown",
    computedAt: numberValue(row, "computed_at") ?? 0,
    history: trancheHistoryById.get(trancheId) ?? { apy: [], tvl: [] },
  };
}

async function readMarketHistoryRowsByMarkets(reader: SqlReader, markets: { chainId: number; marketId: string }[], days: number) {
  const histories = new Map<string, { coverage: HistoryPoint[]; utilization: HistoryPoint[]; tvl: HistoryPoint[] }>();
  for (const market of markets) {
    histories.set(`${market.chainId}:${market.marketId}`, { coverage: [], utilization: [], tvl: [] });
  }
  if (markets.length === 0) return histories;

  const cutoff = Math.floor(Date.now() / 1000) - days * 86_400;
  const requested = new Set(markets.map((market) => `${market.chainId}:${market.marketId}`));
  const rows = await reader.all(
    `SELECT chain_id, market_id, observed_at, tvl_usd, coverage_ratio, utilization_ratio
     FROM royco_market_history
     WHERE observed_at >= ?
     ORDER BY chain_id ASC, market_id ASC, observed_at ASC`,
    [cutoff],
  );

  for (const row of rows) {
    const key = `${numberValue(row, "chain_id") ?? 0}:${stringValue(row, "market_id") ?? ""}`;
    if (!requested.has(key)) continue;
    const history = histories.get(key) ?? { coverage: [], utilization: [], tvl: [] };
    const observedAt = numberValue(row, "observed_at") ?? 0;
    history.coverage.push({ observedAt, value: numberValue(row, "coverage_ratio") });
    history.utilization.push({ observedAt, value: ratioToPct(numberValue(row, "utilization_ratio")) });
    history.tvl.push({ observedAt, value: numberValue(row, "tvl_usd") });
    histories.set(key, history);
  }

  return histories;
}

async function readTrancheHistoryRows(reader: SqlReader, trancheId: string, days: number) {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86_400;
  const rows = await reader.all(
    `SELECT observed_at, apy_current_pct, tvl_usd
     FROM royco_tranche_history
     WHERE tranche_id = ? AND observed_at >= ?
     ORDER BY observed_at ASC`,
    [trancheId, cutoff],
  );
  return {
    apy: rows.map((row) => ({ observedAt: numberValue(row, "observed_at") ?? 0, value: numberValue(row, "apy_current_pct") })),
    tvl: rows.map((row) => ({ observedAt: numberValue(row, "observed_at") ?? 0, value: numberValue(row, "tvl_usd") })),
  };
}

async function readTrancheHistoryRowsByIds(reader: SqlReader, trancheIds: string[], days: number) {
  const histories = new Map<string, { apy: HistoryPoint[]; tvl: HistoryPoint[] }>();
  for (const trancheId of trancheIds) {
    histories.set(trancheId, { apy: [], tvl: [] });
  }
  if (trancheIds.length === 0) return histories;

  const cutoff = Math.floor(Date.now() / 1000) - days * 86_400;
  const requested = new Set(trancheIds);
  const rows = await reader.all(
    `SELECT tranche_id, observed_at, apy_current_pct, tvl_usd
     FROM royco_tranche_history
     WHERE observed_at >= ?
     ORDER BY tranche_id ASC, observed_at ASC`,
    [cutoff],
  );

  for (const row of rows) {
    const trancheId = stringValue(row, "tranche_id");
    if (!trancheId) continue;
    if (!requested.has(trancheId)) continue;
    const history = histories.get(trancheId) ?? { apy: [], tvl: [] };
    const observedAt = numberValue(row, "observed_at") ?? 0;
    history.apy.push({ observedAt, value: numberValue(row, "apy_current_pct") });
    history.tvl.push({ observedAt, value: numberValue(row, "tvl_usd") });
    histories.set(trancheId, history);
  }

  return histories;
}

async function readApiMeta(reader: SqlReader, now: number, run: DbRow | null): Promise<ApiMeta> {
  const royco = await reader.get("SELECT MAX(collected_at) AS collected_at, MAX(published_at) AS published_at FROM royco_markets");
  const pharos = await reader.get("SELECT MAX(fetched_at) AS fetched_at FROM pharos_underlying_summaries");
  const collectedAt = numberValue(royco, "collected_at") ?? now;
  const pharosFetchedAt = numberValue(pharos, "fetched_at") ?? collectedAt;
  const publishedAt = numberValue(run, "published_at") ?? numberValue(royco, "published_at") ?? collectedAt;
  return buildApiMeta(now, collectedAt, pharosFetchedAt, publishedAt, stringValue(run, "raw_payload_hash") ?? "sha256-db");
}

async function latestPublishedRun(reader: SqlReader) {
  return reader.get("SELECT * FROM royco_sync_runs WHERE published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1");
}

function penaltyRows(json: string | null): PenaltyBreakdownRow[] {
  const parsed = parseJson(json);
  return Array.isArray(parsed) ? (parsed as PenaltyBreakdownRow[]) : [];
}

function parseJson(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

function stringValue(row: unknown, key: string) {
  return isObject(row) && typeof row[key] === "string" ? row[key] : null;
}

function numberValue(row: unknown, key: string) {
  return isObject(row) && typeof row[key] === "number" && Number.isFinite(row[key]) ? row[key] : null;
}

function mappingStatusValue(row: DbRow, key: string): MappingStatus {
  const value = stringValue(row, key);
  return value === "mapped" || value === "unmapped" || value === "conflict" ? value : "unmapped";
}

function marketStatusValue(row: DbRow, key: string): MarketStatus {
  const value = stringValue(row, key);
  return value === "normal" || value === "protected" || value === "unhealthy" || value === "critical" ? value : null;
}

function scoreStatusValue(row: DbRow, key: string): ScoreStatus {
  const value = stringValue(row, key);
  return value === "computed" || value === "low_confidence" || value === "nr" || value === "stale" ? value : "nr";
}

function trancheSideValue(row: DbRow, key: string): TrancheSide {
  return stringValue(row, key) === "junior" ? "junior" : "senior";
}

function apySourceValue(row: DbRow, key: string): ApySource {
  const value = stringValue(row, key);
  return value === "current" || value === "7d" || value === "none" ? value : "none";
}

function isObject(value: unknown): value is DbRow {
  return typeof value === "object" && value != null;
}
