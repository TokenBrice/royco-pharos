import { buildSnapshot, methodology } from "./snapshot";
import { deriveSnapshotHealth, unavailableSnapshotHealth } from "./snapshot-health";

export class SnapshotUnavailableError extends Error {
  constructor(message = "RoycoPharos snapshot is unavailable") {
    super(message);
    this.name = "SnapshotUnavailableError";
  }
}

export async function getRoycoPharosSnapshotOrNull() {
  if (useD1Storage()) {
    const { readSnapshotFromD1 } = await import("./d1");
    return readSnapshotFromD1();
  }

  const { readSnapshotFromDatabase, seedDatabase } = await import("./sqlite");
  let snapshot = await readSnapshotFromDatabase();
  if (!snapshot) {
    seedDatabase(buildSnapshot(), undefined, {
      job: "local-auto-seed",
      metadata: {
        roycoMode: "recorded-fixture",
        pharosMode: "fixture",
        localAutoSeed: true,
      },
    });
    snapshot = await readSnapshotFromDatabase();
  }
  return snapshot;
}

export async function getRoycoPharosSnapshot() {
  const snapshot = await getRoycoPharosSnapshotOrNull();
  if (!snapshot) {
    throw new SnapshotUnavailableError(
      useD1Storage()
        ? "RoycoPharos production D1 snapshot is unavailable. Run migrations and publish a sync before serving traffic."
        : "RoycoPharos snapshot is unavailable",
    );
  }
  return snapshot;
}

export async function getTranches() {
  return (await getRoycoPharosSnapshot()).tranches;
}

export async function getMarkets() {
  return (await getRoycoPharosSnapshot()).markets;
}

export async function getMarketByKey(key: string) {
  return (await getRoycoPharosSnapshot()).markets.find((market) => market.marketKey === key) ?? null;
}

export async function getTrancheHistory(trancheId: string, days: number) {
  if (useD1Storage()) {
    const { readTrancheHistoryFromD1 } = await import("./d1");
    return readTrancheHistoryFromD1(trancheId, days);
  }

  const { readTrancheHistoryFromDatabase } = await import("./sqlite");
  return readTrancheHistoryFromDatabase(trancheId, days);
}

export async function getApiMeta() {
  if (useD1Storage()) {
    const { readApiMetaFromD1 } = await import("./d1");
    return readApiMetaFromD1();
  }

  const { readApiMetaFromDatabase } = await import("./sqlite");
  return readApiMetaFromDatabase();
}

export async function getTrancheHistoryWithMeta(trancheId: string, days: number) {
  const [lastRun, meta, history] = await Promise.all([readLatestSyncRunForRuntime(), getApiMeta(), getTrancheHistory(trancheId, days)]);
  if (useD1Storage() && !lastRun?.published) {
    throw new SnapshotUnavailableError("RoycoPharos production D1 snapshot is unavailable. Run migrations and publish a sync before serving traffic.");
  }
  return { meta, history };
}

export async function getMethodology() {
  return methodology();
}

export async function getHealth() {
  const lastRun = await readLatestSyncRunForRuntime();
  const snapshot = await getRoycoPharosSnapshotOrNull();
  return snapshot ? deriveSnapshotHealth(snapshot, lastRun) : unavailableSnapshotHealth(lastRun);
}

async function readLatestSyncRunForRuntime() {
  if (useD1Storage()) {
    const { readLatestSyncRunFromD1 } = await import("./d1");
    return readLatestSyncRunFromD1();
  }

  const { readLatestSyncRun } = await import("./sqlite");
  return readLatestSyncRun();
}

function useD1Storage() {
  return process.env.ROYCOPHAROS_STORAGE === "d1";
}
