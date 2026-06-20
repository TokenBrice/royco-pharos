import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ROYCOPHAROS_SCHEMA_SQL } from "./schema";
import { buildApiMeta, buildSnapshot, buildWatchlist, compareTranches, coverageHeadroom, methodology, ratioToPct } from "./snapshot";
import type {
  ApiMeta,
  ApySource,
  HistoryPoint,
  MappingStatus,
  MarketStatus,
  PenaltyBreakdownRow,
  PharosApiCacheEntry,
  RoycoMarketView,
  RoycoPharosSnapshot,
  RoycoTrancheView,
  ScoreStatus,
  TrancheSide,
  UnderlyingSummary,
} from "./types";

interface SeedDatabaseOptions {
  job?: string;
  upstreamCount?: number;
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
    const validation = validateCandidate(snapshot.tranches.length, computedTrancheCount, existingTrancheCount > 0);

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
      0,
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

interface CandidateValidation {
  publish: boolean;
  status: "ok" | "degraded";
  errorCode: string | null;
}

/**
 * Decide whether a freshly-built candidate snapshot may replace the published one.
 * Richer than a bare count check: when a prior good snapshot exists we refuse an undersized
 * candidate (keeps last-known-good) and refuse an all-NR collapse (e.g. Pharos fully down).
 * On first boot (no prior) we publish whatever we have so the app has something to serve.
 */
function validateCandidate(trancheCount: number, computedTrancheCount: number, hasPrior: boolean): CandidateValidation {
  if (trancheCount === 0) {
    return { publish: false, status: "degraded", errorCode: "candidate_empty" };
  }
  if (hasPrior) {
    if (trancheCount < 18) {
      return { publish: false, status: "degraded", errorCode: "candidate_tranche_count_below_floor" };
    }
    if (computedTrancheCount === 0) {
      return { publish: false, status: "degraded", errorCode: "candidate_all_nr" };
    }
    return { publish: true, status: "ok", errorCode: null };
  }
  return trancheCount >= 18
    ? { publish: true, status: "ok", errorCode: null }
    : { publish: true, status: "degraded", errorCode: "bootstrap_below_floor" };
}

export function readSnapshotFromDatabase(dbInput?: DatabaseSync): RoycoPharosSnapshot | null {
  const db = dbInput ?? openDatabase();
  const owned = !dbInput;
  try {
    const marketRows = db.prepare("SELECT * FROM royco_markets ORDER BY tvl_usd DESC, name ASC").all() as DbRow[];
    if (marketRows.length === 0) return null;

    const underlyings = readPharosUnderlyingsFromDatabase(db);
    const underlyingById = new Map(underlyings.map((underlying) => [underlying.pharosStablecoinId, underlying]));
    const underlyingBySymbol = new Map(underlyings.map((underlying) => [underlying.symbol, underlying]));
    const trancheRows = db
      .prepare(
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
      )
      .all() as DbRow[];

    const trancheIds = trancheRows.map((row) => stringValue(row, "tranche_id")).filter((id): id is string => Boolean(id));
    const trancheHistoryById = readTrancheHistoryRowsByIds(db, trancheIds, 30);

    const tranches = trancheRows.map((row) => buildTrancheViewFromRow(row, trancheHistoryById)).sort(compareTranches);
    const tranchesByMarketKey = new Map<string, RoycoTrancheView[]>();
    for (const tranche of tranches) {
      const entries = tranchesByMarketKey.get(tranche.marketKey) ?? [];
      entries.push(tranche);
      tranchesByMarketKey.set(tranche.marketKey, entries);
    }

    const markets: RoycoMarketView[] = marketRows.map((row) => {
      const marketKey = stringValue(row, "market_key") ?? `${numberValue(row, "chain_id")}:${stringValue(row, "market_id")}`;
      const marketTranches = tranchesByMarketKey.get(marketKey) ?? [];
      const distinctUnderlyings = new Map<string, UnderlyingSummary>();
      for (const tranche of marketTranches) {
        const underlying =
          underlyingById.get(tranche.pharosStablecoinId) ??
          underlyingBySymbol.get(tranche.depositTokenSymbol ?? "") ??
          null;
        if (underlying) distinctUnderlyings.set(underlying.pharosStablecoinId ?? underlying.symbol, underlying);
      }

      const coverageRatio = numberValue(row, "coverage_ratio");
      const requiredCoverageRatio = numberValue(row, "required_coverage_ratio");
      return {
        chainId: numberValue(row, "chain_id") ?? 0,
        chainSlug: stringValue(row, "chain_slug") ?? "unknown",
        marketId: stringValue(row, "market_id") ?? "",
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
        history: readMarketHistoryRows(db, numberValue(row, "chain_id") ?? 0, stringValue(row, "market_id") ?? "", 30),
      };
    });

    const now = Math.floor(Date.now() / 1000);
    const run = latestPublishedRun(db);
    const generatedAt = numberValue(run, "published_at") ?? Math.max(...markets.map((market) => market.publishedAt));
    return {
      generatedAt,
      markets,
      tranches,
      underlyings,
      watchlist: buildWatchlist(tranches),
      meta: readApiMeta(db, now, run),
      methodology: methodology(),
    };
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

function readMarketHistoryRows(db: DatabaseSync, chainId: number, marketId: string, days: number) {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86_400;
  const rows = db
    .prepare(
      `SELECT observed_at, tvl_usd, coverage_ratio, utilization_ratio
       FROM royco_market_history
       WHERE chain_id = ? AND market_id = ? AND observed_at >= ?
       ORDER BY observed_at ASC`,
    )
    .all(chainId, marketId, cutoff) as DbRow[];
  return {
    coverage: rows.map((row) => ({ observedAt: numberValue(row, "observed_at") ?? 0, value: numberValue(row, "coverage_ratio") })),
    utilization: rows.map((row) => ({ observedAt: numberValue(row, "observed_at") ?? 0, value: ratioToPct(numberValue(row, "utilization_ratio")) })),
    tvl: rows.map((row) => ({ observedAt: numberValue(row, "observed_at") ?? 0, value: numberValue(row, "tvl_usd") })),
  };
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

function readTrancheHistoryRowsByIds(db: DatabaseSync, trancheIds: string[], days: number) {
  const histories = new Map<string, { apy: HistoryPoint[]; tvl: HistoryPoint[] }>();
  for (const trancheId of trancheIds) {
    histories.set(trancheId, { apy: [], tvl: [] });
  }
  if (trancheIds.length === 0) return histories;

  const cutoff = Math.floor(Date.now() / 1000) - days * 86_400;
  const placeholders = trancheIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT tranche_id, observed_at, apy_current_pct, tvl_usd
       FROM royco_tranche_history
       WHERE tranche_id IN (${placeholders}) AND observed_at >= ?
       ORDER BY tranche_id ASC, observed_at ASC`,
    )
    .all(...trancheIds, cutoff) as DbRow[];

  for (const row of rows) {
    const trancheId = stringValue(row, "tranche_id");
    if (!trancheId) continue;
    const history = histories.get(trancheId) ?? { apy: [], tvl: [] };
    const observedAt = numberValue(row, "observed_at") ?? 0;
    history.apy.push({ observedAt, value: numberValue(row, "apy_current_pct") });
    history.tvl.push({ observedAt, value: numberValue(row, "tvl_usd") });
    histories.set(trancheId, history);
  }

  return histories;
}

function readApiMeta(db: DatabaseSync, now: number, run: DbRow | null): ApiMeta {
  const royco = db.prepare("SELECT MAX(collected_at) AS collected_at, MAX(published_at) AS published_at FROM royco_markets").get() as DbRow;
  const pharos = db.prepare("SELECT MAX(fetched_at) AS fetched_at FROM pharos_underlying_summaries").get() as DbRow;
  const collectedAt = numberValue(royco, "collected_at") ?? now;
  const pharosFetchedAt = numberValue(pharos, "fetched_at") ?? collectedAt;
  const publishedAt = numberValue(run, "published_at") ?? numberValue(royco, "published_at") ?? collectedAt;
  return buildApiMeta(now, collectedAt, pharosFetchedAt, publishedAt, stringValue(run, "raw_payload_hash") ?? "sha256-db");
}

function latestPublishedRun(db: DatabaseSync) {
  return (
    (db
      .prepare("SELECT * FROM royco_sync_runs WHERE published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1")
      .get() as DbRow | undefined) ?? null
  );
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
