import { closeSync, openSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROYCO_MARKET_FIXTURES, UNDERLYING_FIXTURES } from "./fixtures";
import { loadPharosUnderlyings } from "./pharos-client";
import { loadRoycoDawnMarkets } from "./royco-dawn";
import { buildSnapshot } from "./snapshot";
import { databasePath, readPharosUnderlyingsFromDatabase, seedDatabase } from "./sqlite";

export type SyncMode = "all" | "royco" | "pharos";

const LOCK_STALE_MS = 10 * 60 * 1000;

function lockPath() {
  return join(dirname(databasePath()), ".sync.lock");
}

// Exclusive-create lockfile so two concurrent syncs can't race the destructive publish. A lock
// older than LOCK_STALE_MS is treated as abandoned (a crashed sync) and stolen.
function acquireSyncLock(): number | null {
  const path = lockPath();
  try {
    return openSync(path, "wx");
  } catch {
    try {
      if (Date.now() - statSync(path).mtimeMs > LOCK_STALE_MS) {
        rmSync(path, { force: true });
        return openSync(path, "wx");
      }
    } catch {
      // lost the race to another sync; treat as held
    }
    return null;
  }
}

function releaseSyncLock(fd: number) {
  try {
    closeSync(fd);
  } catch {
    // already closed
  }
  try {
    rmSync(lockPath(), { force: true });
  } catch {
    // already removed
  }
}

export async function runRoycoPharosSync(mode: SyncMode = "all") {
  const lock = acquireSyncLock();
  if (lock == null) {
    return { status: "skipped", published: false, skipped: true, reason: "A sync is already in progress (lock held)." };
  }
  try {
    return await runSync(mode);
  } finally {
    releaseSyncLock(lock);
  }
}

async function runSync(mode: SyncMode) {
  const now = Math.floor(Date.now() / 1000);
  const royco = mode === "pharos" ? null : await loadRoycoDawnMarkets();
  const marketFixtures = royco?.markets ?? ROYCO_MARKET_FIXTURES;

  const requiredPharosIds = [
    ...new Set(
      marketFixtures
        .flatMap((market) => market.tranches)
        .map((tranche) => tranche.pharosStablecoinId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const cachedUnderlyings = safeReadCachedUnderlyings();
  const pharos =
    mode === "royco"
      ? {
          mode: "fixture" as const,
          underlyings: cachedUnderlyings.length > 0 ? cachedUnderlyings : UNDERLYING_FIXTURES,
          cacheEntries: [],
          warning: null,
        }
      : await loadPharosUnderlyings(requiredPharosIds, cachedUnderlyings);
  const pharosFetchedAt = Math.max(
    ...pharos.underlyings.map((underlying) => underlying.fetchedAt ?? 0).filter((value) => value > 0),
    now,
  );
  const snapshot = buildSnapshot(now, marketFixtures, pharos.underlyings, {
    collectedAt: now,
    pharosFetchedAt,
    publishedAt: now,
  });
  const result = seedDatabase(snapshot, undefined, {
    job: `sync:${mode}`,
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

function safeReadCachedUnderlyings() {
  try {
    return readPharosUnderlyingsFromDatabase();
  } catch {
    return [];
  }
}
