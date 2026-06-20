import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-reader";
import { serializeUnderlyingReportCard } from "./pharos-report-card";
import { validatePublishCandidate } from "./publish-validation";
import type { PharosApiCacheEntry, RoycoPharosSnapshot } from "./types";

interface PublishD1Options {
  job?: string;
  upstreamCount?: number;
  parseErrorCount?: number;
  rawPayloadSampleJson?: string;
  pharosCacheEntries?: PharosApiCacheEntry[];
  blockPublishReason?: string | null;
  metadata?: Record<string, unknown>;
}

type SqlValue = string | number | null;
type DbRow = Record<string, unknown>;
type InsertRow = SqlValue[];

const D1_MAX_BOUND_PARAMS = 100;

interface SyncRunInsert {
  runId: string;
  job: string;
  rawHash: string;
  upstreamCount: number;
  marketCount: number;
  trancheCount: number;
  parseErrorCount: number;
  rawPayload: string;
  startedAt: number;
  completedAt: number | null;
  status: string;
  errorCode: string | null;
  metadataJson: string;
  publishedAt: number | null;
}

export async function publishSnapshotToD1(db: D1DatabaseLike, snapshot: RoycoPharosSnapshot, options: PublishD1Options = {}) {
  const runId = crypto.randomUUID();
  const startedAt = snapshot.generatedAt;
  const rawPayload =
    options.rawPayloadSampleJson ??
    JSON.stringify({
      markets: snapshot.markets.map((market) => market.marketKey),
      tranches: snapshot.tranches.map((tranche) => tranche.trancheId),
    });
  const rawHash = await bodyHash(rawPayload);
  const existingTrancheCount = numberValue(await db.prepare("SELECT COUNT(*) AS count FROM royco_tranches").first(), "count") ?? 0;
  const latestPublishedAt =
    numberValue(await db.prepare("SELECT MAX(published_at) AS published_at FROM royco_sync_runs WHERE published_at IS NOT NULL").first(), "published_at") ??
    null;
  const computedTrancheCount = snapshot.tranches.filter((tranche) => tranche.scoreStatus !== "nr").length;
  const validation = validatePublishCandidate({
    trancheCount: snapshot.tranches.length,
    computedTrancheCount,
    hasPrior: existingTrancheCount > 0,
    latestPublishedAt,
    generatedAt: snapshot.generatedAt,
    blockPublishReason: options.blockPublishReason ?? null,
  });

  if (!validation.publish) {
    await insertSyncRun(db, {
      runId,
      job: options.job ?? "worker-sync",
      rawHash,
      upstreamCount: options.upstreamCount ?? snapshot.markets.length,
      marketCount: snapshot.markets.length,
      trancheCount: snapshot.tranches.length,
      parseErrorCount: options.parseErrorCount ?? 0,
      rawPayload,
      startedAt,
      completedAt: snapshot.generatedAt,
      status: validation.status,
      errorCode: validation.errorCode,
      metadataJson: JSON.stringify({ ...snapshot.meta, ...options.metadata }),
      publishedAt: null,
    });
    return {
      runId,
      dbPath: "d1:DB",
      marketCount: snapshot.markets.length,
      trancheCount: snapshot.tranches.length,
      status: validation.status,
      errorCode: validation.errorCode,
      published: false,
    };
  }

  await insertSyncRun(db, {
    runId,
    job: options.job ?? "worker-sync",
    rawHash,
    upstreamCount: options.upstreamCount ?? snapshot.markets.length,
    marketCount: snapshot.markets.length,
    trancheCount: snapshot.tranches.length,
    parseErrorCount: options.parseErrorCount ?? 0,
    rawPayload,
    startedAt,
    completedAt: null,
    status: "running",
    errorCode: null,
    metadataJson: JSON.stringify({ ...snapshot.meta, ...options.metadata }),
    publishedAt: null,
  });

  const statements: D1PreparedStatementLike[] = [
    prepare(db, "DELETE FROM token_mappings"),
    prepare(db, "DELETE FROM royco_markets"),
    prepare(db, "DELETE FROM royco_tranches"),
    prepare(db, "DELETE FROM pharos_underlying_summaries"),
    prepare(db, "DELETE FROM pharos_api_cache"),
    prepare(db, "DELETE FROM tranche_scores"),
  ];

  const historyObservedAt = Math.floor(snapshot.generatedAt / 60) * 60;

  pushInsertRows(
    db,
    statements,
    "pharos_api_cache",
    [
      "endpoint",
      "cache_key",
      "body_json",
      "body_hash",
      "http_status",
      "x_data_age",
      "warning",
      "fetched_at",
      "source_updated_at",
      "expires_at",
      "stale_if_error_until",
      "generation",
      "error_code",
    ],
    (options.pharosCacheEntries ?? []).map((cacheEntry) => [
      cacheEntry.endpoint,
      cacheEntry.cacheKey,
      cacheEntry.bodyJson,
      cacheEntry.bodyHash,
      cacheEntry.httpStatus,
      cacheEntry.xDataAge,
      cacheEntry.warning,
      cacheEntry.fetchedAt,
      cacheEntry.sourceUpdatedAt,
      cacheEntry.expiresAt,
      cacheEntry.staleIfErrorUntil,
      cacheEntry.generation,
      cacheEntry.errorCode,
    ]),
  );

  pushInsertRows(
    db,
    statements,
    "pharos_underlying_summaries",
    [
      "pharos_stablecoin_id",
      "symbol",
      "name",
      "price",
      "supply_usd",
      "underlying_safety_score",
      "underlying_safety_grade",
      "report_card_summary_json",
      "pharos_safety_methodology_version",
      "pharos_cache_generation",
      "source_updated_at",
      "fetched_at",
    ],
    snapshot.underlyings.map((underlying) => [
      underlying.pharosStablecoinId ?? underlying.symbol,
      underlying.symbol,
      underlying.name,
      underlying.price,
      underlying.supplyUsd,
      underlying.underlyingSafetyScore,
      underlying.underlyingSafetyGrade,
      serializeUnderlyingReportCard(underlying),
      "fixture",
      1,
      underlying.sourceUpdatedAt,
      underlying.fetchedAt ?? snapshot.generatedAt,
    ]),
  );

  pushInsertRows(
    db,
    statements,
    "royco_markets",
    [
      "chain_id",
      "chain_slug",
      "market_id",
      "market_key",
      "name",
      "listing_type",
      "status_raw",
      "status_normalized",
      "tvl_usd",
      "coverage_ratio",
      "required_coverage_ratio",
      "utilization_ratio",
      "utilization_limit_ratio",
      "drawdown_ratio",
      "total_drawdowns",
      "junior_redemption_delay_seconds",
      "royco_run_id",
      "source_observed_at",
      "collected_at",
      "published_at",
      "updated_at",
    ],
    snapshot.markets.map((market) => [
      market.chainId,
      market.chainSlug,
      market.marketId,
      market.marketKey,
      market.name,
      market.listingType,
      market.statusNormalized,
      market.statusNormalized,
      market.tvlUsd,
      market.coverageRatio,
      market.requiredCoverageRatio,
      market.utilizationRatio == null ? null : market.utilizationRatio / 100,
      market.utilizationLimitRatio == null ? null : market.utilizationLimitRatio / 100,
      market.drawdownRatio,
      market.totalDrawdowns,
      market.juniorRedemptionDelaySeconds,
      runId,
      market.sourceObservedAt,
      market.collectedAt,
      market.publishedAt,
      snapshot.generatedAt,
    ]),
  );

  pushInsertRows(
    db,
    statements,
    "royco_market_history",
    [
      "chain_id",
      "market_id",
      "observed_at",
      "tvl_usd",
      "coverage_ratio",
      "required_coverage_ratio",
      "utilization_ratio",
      "utilization_limit_ratio",
      "drawdown_ratio",
      "total_drawdowns",
      "status_normalized",
      "royco_run_id",
      "collected_at",
      "published_at",
    ],
    snapshot.markets.map((market) => [
      market.chainId,
      market.marketId,
      historyObservedAt,
      market.tvlUsd,
      market.coverageRatio,
      market.requiredCoverageRatio,
      market.utilizationRatio == null ? null : market.utilizationRatio / 100,
      market.utilizationLimitRatio == null ? null : market.utilizationLimitRatio / 100,
      market.drawdownRatio,
      market.totalDrawdowns,
      market.statusNormalized,
      runId,
      market.collectedAt,
      market.publishedAt,
    ]),
  );

  pushInsertRows(
    db,
    statements,
    "token_mappings",
    [
      "chain_id",
      "chain_slug",
      "deposit_token_address",
      "deposit_token_symbol",
      "pharos_stablecoin_id",
      "mapping_status",
      "mapping_source",
      "confidence",
      "reviewed_by",
      "reviewed_at",
      "created_at",
      "updated_at",
    ],
    snapshot.tranches.map((tranche) => [
      tranche.chainId,
      tranche.chainSlug,
      tranche.depositTokenAddress,
      tranche.depositTokenSymbol,
      tranche.pharosStablecoinId,
      tranche.mappingStatus,
      tranche.mappingStatus === "mapped" ? "manual-reviewed" : "royco-provided",
      tranche.mappingStatus === "mapped" ? "manual" : "probable",
      "prototype",
      snapshot.generatedAt,
      snapshot.generatedAt,
      snapshot.generatedAt,
    ]),
  );

  pushInsertRows(
    db,
    statements,
    "royco_tranches",
    [
      "tranche_id",
      "chain_id",
      "market_id",
      "side",
      "vault_address",
      "deposit_token_symbol",
      "deposit_token_name",
      "deposit_token_address",
      "deposit_token_decimals",
      "share_token_symbol",
      "share_token_name",
      "share_token_address",
      "share_token_decimals",
      "mapping_status",
      "pharos_stablecoin_id",
      "apy_current_raw",
      "apy_current_pct",
      "apy_7d_raw",
      "apy_7d_pct",
      "apy_unit",
      "apy_window",
      "tvl_usd",
      "source_url",
      "royco_run_id",
      "source_observed_at",
      "collected_at",
      "published_at",
      "updated_at",
    ],
    snapshot.tranches.map((tranche) => [
      tranche.trancheId,
      tranche.chainId,
      tranche.marketId,
      tranche.side,
      tranche.vaultAddress,
      tranche.depositTokenSymbol,
      tranche.depositTokenName,
      tranche.depositTokenAddress,
      tranche.depositTokenDecimals,
      tranche.shareTokenSymbol,
      tranche.shareTokenName,
      tranche.shareTokenAddress,
      tranche.shareTokenDecimals,
      tranche.mappingStatus,
      tranche.pharosStablecoinId,
      tranche.apyCurrentRaw,
      tranche.apyCurrentPct,
      tranche.apy7dRaw,
      tranche.apy7dPct,
      "ratio",
      "current",
      tranche.tvlUsd,
      "https://dawn.royco.org/",
      runId,
      tranche.sourceObservedAt,
      tranche.collectedAt,
      tranche.publishedAt,
      snapshot.generatedAt,
    ]),
  );

  pushInsertRows(
    db,
    statements,
    "royco_tranche_history",
    [
      "tranche_id",
      "chain_id",
      "market_id",
      "side",
      "observed_at",
      "apy_current_raw",
      "apy_current_pct",
      "apy_7d_raw",
      "apy_7d_pct",
      "tvl_usd",
      "royco_run_id",
      "collected_at",
      "published_at",
    ],
    snapshot.tranches.map((tranche) => [
      tranche.trancheId,
      tranche.chainId,
      tranche.marketId,
      tranche.side,
      historyObservedAt,
      tranche.apyCurrentRaw,
      tranche.apyCurrentPct,
      tranche.apy7dRaw,
      tranche.apy7dPct,
      tranche.tvlUsd,
      runId,
      tranche.collectedAt,
      tranche.publishedAt,
    ]),
  );

  pushInsertRows(
    db,
    statements,
    "tranche_scores",
    [
      "tranche_id",
      "pharos_stablecoin_id",
      "mapping_status",
      "score_status",
      "nr_reason",
      "underlying_safety_score",
      "underlying_safety_grade",
      "base_asset_score",
      "exposure_score",
      "exposure_haircut",
      "tranche_structure_score",
      "tranche_haircut",
      "safety_score",
      "safety_grade",
      "apy_used_pct",
      "apy_source",
      "opportunity_yield",
      "opportunity_score",
      "opportunity_grade",
      "penalty_breakdown_json",
      "royco_run_id",
      "pharos_cache_generation",
      "input_hash",
      "methodology_version",
      "pharos_safety_methodology_version",
      "royco_freshness_status",
      "pharos_freshness_status",
      "computed_at",
    ],
    snapshot.tranches.map((tranche) => [
      tranche.trancheId,
      tranche.pharosStablecoinId,
      tranche.mappingStatus,
      tranche.scoreStatus,
      tranche.nrReason,
      tranche.underlyingSafetyScore,
      tranche.underlyingSafetyGrade,
      tranche.baseAssetScore,
      tranche.exposureScore,
      tranche.exposureHaircut,
      tranche.trancheStructureScore,
      tranche.trancheHaircut,
      tranche.safetyScore,
      tranche.safetyGrade,
      tranche.apyUsedPct,
      tranche.apySource,
      tranche.opportunityYield,
      tranche.opportunityScore,
      tranche.opportunityGrade,
      JSON.stringify(tranche.penaltyBreakdown),
      runId,
      1,
      tranche.inputHash,
      tranche.methodologyVersion,
      "fixture",
      snapshot.meta.royco.status,
      snapshot.meta.pharos.status,
      tranche.computedAt,
    ]),
  );

  const retentionCutoff = historyObservedAt - 30 * 86_400;
  statements.push(
    prepare(db, "DELETE FROM royco_market_history WHERE observed_at < ?", [retentionCutoff]),
    prepare(db, "DELETE FROM royco_tranche_history WHERE observed_at < ?", [retentionCutoff]),
    prepare(
      db,
      `UPDATE royco_sync_runs
       SET completed_at = ?, status = ?, error_code = ?, metadata_json = ?, published_at = ?
       WHERE run_id = ?`,
      [
        snapshot.generatedAt,
        validation.status,
        validation.errorCode,
        JSON.stringify({ ...snapshot.meta, ...options.metadata }),
        snapshot.generatedAt,
        runId,
      ],
    ),
  );

  try {
    await db.batch(statements);
  } catch (error) {
    await markSyncRunFailed(db, runId, snapshot.generatedAt, JSON.stringify({ ...snapshot.meta, ...options.metadata, publishError: errorMessage(error) }));
    return {
      runId,
      dbPath: "d1:DB",
      marketCount: snapshot.markets.length,
      trancheCount: snapshot.tranches.length,
      status: "failed",
      errorCode: "publish_batch_failed",
      published: false,
    };
  }
  return {
    runId,
    dbPath: "d1:DB",
    marketCount: snapshot.markets.length,
    trancheCount: snapshot.tranches.length,
    status: validation.status,
    errorCode: validation.errorCode,
    published: true,
  };
}

