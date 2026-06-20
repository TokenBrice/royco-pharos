import type { ApiMeta, RoycoPharosSnapshot } from "./types";
import type { SyncRunSummary } from "./sql-read";

export type SnapshotTone = "good" | "watch" | "bad";

export interface TrancheFlagSummary {
  attention: boolean;
  missingOrLowConfidence: boolean;
  hard: boolean;
  reasons: string[];
}

export interface SnapshotHealthSummary {
  ok: boolean;
  degraded: boolean;
  tone: SnapshotTone;
  generatedAt: number;
  marketCount: number;
  trancheCount: number;
  mappedTrancheCount: number;
  conflictCount: number;
  nrCount: number;
  lowConfidenceCount: number;
  staleCount: number;
  unmappedCount: number;
  freshness: {
    royco: ApiMeta["royco"]["status"];
    pharos: ApiMeta["pharos"]["status"];
    score: ApiMeta["score"]["status"];
  };
  allFresh: boolean;
  flagCount: number;
  lastRun: SyncRunSummary | null;
  meta: ApiMeta;
}

interface TrancheFlagInput {
  mappingStatus: string | null;
  scoreStatus: string | null;
  safetyScore: number | null;
  statusNormalized: string | null;
  coverageHeadroomPct: number | null;
  utilizationRatio: number | null;
}

export function classifyTrancheFlags(tranche: TrancheFlagInput): TrancheFlagSummary {
  const reasons: string[] = [];
  if (tranche.scoreStatus === "nr" || tranche.safetyScore == null) reasons.push("nr");
  if (tranche.scoreStatus === "low_confidence") reasons.push("low_confidence");
  if (tranche.scoreStatus === "stale") reasons.push("stale");
  if (tranche.mappingStatus === "unmapped") reasons.push("unmapped");
  if (tranche.mappingStatus === "conflict") reasons.push("conflict");
  if (tranche.statusNormalized != null && tranche.statusNormalized !== "normal") reasons.push("market_status");
  if (tranche.coverageHeadroomPct != null && tranche.coverageHeadroomPct < 10) reasons.push("coverage_pressure");
  if (tranche.utilizationRatio != null && tranche.utilizationRatio >= 85) reasons.push("utilization_pressure");

  const hard = reasons.some((reason) => reason === "nr" || reason === "stale" || reason === "conflict");
  return {
    attention: reasons.length > 0,
    missingOrLowConfidence: reasons.some((reason) => reason === "nr" || reason === "low_confidence" || reason === "stale"),
    hard,
    reasons,
  };
}

export function badgeClassForState(value: string | null | undefined) {
  const normalized = value ?? "unknown";
  if (normalized === "mapped" || normalized === "computed") return "badge good";
  if (normalized === "conflict" || normalized === "stale") return "badge bad";
  if (normalized === "low_confidence") return "badge watch";
  if (normalized === "nr" || normalized === "unmapped") return "badge nr";
  return "badge neutral";
}

export function deriveSnapshotHealth(snapshot: RoycoPharosSnapshot, lastRun: SyncRunSummary | null = null): SnapshotHealthSummary {
  const trancheCounts = snapshot.tranches.reduce(
    (counts, tranche) => {
      if (tranche.mappingStatus === "mapped") counts.mapped += 1;
      if (tranche.mappingStatus === "unmapped") counts.unmapped += 1;
      if (tranche.mappingStatus === "conflict") counts.conflict += 1;
      if (tranche.scoreStatus === "nr" || tranche.safetyScore == null) counts.nr += 1;
      if (tranche.scoreStatus === "low_confidence") counts.lowConfidence += 1;
      if (tranche.scoreStatus === "stale") counts.stale += 1;
      return counts;
    },
    { mapped: 0, unmapped: 0, conflict: 0, nr: 0, lowConfidence: 0, stale: 0 },
  );
  const freshness = {
    royco: snapshot.meta.royco.status,
    pharos: snapshot.meta.pharos.status,
    score: snapshot.meta.score.status,
  };
  const allFresh = freshness.royco === "fresh" && freshness.pharos === "fresh" && freshness.score === "fresh";
  const flagCount = trancheCounts.nr + trancheCounts.lowConfidence + trancheCounts.stale + trancheCounts.unmapped + trancheCounts.conflict;
  const hasHardFlags = trancheCounts.conflict > 0 || trancheCounts.stale > 0 || trancheCounts.nr > 0;
  const ok = snapshot.tranches.length >= 18;
  const degraded = lastRun?.status === "degraded" || !allFresh || flagCount > 0;
  return {
    ok,
    degraded,
    tone: !ok || hasHardFlags ? "bad" : degraded ? "watch" : "good",
    generatedAt: snapshot.generatedAt,
    marketCount: snapshot.markets.length,
    trancheCount: snapshot.tranches.length,
    mappedTrancheCount: trancheCounts.mapped,
    conflictCount: trancheCounts.conflict,
    nrCount: trancheCounts.nr,
    lowConfidenceCount: trancheCounts.lowConfidence,
    staleCount: trancheCounts.stale,
    unmappedCount: trancheCounts.unmapped,
    freshness,
    allFresh,
    flagCount,
    lastRun,
    meta: snapshot.meta,
  };
}

export function unavailableSnapshotHealth(lastRun: SyncRunSummary | null = null) {
  const now = Math.floor(Date.now() / 1000);
  const meta = unavailableMeta(now);
  return {
    ok: false,
    degraded: true,
    tone: "bad" as const,
    generatedAt: 0,
    marketCount: 0,
    trancheCount: 0,
    mappedTrancheCount: 0,
    conflictCount: 0,
    nrCount: 0,
    lowConfidenceCount: 0,
    staleCount: 0,
    unmappedCount: 0,
    freshness: {
      royco: "stale" as const,
      pharos: "stale" as const,
      score: "stale" as const,
    },
    allFresh: false,
    flagCount: 0,
    lastRun,
    meta,
    error: "snapshot_unavailable" as const,
  };
}

function unavailableMeta(now: number): ApiMeta {
  const block = {
    collectedAt: null,
    fetchedAt: null,
    sourceObservedAt: null,
    sourceUpdatedAt: null,
    publishedAt: null,
    computedAt: null,
    inputHash: null,
    ageSeconds: null,
    status: "stale" as const,
    warning: "No published RoycoPharos snapshot is available.",
  };
  return {
    royco: { ...block, collectedAt: now },
    pharos: { ...block, fetchedAt: now },
    score: { ...block, computedAt: now },
  };
}
