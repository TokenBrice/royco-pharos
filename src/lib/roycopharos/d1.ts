import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1Reader } from "./d1-reader";
import {
  readApiMetaFromSql,
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

export async function readApiMetaFromD1() {
  return readApiMetaFromSql(await getD1Reader());
}

async function getD1Reader() {
  const { env } = await getCloudflareContext({ async: true });
  return new D1Reader((env as CloudflareEnv).DB);
}