function prepare(db: D1DatabaseLike, sql: string, params: SqlValue[] = []) {
  return db.prepare(sql).bind(...params);
}

async function insertSyncRun(db: D1DatabaseLike, run: SyncRunInsert) {
  await prepare(
    db,
    `INSERT INTO royco_sync_runs (
      run_id, job, request_body_hash, http_status, upstream_count, market_count, tranche_count,
      parse_error_count, raw_payload_hash, raw_payload_sample_json, started_at, completed_at,
      status, error_code, metadata_json, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.runId,
      run.job,
      run.rawHash,
      200,
      run.upstreamCount,
      run.marketCount,
      run.trancheCount,
      run.parseErrorCount,
      run.rawHash,
      run.rawPayload.slice(0, 12_000),
      run.startedAt,
      run.completedAt,
      run.status,
      run.errorCode,
      run.metadataJson,
      run.publishedAt,
    ],
  ).run();
}

async function markSyncRunFailed(db: D1DatabaseLike, runId: string, completedAt: number, metadataJson: string) {
  await prepare(
    db,
    `UPDATE royco_sync_runs
     SET completed_at = ?, status = ?, error_code = ?, metadata_json = ?, published_at = NULL
     WHERE run_id = ?`,
    [completedAt, "failed", "publish_batch_failed", metadataJson, runId],
  ).run();
}

function pushInsertRows(
  db: D1DatabaseLike,
  statements: D1PreparedStatementLike[],
  table: string,
  columns: string[],
  rows: InsertRow[],
) {
  if (rows.length === 0) return;
  const chunkSize = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columns.length));
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const placeholders = chunk.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    statements.push(prepare(db, `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`, chunk.flat()));
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function bodyHash(body: string) {
  const bytes = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256-${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function numberValue(row: unknown, key: string) {
  return isObject(row) && typeof row[key] === "number" && Number.isFinite(row[key]) ? row[key] : null;
}

function isObject(value: unknown): value is DbRow {
  return typeof value === "object" && value != null;
}
