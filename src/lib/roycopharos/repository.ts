import { buildSnapshot, methodology } from "./snapshot";

export async function getRoycoPharosSnapshot() {
  if (useD1Storage()) {
    const { readSnapshotFromD1 } = await import("./d1");
    const snapshot = await readSnapshotFromD1();
    if (!snapshot) {
      throw new Error("RoycoPharos production D1 snapshot is unavailable. Run migrations and publish a sync before serving traffic.");
    }
    return snapshot;
  }

  const { readSnapshotFromDatabase, seedDatabase } = await import("./sqlite");
  let snapshot = readSnapshotFromDatabase();
  if (!snapshot) {
    seedDatabase(buildSnapshot());
    snapshot = readSnapshotFromDatabase();
  }
  if (!snapshot) {
    throw new Error("RoycoPharos snapshot is unavailable");
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

export async function getMethodology() {
  return methodology();
}

export async function getHealth() {
  const snapshot = await getRoycoPharosSnapshot();
  const lastRun = await readLatestSyncRunForRuntime();
  const trancheCounts = snapshot.tranches.reduce(
    (counts, tranche) => {
      if (tranche.mappingStatus === "mapped") counts.mapped += 1;
      if (tranche.mappingStatus === "conflict") counts.conflict += 1;
      if (tranche.scoreStatus === "nr") counts.nr += 1;
      if (tranche.scoreStatus === "low_confidence") counts.lowConfidence += 1;
      if (tranche.scoreStatus === "stale") counts.stale += 1;
      return counts;
    },
    { mapped: 0, conflict: 0, nr: 0, lowConfidence: 0, stale: 0 },
  );
  const freshness = {
    royco: snapshot.meta.royco.status,
    pharos: snapshot.meta.pharos.status,
    score: snapshot.meta.score.status,
  };
  const allFresh = freshness.royco === "fresh" && freshness.pharos === "fresh" && freshness.score === "fresh";
  return {
    ok: snapshot.tranches.length >= 18,
    degraded: lastRun?.status === "degraded" || !allFresh,
    generatedAt: snapshot.generatedAt,
    marketCount: snapshot.markets.length,
    trancheCount: snapshot.tranches.length,
    mappedTrancheCount: trancheCounts.mapped,
    conflictCount: trancheCounts.conflict,
    nrCount: trancheCounts.nr,
    lowConfidenceCount: trancheCounts.lowConfidence,
    staleCount: trancheCounts.stale,
    freshness,
    lastRun,
    meta: snapshot.meta,
  };
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
