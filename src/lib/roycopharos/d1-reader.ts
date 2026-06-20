import type { DbRow, SqlReader, SqlValue } from "./sql-read";

type D1ResultRows = { results?: unknown[] };

export interface D1PreparedStatementLike {
  bind(...values: SqlValue[]): D1PreparedStatementLike;
  all(): Promise<D1ResultRows>;
  first(): Promise<unknown | null>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

export class D1Reader implements SqlReader {
  constructor(private readonly db: D1DatabaseLike) {}

  async all(sql: string, params: SqlValue[] = []) {
    const result = await this.db.prepare(sql).bind(...params).all();
    return (result.results ?? []).filter(isRow);
  }

  async get(sql: string, params: SqlValue[] = []) {
    const row = await this.db.prepare(sql).bind(...params).first();
    return isRow(row) ? row : null;
  }
}

export function isRow(value: unknown): value is DbRow {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
