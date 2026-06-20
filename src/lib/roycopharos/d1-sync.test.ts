import { describe, expect, it } from "vitest";
import { runRoycoPharosD1Sync } from "./d1-sync";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-reader";
import type { SqlValue } from "./sql-read";

describe("D1 sync orchestration", () => {
  it("holds production publishes when Pharos would fall back to fixtures", async () => {
    const db = new FakeSyncD1Database({ existingTrancheCount: 24 });
    const result = await runRoycoPharosD1Sync({ DB: db, ENVIRONMENT: "production" }, "pharos");

    expect(result).toMatchObject({ published: false, errorCode: "production_pharos_fixture_blocked" });
    expect(db.runs.some((statement) => statement.sql.includes("INSERT INTO royco_sync_runs"))).toBe(true);
    expect(db.batches).toHaveLength(0);
  });

  it("skips when the distributed D1 sync lock is held", async () => {
    const db = new FakeSyncD1Database({ existingTrancheCount: 24, lockOwner: "already-running" });
    const result = await runRoycoPharosD1Sync({ DB: db, ENVIRONMENT: "production" }, "pharos");

    expect(result).toMatchObject({ status: "skipped", published: false, skipped: true });
    expect(db.runs.some((statement) => statement.sql.includes("INSERT INTO royco_sync_runs"))).toBe(false);
  });
});

class FakeSyncD1Database implements D1DatabaseLike {
  batches: FakeSyncD1PreparedStatement[][] = [];
  runs: FakeSyncD1PreparedStatement[] = [];
  lockOwner: string | null;
  readonly existingTrancheCount: number;

  constructor(options: { existingTrancheCount: number; lockOwner?: string | null }) {
    this.existingTrancheCount = options.existingTrancheCount;
    this.lockOwner = options.lockOwner ?? null;
  }

  prepare(sql: string) {
    return new FakeSyncD1PreparedStatement(sql, this);
  }

  async batch(statements: D1PreparedStatementLike[]) {
    this.batches.push(statements as FakeSyncD1PreparedStatement[]);
    return [];
  }
}

class FakeSyncD1PreparedStatement implements D1PreparedStatementLike {
  params: SqlValue[] = [];

  constructor(
    readonly sql: string,
    private readonly db: FakeSyncD1Database,
  ) {}

  bind(...values: SqlValue[]) {
    this.params = values;
    return this;
  }

  async all() {
    return { results: [] };
  }

  async first() {
    if (this.sql.includes("SELECT owner FROM sync_locks")) return this.db.lockOwner == null ? null : { owner: this.db.lockOwner };
    if (this.sql.includes("COUNT(*) AS count")) return { count: this.db.existingTrancheCount };
    if (this.sql.includes("MAX(published_at) AS published_at")) return { published_at: null };
    return null;
  }

  async run() {
    if (this.sql.includes("INSERT OR IGNORE INTO sync_locks") && this.db.lockOwner == null) {
      this.db.lockOwner = String(this.params[1]);
    } else if (this.sql.includes("DELETE FROM sync_locks") && this.params[1] === this.db.lockOwner) {
      this.db.lockOwner = null;
    } else {
      this.db.runs.push(this);
    }
    return {};
  }
}
