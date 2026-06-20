import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { validatePublishCandidate } from "./publish-validation";
import { ROYCOPHAROS_SCHEMA_SQL } from "./schema";
import { readApiMetaFromSql, readSnapshotFromSql, type SqlReader, type SqlValue } from "./sql-read";
import { buildSnapshot } from "./snapshot";
import type {
  PharosApiCacheEntry,
  RoycoPharosSnapshot,
  UnderlyingSummary,
} from "./types";

interface SeedDatabaseOptions {
  job?: string;
  upstreamCount?: number;
  parseErrorCount?: number;
  rawPayloadSampleJson?: string;
  pharosCacheEntries?: PharosApiCacheEntry[];
  metadata?: Record<string, unknown>;
}

type DbRow = Record<string, unknown>;

export function databasePath() {
  return process.env.ROYCOPHAROS_DB_PATH ?? join("data", "roycopharos.db");
}

export function openDatabase(path = databasePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(ROYCOPHAROS_SCHEMA_SQL);
  migrateDatabase(db);
  return db;
}

function migrateDatabase(db: DatabaseSync) {
  migrateTrancheScores(db);
}

function migrateTrancheScores(db: DatabaseSync) {
  const columns = new Set(
    (db.prepare("PRAGMA table_info(tranche_scores)").all() as DbRow[]).map((row) => stringValue(row, "name")).filter(Boolean),
  );
  const addColumn = (name: string, definition: string) => {
    if (columns.has(name)) return;
    db.exec(`ALTER TABLE tranche_scores ADD COLUMN ${name} ${definition}`);
    columns.add(name);
  };

  addColumn("tranche_haircut", "REAL");
  addColumn("safety_score", "REAL");
  addColumn("safety_grade", "TEXT");
  addColumn("apy_used_pct", "REAL");
  addColumn("apy_source", "TEXT");
  addColumn("opportunity_yield", "REAL");
  addColumn("opportunity_grade", "TEXT");
  addColumn("base_asset_score", "REAL");
  addColumn("exposure_score", "REAL");
  addColumn("exposure_haircut", "REAL");
  addColumn("tranche_structure_score", "REAL");
  addColumn("opportunity_score", "REAL");

  if (columns.has("applied_penalty")) {
    db.exec("UPDATE tranche_scores SET tranche_haircut = applied_penalty WHERE tranche_haircut IS NULL");
  } else if (columns.has("raw_penalty")) {
    db.exec("UPDATE tranche_scores SET tranche_haircut = raw_penalty WHERE tranche_haircut IS NULL");
  }
  if (columns.has("royco_opportunity_score")) {
    db.exec("UPDATE tranche_scores SET safety_score = royco_opportunity_score WHERE safety_score IS NULL");
  }
  if (columns.has("royco_opportunity_grade")) {
    db.exec("UPDATE tranche_scores SET safety_grade = royco_opportunity_grade WHERE safety_grade IS NULL");
  }
  db.exec("UPDATE tranche_scores SET base_asset_score = underlying_safety_score WHERE base_asset_score IS NULL");
}

