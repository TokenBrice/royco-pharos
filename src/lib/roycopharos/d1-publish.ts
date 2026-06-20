import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-reader";
import type { PharosApiCacheEntry, RoycoPharosSnapshot } from "./types";

interface PublishD1Options {
  job?: string;
  upstreamCount?: number;
  rawPayloadSampleJson?: string;
  pharosCacheEntries?: PharosApiCacheEntry[];
  metadata?: Record<string, unknown>;
}

interface CandidateValidation {
  publish: boolean;
  status: "ok" | "degraded";
  errorCode: string | null;
}

type SqlValue = string | number | null;
type DbRow = Record<string, unknown>;

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
  const computedTrancheCount = snapshot.tranches.filter((tranche) => tranche.scoreStatus !== "nr").length;
  const validation = validateCandidate(snapshot.tranches.length, computedTrancheCount, existingTrancheCount > 0);

  const statements: D1PreparedStatementLike[] = [
    prepare(
      db,
      `INSERT INTO royco_sync_runs (
        run_id, job, request_body_hash, http_status, upstream_count, market_count, tranche_count,
        parse_error_count, raw_payload_hash, raw_payload_sample_json, started_at, completed_at,
        status, error_code, metadata_json, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        runId,
        options.job ?? "worker-sync",
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
      ],
    ),
  ];

  if (!validation.publish) {
    await db.batch(statements);
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

  statements.push(
    prepare(db, "DELETE FROM token_mappings"),
    prepare(db, "DELETE FROM royco_markets"),
    prepare(db, "DELETE FROM royco_tranches"),
    prepare(db, "DELETE FROM pharos_underlying_summaries"),
    prepare(db, "DELETE FROM pharos_api_cache"),
    prepare(db, "DELETE FROM tranche_scores"),
  );

  const historyObservedAt = Math.floor(snapshot.generatedAt / 60) * 60;

  for (const cacheEntry of options.pharosCacheEntries ?? []) {
    statements.push(
      prepare(
        db,
        `INSERT OR REPLACE INTO pharos_api_cache (
          endpoint, cache_key, body_json, body_hash, http_status, x_data_age, warning, fetched_at,
          source_updated_at, expires_at, stale_if_error_until, generation, error_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      ),
    );
  }

  for (const underlying of snapshot.underlyings) {
    statements.push(
      prepare(
        db,
        `INSERT OR REPLACE INTO pharos_underlying_summaries (
          pharos_stablecoin_id, symbol, name, price, supply_usd, underlying_safety_score,
          underlying_safety_grade, report_card_summary_json, pharos_safety_methodology_version,
          pharos_cache_generation, source_updated_at, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      ),
    );
  }

  for (const market of snapshot.markets) {
    statements.push(
      prepare(
        db,
        `INSERT OR REPLACE INTO royco_markets (
          chain_id, chain_slug, market_id, market_key, name, listing_type, status_raw, status_normalized, tvl_usd,
          coverage_ratio, required_coverage_ratio, utilization_ratio, utilization_limit_ratio,
          drawdown_ratio, total_drawdowns, junior_redemption_delay_seconds, royco_run_id,
          source_observed_at, collected_at, published_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      ),
      prepare(
        db,
        `INSERT OR REPLACE INTO royco_market_history (
          chain_id, market_id, observed_at, tvl_usd, coverage_ratio, required_coverage_ratio,
          utilization_ratio, utilization_limit_ratio, drawdown_ratio, total_drawdowns, status_normalized,
          royco_run_id, collected_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      ),
    );
  }

  for (const tranche of snapshot.tranches) {
    statements.push(
      prepare(
        db,
        `INSERT OR REPLACE INTO token_mappings (
          chain_id, chain_slug, deposit_token_address, deposit_token_symbol, pharos_stablecoin_id,
          mapping_status, mapping_source, confidence, reviewed_by, reviewed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      ),
      prepare(
        db,
        `INSERT OR REPLACE INTO royco_tranches (
          tranche_id, chain_id, market_id, side, vault_address, deposit_token_symbol, deposit_token_name,
          deposit_token_address, deposit_token_decimals, share_token_symbol, share_token_name, share_token_address,
          share_token_decimals, mapping_status, pharos_stablecoin_id, apy_current_raw, apy_current_pct,
          apy_7d_raw, apy_7d_pct, apy_unit, apy_window, tvl_usd, source_url, royco_run_id,
          source_observed_at, collected_at, published_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      ),
      prepare(
        db,
        `INSERT OR REPLACE INTO royco_tranche_history (
          tranche_id, chain_id, market_id, side, observed_at, apy_current_raw, apy_current_pct,
          apy_7d_raw, apy_7d_pct, tvl_usd, royco_run_id, collected_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      ),
      prepare(
        db,
        `INSERT OR REPLACE INTO tranche_scores (
          tranche_id, pharos_stablecoin_id, mapping_status, score_status, nr_reason, underlying_safety_score,
          underlying_safety_grade, base_asset_score, exposure_score, exposure_haircut, tranche_structure_score,
          tranche_haircut, safety_score, safety_grade, apy_used_pct, apy_source,
          opportunity_yield, opportunity_score, opportunity_grade,
          penalty_breakdown_json, royco_run_id, pharos_cache_generation, input_hash, methodology_version,
          pharos_safety_methodology_version, royco_freshness_status, pharos_freshness_status, computed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      ),
    );
  }

  const retentionCutoff = historyObservedAt - 30 * 86_400;
  statements.push(
    prepare(db, "DELETE FROM royco_market_history WHERE observed_at < ?", [retentionCutoff]),
    prepare(db, "DELETE FROM royco_tranche_history WHERE observed_at < ?", [retentionCutoff]),
  );

  await db.batch(statements);
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
