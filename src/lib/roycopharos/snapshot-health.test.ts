import { describe, expect, it } from "vitest";
import { badgeClassForState, classifyTrancheFlags } from "./snapshot-health";

describe("snapshot health flags", () => {
  it("classifies hard tranche flags consistently", () => {
    expect(
      classifyTrancheFlags({
        mappingStatus: "conflict",
        scoreStatus: "computed",
        safetyScore: 70,
        statusNormalized: "normal",
        coverageHeadroomPct: 20,
        utilizationRatio: 50,
      }),
    ).toMatchObject({ attention: true, hard: true, missingOrLowConfidence: false });

    expect(
      classifyTrancheFlags({
        mappingStatus: "mapped",
        scoreStatus: "low_confidence",
        safetyScore: 70,
        statusNormalized: "normal",
        coverageHeadroomPct: 20,
        utilizationRatio: 50,
      }),
    ).toMatchObject({ attention: true, hard: false, missingOrLowConfidence: true });
  });

  it("maps data badges to the canonical tone classes", () => {
    expect(badgeClassForState("computed")).toBe("badge good");
    expect(badgeClassForState("low_confidence")).toBe("badge watch");
    expect(badgeClassForState("stale")).toBe("badge bad");
    expect(badgeClassForState("conflict")).toBe("badge bad");
    expect(badgeClassForState("nr")).toBe("badge nr");
    expect(badgeClassForState("unmapped")).toBe("badge nr");
  });
});
