import { describe, expect, it } from "vitest";
import { validatePublishCandidate } from "./publish-validation";

describe("publish candidate validation", () => {
  it("holds undersized or all-NR candidates when a prior snapshot exists", () => {
    expect(
      validatePublishCandidate({
        trancheCount: 1,
        computedTrancheCount: 1,
        hasPrior: true,
      }),
    ).toMatchObject({ publish: false, errorCode: "candidate_tranche_count_below_floor" });

    expect(
      validatePublishCandidate({
        trancheCount: 18,
        computedTrancheCount: 0,
        hasPrior: true,
      }),
    ).toMatchObject({ publish: false, errorCode: "candidate_all_nr" });
  });

  it("allows degraded bootstrap but rejects explicit production blocks and older generations", () => {
    expect(
      validatePublishCandidate({
        trancheCount: 1,
        computedTrancheCount: 1,
        hasPrior: false,
      }),
    ).toMatchObject({ publish: true, status: "degraded", errorCode: "bootstrap_below_floor" });

    expect(
      validatePublishCandidate({
        trancheCount: 18,
        computedTrancheCount: 18,
        hasPrior: true,
        blockPublishReason: "production_pharos_fixture_blocked",
      }),
    ).toMatchObject({ publish: false, errorCode: "production_pharos_fixture_blocked" });

    expect(
      validatePublishCandidate({
        trancheCount: 18,
        computedTrancheCount: 18,
        hasPrior: true,
        latestPublishedAt: 20,
        generatedAt: 10,
      }),
    ).toMatchObject({ publish: false, errorCode: "candidate_older_than_current" });
  });
});
