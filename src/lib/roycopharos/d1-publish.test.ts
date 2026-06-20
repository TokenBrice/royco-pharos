import { describe, expect, it } from "vitest";
import { buildSnapshot } from "./snapshot";
import { publishSnapshotToD1 } from "./d1-publish";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-reader";
import type { SqlValue } from "./sql-read";

describe("D1 snapshot publishing", () => {
  it("records a rejected candidate without deleting the prior published snapshot", async () => {
    const db = new FakeD1Database(24);
    const snapshot = buildSnapshot(1_770_000_000);
    const rejected = {
      ...snapshot,
      markets: snapshot.markets.slice(0, 1),
      tranches: snapshot.tranches.slice(0, 1),
    };

    const result = await publishSnapshotToD1(db, rejected);

    expect(result.published).toBe(false);
    expect(result.errorCode).toBe("candidate_tranche_count_below_floor");
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0]).toHaveLength(1);
    expect(db.batches[0].some((statement) => statement.sql.startsWith("DELETE FROM"))).toBe(false);
    expect(db.batches[0][0].params.at(-1)).toBeNull();
  });

  it("allows first publish below the tranche-count floor but marks it degraded", async () => {
    const db = new FakeD1Database(0);
    const snapshot = buildSnapshot(1_770_000_000);
    const bootstrap = {
      ...snapshot,
      markets: snapshot.markets.slice(0, 1),
      tranches: snapshot.tranches.slice(0, 1),
    };

    const result = await publishSnapshotToD1(db, bootstrap);

    expect(result.published).toBe(true);
    expect(result.status).toBe("degraded");
    expect(result.errorCode).toBe("bootstrap_below_floor");
    expect(db.batches[0].some((statement) => statement.sql === "DELETE FROM royco_tranches")).toBe(true);
    expect(db.batches[0][0].params.at(-1)).toBe(bootstrap.generatedAt);
  });
});

class FakeD1Database implements D1DatabaseLike {
  batches: FakeD1PreparedStatement[][] = [];

  constructor(private readonly existingTrancheCount: number) {}

  prepare(sql: string) {
    return new FakeD1PreparedStatement(sql, this.existingTrancheCount);
  }

  async batch(statements: D1PreparedStatementLike[]) {
    this.batches.push(statements as FakeD1PreparedStatement[]);
    return [];
  }
}

class FakeD1PreparedStatement implements D1PreparedStatementLike {
  params: SqlValue[] = [];

  constructor(
    readonly sql: string,
    private readonly existingTrancheCount: number,
  ) {}

  bind(...values: SqlValue[]) {
    this.params = values;
    return this;
  }

  async all() {
    return { results: [] };
  }

  async first() {
    if (this.sql.includes("COUNT(*) AS count")) return { count: this.existingTrancheCount };
    return null;
  }

  async run() {
    return {};
  }
}
