import { ROYCO_MARKET_FIXTURES, UNDERLYING_FIXTURES } from "./fixtures";
import { loadPharosUnderlyings } from "./pharos-client";
import { loadRoycoDawnMarkets } from "./royco-dawn";
import { buildSnapshot } from "./snapshot";
import { publishSnapshotToD1 } from "./d1-publish";
import { D1Reader, type D1DatabaseLike } from "./d1-reader";
import { readPharosUnderlyingsFromSql } from "./sql-read";

export type D1SyncMode = "all" | "royco" | "pharos";

export interface RoycoPharosD1SyncEnv {
  DB: D1DatabaseLike;
  ROYCO_DAWN_LIVE?: string;
  PHAROS_API_KEY?: string;
  PHAROS_API_BASE?: string;
  SYNC_ADMIN_TOKEN?: string;
}

export async function runRoycoPharosD1Sync(env: RoycoPharosD1SyncEnv, mode: D1SyncMode = "all") {
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
  const pharosFetchedAt = Math.max(
    ...pharos.underlyings.map((underlying) => underlying.fetchedAt ?? 0).filter((value) => value > 0),
    now,
  );
  const snapshot = buildSnapshot(now, marketFixtures, pharos.underlyings, {
    collectedAt: now,
    pharosFetchedAt,
    publishedAt: now,
  });
  const result = await publishSnapshotToD1(env.DB, snapshot, {
    job: `worker-sync:${mode}`,
    upstreamCount: royco?.upstreamCount ?? marketFixtures.length,
    rawPayloadSampleJson: royco?.rawPayloadSampleJson,
    pharosCacheEntries: pharos.cacheEntries,
    metadata: {
      roycoMode: royco?.mode ?? "db-reuse",
      roycoWarning: royco?.warning ?? null,
      pharosMode: pharos.mode,
      pharosWarning: pharos.warning,
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

async function safeReadCachedUnderlyings(db: D1DatabaseLike) {
  try {
    return await readPharosUnderlyingsFromSql(new D1Reader(db));
  } catch {
    return [];
  }
}
