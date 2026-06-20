export interface CandidateValidation {
  publish: boolean;
  status: "ok" | "degraded";
  errorCode: string | null;
}

export interface ValidatePublishCandidateInput {
  trancheCount: number;
  computedTrancheCount: number;
  hasPrior: boolean;
  latestPublishedAt?: number | null;
  generatedAt?: number | null;
  blockPublishReason?: string | null;
}

export function validatePublishCandidate({
  trancheCount,
  computedTrancheCount,
  hasPrior,
  latestPublishedAt = null,
  generatedAt = null,
  blockPublishReason = null,
}: ValidatePublishCandidateInput): CandidateValidation {
  if (blockPublishReason) {
    return { publish: false, status: "degraded", errorCode: blockPublishReason };
  }
  if (latestPublishedAt != null && generatedAt != null && latestPublishedAt > generatedAt) {
    return { publish: false, status: "degraded", errorCode: "candidate_older_than_current" };
  }
  if (trancheCount === 0) {
    return { publish: false, status: "degraded", errorCode: "candidate_empty" };
  }
  if (hasPrior) {
    if (trancheCount < 18) {
      return { publish: false, status: "degraded", errorCode: "candidate_tranche_count_below_floor" };
    }
    if (computedTrancheCount === 0) {
      return { publish: false, status: "degraded", errorCode: "candidate_all_nr" };
    }
    return { publish: true, status: "ok", errorCode: null };
  }
  return trancheCount >= 18
    ? { publish: true, status: "ok", errorCode: null }
    : { publish: true, status: "degraded", errorCode: "bootstrap_below_floor" };
}
