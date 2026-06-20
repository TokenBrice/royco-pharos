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
    expect(db.batches).toHaveLength(0);
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0].sql).toContain("INSERT INTO royco_sync_runs");
    expect(db.runs[0].params.at(-1)).toBeNull();
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
    const finalRunUpdate = db.batches[0].find((statement) => statement.sql.includes("UPDATE royco_sync_runs"));
    expect(finalRunUpdate?.params.at(-2)).toBe(bootstrap.generatedAt);
    expect(db.batches[0].every((statement) => statement.params.length <= 100)).toBe(true);
  });

  it("keeps the current full publish under D1 statement and parameter limits", async () => {
    const db = new FakeD1Database(0);
    const result = await publishSnapshotToD1(db, buildSnapshot(1_770_000_000));

    expect(result.published).toBe(true);
    expect(db.batches[0].length).toBeLessThanOrEqual(50);
    expect(db.batches[0].every((statement) => statement.params.length <= 100)).toBe(true);
  });

  it("records explicit production fixture blocks without deleting rows", async () => {
    const db = new FakeD1Database(24);
    const result = await publishSnapshotToD1(db, buildSnapshot(1_770_000_000), {
      blockPublishReason: "production_pharos_fixture_blocked",
    });

    expect(result.published).toBe(false);
    expect(result.errorCode).toBe("production_pharos_fixture_blocked");
    expect(db.batches).toHaveLength(0);
    expect(db.runs[0].sql).toContain("INSERT INTO royco_sync_runs");
  });

  it("rejects older generated snapshots when a newer publish exists", async () => {
    const db = new FakeD1Database(24, 1_770_000_100);
    const result = await publishSnapshotToD1(db, buildSnapshot(1_770_000_000));

    expect(result.published).toBe(false);
    expect(result.errorCode).toBe("candidate_older_than_current");
    expect(db.batches).toHaveLength(0);
  });

  it("keeps a failed D1 batch visible as a failed sync run", async () => {
    const db = new FakeD1Database(0, null, true);
    const result = await publishSnapshotToD1(db, buildSnapshot(1_770_000_000));

    expect(result.published).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("publish_batch_failed");
    expect(db.runs[0].sql).toContain("INSERT INTO royco_sync_runs");
    expect(db.runs.at(-1)?.sql).toContain("UPDATE royco_sync_runs");
    expect(db.runs.at(-1)?.params).toContain("publish_batch_failed");
  });
});

class FakeD1Database implements D1DatabaseLike {
  batches: FakeD1PreparedStatement[][] = [];
  runs: FakeD1PreparedStatement[] = [];

  constructor(
    readonly existingTrancheCount: number,
    readonly latestPublishedAt: number | null = null,
    private readonly failBatch = false,
  ) {}

  prepare(sql: string) {
    return new FakeD1PreparedStatement(sql, this);
  }

  async batch(statements: D1PreparedStatementLike[]) {
    if (this.failBatch) throw new Error("batch failed");
    this.batches.push(statements as FakeD1PreparedStatement[]);
    return [];
  }
}

class FakeD1PreparedStatement implements D1PreparedStatementLike {
  params: SqlValue[] = [];

  constructor(
    readonly sql: string,
    private readonly db: FakeD1Database,
  ) {}

  bind(...values: SqlValue[]) {
    this.params = values;
    return this;
  }

  async all() {
    return { results: [] };
  }

  async first() {
    if (this.sql.includes("COUNT(*) AS count")) return { count: this.db.existingTrancheCount };
    if (this.sql.includes("MAX(published_at) AS published_at")) return { published_at: this.db.latestPublishedAt };
    return null;
  }

  async run() {
    this.db.runs.push(this);
    return {};
  }
}
