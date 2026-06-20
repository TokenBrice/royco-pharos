import { ROYCO_MARKET_FIXTURES, UNDERLYING_FIXTURES } from "./fixtures";
import { loadPharosUnderlyings } from "./pharos-client";
import { loadRoycoDawnMarkets } from "./royco-dawn";
import { buildSnapshot } from "./snapshot";
import { publishSnapshotToD1 } from "./d1-publish";
import { D1Reader, type D1DatabaseLike } from "./d1-reader";
import { readPharosUnderlyingsFromSql } from "./sql-read";

export type D1SyncMode = "all" | "royco" | "pharos";

const D1_SYNC_LOCK_NAME = "roycopharos-sync";
const D1_SYNC_LOCK_TTL_SECONDS = 10 * 60;

export interface RoycoPharosD1SyncEnv {
  DB: D1DatabaseLike;
  ENVIRONMENT?: string;
  ALLOW_FIXTURE_PUBLISH?: string;
  ROYCO_DAWN_LIVE?: string;
  PHAROS_API_KEY?: string;
  PHAROS_API_BASE?: string;
  SYNC_ADMIN_TOKEN?: string;
}

export async function runRoycoPharosD1Sync(env: RoycoPharosD1SyncEnv, mode: D1SyncMode = "all") {
  const started = await startRoycoPharosD1Sync(env, mode);
  return started.started ? started.promise : started.result;
}

export async function startRoycoPharosD1Sync(env: RoycoPharosD1SyncEnv, mode: D1SyncMode = "all") {
  const lockOwner = await acquireD1SyncLock(env.DB);
  if (lockOwner == null) {
    return {
      started: false as const,
      result: { status: "skipped", published: false, skipped: true, reason: "A sync is already in progress (D1 lock held)." },
    };
  }
  return {
    started: true as const,
    promise: runD1Sync(env, mode).finally(() => releaseD1SyncLock(env.DB, lockOwner)),
  };
}

async function runD1Sync(env: RoycoPharosD1SyncEnv, mode: D1SyncMode) {
  const now = Math.floor(Date.now() / 1000);
  const royco = mode === "pharos" ? null : await loadRoycoDawnMarkets({ dawnLive: env.ROYCO_DAWN_LIVE ?? "1" });
  const marketFixtures = royco?.markets ?? ROYCO_MARKET_FIXTURES;
  const requiredPharosIds = [
    ...new Set(
      marketFixtures
        .flatMap((market) => market.tranches)
        .map((tranche) => tranche.pharosStablecoinId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const cachedUnderlyings = await safeReadCachedUnderlyings(env.DB);
  const pharos =
    mode === "royco"
      ? {
          mode: "fixture" as const,
          underlyings: cachedUnderlyings.length > 0 ? cachedUnderlyings : UNDERLYING_FIXTURES,
          cacheEntries: [],
          warning: null,
        }
      : await loadPharosUnderlyings(requiredPharosIds, cachedUnderlyings, {
          apiKey: env.PHAROS_API_KEY,
          apiBase: env.PHAROS_API_BASE,
        });
  const pharosFetchTimes = pharos.underlyings.map((underlying) => underlying.fetchedAt ?? 0).filter((value) => value > 0);
  const pharosFetchedAt = pharosFetchTimes.length > 0 ? Math.max(...pharosFetchTimes) : now;
  const snapshot = buildSnapshot(now, marketFixtures, pharos.underlyings, {
    collectedAt: now,
    pharosFetchedAt,
    publishedAt: now,
  });
  const blockPublishReason = productionFixtureBlockReason(env, royco?.mode ?? "db-reuse", pharos.mode);
  const result = await publishSnapshotToD1(env.DB, snapshot, {
    job: `worker-sync:${mode}`,
    upstreamCount: royco?.upstreamCount ?? marketFixtures.length,
    parseErrorCount: royco?.parseErrorCount ?? 0,
    rawPayloadSampleJson: royco?.rawPayloadSampleJson,
    pharosCacheEntries: pharos.cacheEntries,
    blockPublishReason,
    metadata: {
      roycoMode: royco?.mode ?? "db-reuse",
      roycoWarning: royco?.warning ?? null,
      pharosMode: pharos.mode,
      pharosWarning: pharos.warning,
      blockPublishReason,
    },
  });

  return {
    ...result,
    generatedAt: snapshot.generatedAt,
    roycoMode: royco?.mode ?? "db-reuse",
    roycoWarning: royco?.warning ?? null,
    pharosMode: pharos.mode,
    pharosWarning: pharos.warning,
  };
}

async function acquireD1SyncLock(db: D1DatabaseLike) {
  const now = Math.floor(Date.now() / 1000);
  const owner = crypto.randomUUID();
  await db.prepare("DELETE FROM sync_locks WHERE name = ? AND expires_at <= ?").bind(D1_SYNC_LOCK_NAME, now).run();
  await db
    .prepare("INSERT OR IGNORE INTO sync_locks (name, owner, acquired_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(D1_SYNC_LOCK_NAME, owner, now, now + D1_SYNC_LOCK_TTL_SECONDS)
    .run();
  const row = await db.prepare("SELECT owner FROM sync_locks WHERE name = ?").bind(D1_SYNC_LOCK_NAME).first();
  return stringValue(row, "owner") === owner ? owner : null;
}

async function releaseD1SyncLock(db: D1DatabaseLike, owner: string) {
  await db.prepare("DELETE FROM sync_locks WHERE name = ? AND owner = ?").bind(D1_SYNC_LOCK_NAME, owner).run();
}

function productionFixtureBlockReason(env: RoycoPharosD1SyncEnv, roycoMode: string, pharosMode: string) {
  if (env.ENVIRONMENT !== "production" || env.ALLOW_FIXTURE_PUBLISH === "1") return null;
  if (roycoMode === "recorded-fixture" || roycoMode === "fixture-file") return `production_${roycoMode}_blocked`;
  if (pharosMode === "fixture") return "production_pharos_fixture_blocked";
  return null;
}

async function safeReadCachedUnderlyings(db: D1DatabaseLike) {
  try {
    return await readPharosUnderlyingsFromSql(new D1Reader(db));
  } catch {
    return [];
  }
}

function stringValue(row: unknown, key: string) {
  return typeof row === "object" && row != null && typeof (row as Record<string, unknown>)[key] === "string"
    ? ((row as Record<string, unknown>)[key] as string)
    : null;
}
