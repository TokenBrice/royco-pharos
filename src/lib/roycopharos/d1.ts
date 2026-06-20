import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1Reader, type D1DatabaseLike } from "./d1-reader";
import {
  readLatestSyncRunFromSql,
  readSnapshotFromSql,
  readTrancheHistoryFromSql,
} from "./sql-read";

export async function readSnapshotFromD1() {
  return readSnapshotFromSql(await getD1Reader());
}

export async function readTrancheHistoryFromD1(trancheId: string, days: number) {
  return readTrancheHistoryFromSql(await getD1Reader(), trancheId, days);
}

export async function readLatestSyncRunFromD1() {
  return readLatestSyncRunFromSql(await getD1Reader());
}

async function getD1Reader() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as { DB?: D1DatabaseLike }).DB;
  if (!db) {
    throw new Error("ROYCOPHAROS_STORAGE=d1 requires a Cloudflare D1 binding named DB.");
  }
  return new D1Reader(db);
}