export function seedDatabase(snapshot: RoycoPharosSnapshot = buildSnapshot(), dbInput?: DatabaseSync, options: SeedDatabaseOptions = {}) {
  const db = dbInput ?? openDatabase();
  const owned = !dbInput;
  const runId = randomUUID();
  const startedAt = snapshot.generatedAt;
  const rawPayload = options.rawPayloadSampleJson ?? JSON.stringify({
    markets: snapshot.markets.map((market) => market.marketKey),
    tranches: snapshot.tranches.map((tranche) => tranche.trancheId),
  });
  const rawHash = `sha256-${createHash("sha256").update(rawPayload).digest("hex")}`;

  const transaction = db.prepare("BEGIN IMMEDIATE");
  transaction.run();
  try {
    const existingTrancheCount = numberValue(db.prepare("SELECT COUNT(*) AS count FROM royco_tranches").get() as DbRow, "count") ?? 0;
    const computedTrancheCount = snapshot.tranches.filter((tranche) => tranche.scoreStatus !== "nr").length;
    const latestPublishedAt = numberValue(latestPublishedRun(db), "published_at");
    const validation = validatePublishCandidate({
      trancheCount: snapshot.tranches.length,
      computedTrancheCount,
      hasPrior: existingTrancheCount > 0,
      latestPublishedAt,
      generatedAt: snapshot.generatedAt,
    });

    db.prepare(
      `INSERT INTO royco_sync_runs (
        run_id, job, request_body_hash, http_status, upstream_count, market_count, tranche_count,
        parse_error_count, raw_payload_hash, raw_payload_sample_json, started_at, completed_at,
        status, error_code, metadata_json, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      runId,
      options.job ?? "local-sync",
      rawHash,
      200,
      options.upstreamCount ?? snapshot.markets.length,
      snapshot.markets.length,
      snapshot.tranches.length,
      options.parseErrorCount ?? 0,
      rawHash,
      rawPayload.slice(0, 12_000),
      startedAt,
      snapshot.generatedAt,
      validation.status,
      validation.errorCode,
      JSON.stringify({ ...snapshot.meta, ...options.metadata }),
      validation.publish ? snapshot.generatedAt : null,
    );

    if (!validation.publish) {
      // Candidate failed validation: keep the prior published snapshot intact (last-known-good).
      db.prepare("COMMIT").run();
      return {
        runId,
        dbPath: databasePath(),
        marketCount: snapshot.markets.length,
        trancheCount: snapshot.tranches.length,
        status: validation.status,
        errorCode: validation.errorCode,
        published: false,
      };
    }

    db.exec("DELETE FROM token_mappings");
    db.exec("DELETE FROM royco_markets");
    db.exec("DELETE FROM royco_tranches");
    db.exec("DELETE FROM pharos_underlying_summaries");
    db.exec("DELETE FROM pharos_api_cache");
    db.exec("DELETE FROM tranche_scores");

    // One real observation per published sync, bucketed to the minute so a re-run within
    // the same minute is idempotent (the (…, observed_at) PK overwrites) while distinct
    // syncs accumulate. History tables are intentionally NOT cleared above.
    const historyObservedAt = Math.floor(snapshot.generatedAt / 60) * 60;

    const insertMapping = db.prepare(
      `INSERT OR REPLACE INTO token_mappings (
        chain_id, chain_slug, deposit_token_address, deposit_token_symbol, pharos_stablecoin_id,
        mapping_status, mapping_source, confidence, reviewed_by, reviewed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMarket = db.prepare(
      `INSERT OR REPLACE INTO royco_markets (
        chain_id, chain_slug, market_id, market_key, name, listing_type, status_raw, status_normalized, tvl_usd,
        coverage_ratio, required_coverage_ratio, utilization_ratio, utilization_limit_ratio,
        drawdown_ratio, total_drawdowns, junior_redemption_delay_seconds, royco_run_id,
        source_observed_at, collected_at, published_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertTranche = db.prepare(
      `INSERT OR REPLACE INTO royco_tranches (
        tranche_id, chain_id, market_id, side, vault_address, deposit_token_symbol, deposit_token_name,
        deposit_token_address, deposit_token_decimals, share_token_symbol, share_token_name, share_token_address,
        share_token_decimals, mapping_status, pharos_stablecoin_id, apy_current_raw, apy_current_pct,
        apy_7d_raw, apy_7d_pct, apy_unit, apy_window, tvl_usd, source_url, royco_run_id,
        source_observed_at, collected_at, published_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMarketHistory = db.prepare(
      `INSERT OR REPLACE INTO royco_market_history (
        chain_id, market_id, observed_at, tvl_usd, coverage_ratio, required_coverage_ratio,
        utilization_ratio, utilization_limit_ratio, drawdown_ratio, total_drawdowns, status_normalized,
        royco_run_id, collected_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertTrancheHistory = db.prepare(
      `INSERT OR REPLACE INTO royco_tranche_history (
        tranche_id, chain_id, market_id, side, observed_at, apy_current_raw, apy_current_pct,
        apy_7d_raw, apy_7d_pct, tvl_usd, royco_run_id, collected_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertUnderlying = db.prepare(
      `INSERT OR REPLACE INTO pharos_underlying_summaries (
        pharos_stablecoin_id, symbol, name, price, supply_usd, underlying_safety_score,
        underlying_safety_grade, report_card_summary_json, pharos_safety_methodology_version,
        pharos_cache_generation, source_updated_at, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertPharosCache = db.prepare(
      `INSERT OR REPLACE INTO pharos_api_cache (
        endpoint, cache_key, body_json, body_hash, http_status, x_data_age, warning, fetched_at,
        source_updated_at, expires_at, stale_if_error_until, generation, error_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertScore = db.prepare(
      `INSERT OR REPLACE INTO tranche_scores (
        tranche_id, pharos_stablecoin_id, mapping_status, score_status, nr_reason, underlying_safety_score,
        underlying_safety_grade, base_asset_score, exposure_score, exposure_haircut, tranche_structure_score,
        tranche_haircut, safety_score, safety_grade, apy_used_pct, apy_source,
        opportunity_yield, opportunity_score, opportunity_grade,
        penalty_breakdown_json, royco_run_id, pharos_cache_generation, input_hash, methodology_version,
        pharos_safety_methodology_version, royco_freshness_status, pharos_freshness_status, computed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const cacheEntry of options.pharosCacheEntries ?? []) {
      insertPharosCache.run(
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
      );
    }

    for (const underlying of snapshot.underlyings) {
      insertUnderlying.run(
        underlying.pharosStablecoinId ?? underlying.symbol,
        underlying.symbol,
        underlying.name,
        underlying.price,
        underlying.supplyUsd,
        underlying.underlyingSafetyScore,
        underlying.underlyingSafetyGrade,
        JSON.stringify({ summary: underlying.summary }),
        "fixture",
        1,
        underlying.sourceUpdatedAt,
        underlying.fetchedAt ?? snapshot.generatedAt,
      );
    }

    for (const market of snapshot.markets) {
      insertMarket.run(
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
      );
      insertMarketHistory.run(
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
      );
    }

    for (const tranche of snapshot.tranches) {
      insertMapping.run(
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
      );
      insertTranche.run(
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
      );
      insertTrancheHistory.run(
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
      );
      insertScore.run(
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
      );
    }

    // Retention: keep 30 days of raw observations (spec); prune older points each publish.
    const retentionCutoff = historyObservedAt - 30 * 86_400;
    db.prepare("DELETE FROM royco_market_history WHERE observed_at < ?").run(retentionCutoff);
    db.prepare("DELETE FROM royco_tranche_history WHERE observed_at < ?").run(retentionCutoff);

    db.prepare("COMMIT").run();
    return {
      runId,
      dbPath: databasePath(),
      marketCount: snapshot.markets.length,
      trancheCount: snapshot.tranches.length,
      status: validation.status,
      errorCode: validation.errorCode,
      published: true,
    };
  } catch (error) {
    db.prepare("ROLLBACK").run();
    throw error;
  } finally {
    if (owned) db.close();
  }
}

export async function readSnapshotFromDatabase(dbInput?: DatabaseSync): Promise<RoycoPharosSnapshot | null> {
  const db = dbInput ?? openDatabase();
  const owned = !dbInput;
  try {
    return await readSnapshotFromSql(new DatabaseSqlReader(db));
  } finally {
    if (owned) db.close();
  }
}

export function readTrancheHistoryFromDatabase(trancheId: string, days: number, dbInput?: DatabaseSync) {
  const db = dbInput ?? openDatabase();
  const owned = !dbInput;
  try {
    const row = db.prepare("SELECT tranche_id FROM royco_tranches WHERE tranche_id = ?").get(trancheId) as DbRow | undefined;
    if (!row) return null;
    return readTrancheHistoryRows(db, trancheId, days);
  } finally {
    if (owned) db.close();
  }
}

export async function readApiMetaFromDatabase(dbInput?: DatabaseSync) {
  const db = dbInput ?? openDatabase();
  const owned = !dbInput;
  try {
    return await readApiMetaFromSql(new DatabaseSqlReader(db));
  } finally {
    if (owned) db.close();
  }
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

export function readLatestSyncRun(db?: DatabaseSync): SyncRunSummary | null {
  const owned = !db;
  const database = db ?? openDatabase();
  try {
    const row = database
      .prepare(
        `SELECT run_id, job, status, error_code, started_at, completed_at, published_at, tranche_count, market_count
         FROM royco_sync_runs ORDER BY started_at DESC LIMIT 1`,
      )
      .get() as DbRow | undefined;
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
  } finally {
    if (owned) database.close();
  }
}

export function readPharosUnderlyingsFromDatabase(db?: DatabaseSync): UnderlyingSummary[] {
  const owned = !db;
  const database = db ?? openDatabase();
  try {
    const rows = database
      .prepare(
        `SELECT pharos_stablecoin_id, symbol, name, price, supply_usd, underlying_safety_score,
          underlying_safety_grade, report_card_summary_json, source_updated_at, fetched_at
         FROM pharos_underlying_summaries
         ORDER BY symbol ASC`,
      )
      .all() as DbRow[];

    return rows.map((row) => {
      const summaryJson = stringValue(row, "report_card_summary_json");
      const parsed = parseJson(summaryJson);
      return {
        pharosStablecoinId: stringValue(row, "pharos_stablecoin_id"),
        symbol: stringValue(row, "symbol") ?? "unknown",
        name: stringValue(row, "name") ?? stringValue(row, "symbol") ?? "Unknown",
        price: numberValue(row, "price"),
        supplyUsd: numberValue(row, "supply_usd"),
        underlyingSafetyScore: numberValue(row, "underlying_safety_score"),
        underlyingSafetyGrade: stringValue(row, "underlying_safety_grade"),
        summary: isObject(parsed) && typeof parsed.summary === "string" ? parsed.summary : "Pharos summary unavailable.",
        sourceUpdatedAt: numberValue(row, "source_updated_at"),
        fetchedAt: numberValue(row, "fetched_at"),
      };
    });
  } finally {
    if (owned) database.close();
  }
}

function readTrancheHistoryRows(db: DatabaseSync, trancheId: string, days: number) {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86_400;
  const rows = db
    .prepare(
      `SELECT observed_at, apy_current_pct, tvl_usd
       FROM royco_tranche_history
       WHERE tranche_id = ? AND observed_at >= ?
       ORDER BY observed_at ASC`,
    )
    .all(trancheId, cutoff) as DbRow[];
  return {
    apy: rows.map((row) => ({ observedAt: numberValue(row, "observed_at") ?? 0, value: numberValue(row, "apy_current_pct") })),
    tvl: rows.map((row) => ({ observedAt: numberValue(row, "observed_at") ?? 0, value: numberValue(row, "tvl_usd") })),
  };
}

function latestPublishedRun(db: DatabaseSync) {
  return (
    (db
      .prepare("SELECT * FROM royco_sync_runs WHERE published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1")
      .get() as DbRow | undefined) ?? null
  );
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

class DatabaseSqlReader implements SqlReader {
  constructor(private readonly db: DatabaseSync) {}

  async all(sql: string, params: SqlValue[] = []) {
    return this.db.prepare(sql).all(...params) as DbRow[];
  }

  async get(sql: string, params: SqlValue[] = []) {
    return (this.db.prepare(sql).get(...params) as DbRow | undefined) ?? null;
  }
}

function isObject(value: unknown): value is DbRow {
  return typeof value === "object" && value != null;
}
