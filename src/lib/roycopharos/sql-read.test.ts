import { describe, expect, it } from "vitest";
import { readSnapshotFromSql, type DbRow, type SqlReader, type SqlValue } from "./sql-read";

describe("generic SQL snapshot reads", () => {
  it("keeps history reads under D1 bound-parameter limits as market count grows", async () => {
    const reader = new LimitCheckingReader(60);

    const snapshot = await readSnapshotFromSql(reader);

    expect(snapshot?.markets).toHaveLength(60);
    expect(reader.maxParamCount).toBeLessThanOrEqual(1);
  });
});

class LimitCheckingReader implements SqlReader {
  maxParamCount = 0;

  constructor(private readonly marketCount: number) {}

  async all(sql: string, params: SqlValue[] = []) {
    this.record(params);
    if (sql.includes("FROM royco_markets")) return marketRows(this.marketCount);
    if (sql.includes("FROM pharos_underlying_summaries")) return [];
    if (sql.includes("FROM royco_tranches")) return [];
    if (sql.includes("FROM royco_market_history")) return [];
    if (sql.includes("FROM royco_tranche_history")) return [];
    return [];
  }

  async get(sql: string, params: SqlValue[] = []) {
    this.record(params);
    if (sql.includes("MAX(collected_at)")) return { collected_at: 1_770_000_000, published_at: 1_770_000_000 };
    if (sql.includes("MAX(fetched_at)")) return { fetched_at: 1_770_000_000 };
    return null;
  }

  private record(params: SqlValue[]) {
    this.maxParamCount = Math.max(this.maxParamCount, params.length);
    expect(params.length).toBeLessThanOrEqual(100);
  }
}

function marketRows(count: number): DbRow[] {
  return Array.from({ length: count }, (_, index) => ({
    chain_id: 1,
    chain_slug: "ethereum",
    market_id: `market-${index}`,
    market_key: `1:market-${index}`,
    name: `Market ${index}`,
    listing_type: "direct",
    status_normalized: "normal",
    tvl_usd: 1000,
    coverage_ratio: 1,
    required_coverage_ratio: 1,
    utilization_ratio: 0.1,
    utilization_limit_ratio: 1,
    drawdown_ratio: 0,
    total_drawdowns: 0,
    junior_redemption_delay_seconds: null,
    source_observed_at: 1_770_000_000,
    collected_at: 1_770_000_000,
    published_at: 1_770_000_000,
  }));
}
