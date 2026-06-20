import { describe, expect, it } from "vitest";
import { buildSnapshot, safetyGradeFromScore, scoreTranche } from ".";

describe("RoycoPharos scoring (v0.5)", () => {
  it("computes a strong Senior to an A-band Safety score without a first-loss term", () => {
    const snapshot = buildSnapshot(1_770_000_000);
    const senior = snapshot.tranches.find((tranche) => tranche.marketName === "Auto Finance autoUSD" && tranche.side === "senior");
    expect(senior?.scoreStatus).toBe("computed");
    expect(senior?.safetyScore).toBeGreaterThan(70);
    expect(senior?.safetyGrade).toBe("A");
    expect(senior?.penaltyBreakdown.some((row) => row.key === "junior-first-loss")).toBe(false);
  });

  it("uses calibrated Safety bands for direct Royco tranche seats", () => {
    expect(safetyGradeFromScore(70)).toBe("A");
    expect(safetyGradeFromScore(55)).toBe("B");
    expect(safetyGradeFromScore(40)).toBe("C");
    expect(safetyGradeFromScore(25)).toBe("D");
    expect(safetyGradeFromScore(10)).toBe("E");
    expect(safetyGradeFromScore(9)).toBe("F");

    const snapshot = buildSnapshot(1_770_000_000);
    const counts = snapshot.tranches.reduce(
      (acc, tranche) => {
        const grade = tranche.safetyGrade ?? "NR";
        acc[grade] = (acc[grade] ?? 0) + 1;
        return acc;
      },
      { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, NR: 0 } as Record<string, number>,
    );
    expect(counts).toMatchObject({ A: 2, B: 2, C: 5, D: 3, E: 4, F: 2, NR: 0 });
  });

  it("adds a buffer-scaled Junior first-loss term (full cushion → lightest)", () => {
    const snapshot = buildSnapshot(1_770_000_000);
    const junior = snapshot.tranches.find((tranche) => tranche.marketName === "Auto Finance autoUSD" && tranche.side === "junior");
    expect(junior?.scoreStatus).toBe("computed");
    // autoUSD coverage 0.99 vs required 0.10 → cushion saturated → floor term of 8.
    expect(junior?.penaltyBreakdown.find((row) => row.key === "junior-first-loss")?.rawPenalty).toBe(8);
  });

  it("lets a Senior tranche score above the whole-vault Pharos score when the buffer is thick", () => {
    const snapshot = buildSnapshot(1_770_000_000);
    const senior = snapshot.tranches.find((tranche) => tranche.marketName === "Maple Finance syrupUSDC" && tranche.side === "senior");
    expect(senior?.underlyingSafetyScore).toBe(63);
    expect(senior?.safetyScore).toBeGreaterThan(senior?.underlyingSafetyScore ?? Infinity);
    expect(senior?.safetyGrade).toBe("A");
  });

  it("reports base, exposure, and tranche-structure layer scores", () => {
    const result = scoreTranche(baseInput());
    expect(result.baseAssetScore).toBe(88);
    expect(result.exposureScore).toEqual(expect.any(Number));
    expect(result.exposureHaircut).toBeGreaterThan(0);
    expect(result.trancheStructureScore).toEqual(expect.any(Number));
    expect(result.penaltyBreakdown.some((row) => row.riskLayer === "exposure")).toBe(true);
    expect(result.penaltyBreakdown.some((row) => row.riskLayer === "tranche-structure")).toBe(true);
  });

  it("never lets a Junior outrank its Senior on Safety", () => {
    const snapshot = buildSnapshot(1_770_000_000);
    for (const market of snapshot.markets) {
      const senior = market.tranches.find((t) => t.side === "senior");
      const junior = market.tranches.find((t) => t.side === "junior");
      if (senior?.safetyScore != null && junior?.safetyScore != null) {
        expect(junior.safetyScore).toBeLessThanOrEqual(senior.safetyScore);
      }
    }
  });

  it("applies a saturating utilization term under limit pressure", () => {
    const snapshot = buildSnapshot(1_770_000_000);
    const tranche = snapshot.tranches.find((entry) => entry.marketName === "Staked Neutrl USD" && entry.side === "junior");
    // normUtil ≈ 1.07 → 14·(1−e^(−3·0.82)) ≈ 12.8, and bounded below the 14 cap.
    expect(tranche?.penaltyBreakdown.find((row) => row.key === "utilization")?.rawPenalty).toBeCloseTo(12.8, 1);
  });

  it("caps the total Junior haircut at the per-side ceiling", () => {
    const snapshot = buildSnapshot(1_770_000_000);
    for (const tranche of snapshot.tranches.filter((t) => t.side === "junior")) {
      expect(tranche.trancheHaircut ?? 0).toBeLessThanOrEqual(28);
    }
  });

  it("penalizes low TVL", () => {
    const snapshot = buildSnapshot(1_770_000_000);
    const tranche = snapshot.tranches.find((entry) => entry.marketName === "Auto Finance autoUSD" && entry.side === "senior");
    expect(tranche?.penaltyBreakdown.find((row) => row.key === "tvl")?.rawPenalty).toBe(5);
  });

  it("computes a separate risk-adjusted Opportunity grade from APY and Safety", () => {
    const snapshot = buildSnapshot(1_770_000_000);
    const junior = snapshot.tranches.find((entry) => entry.marketName === "Apyx apyUSD" && entry.side === "junior");
    // apyUSD junior: weak/protected → low Safety, but ~51% APY → Opportunity should outrank Safety.
    expect(junior?.opportunityYield).toBeGreaterThan(junior?.safetyScore == null ? Infinity : 0);
    expect(junior?.opportunityScore).toBeGreaterThan(junior?.safetyScore ?? Infinity);
    expect(["A", "B"]).toContain(junior?.opportunityGrade);
  });

  it("returns NR when the underlying Pharos score is missing", () => {
    const result = scoreTranche(baseInput({ underlyingSafetyScore: null, underlyingSafetyGrade: null }));
    expect(result.scoreStatus).toBe("nr");
    expect(result.safetyScore).toBeNull();
    expect(result.exposureScore).toBeNull();
    expect(result.trancheStructureScore).toBeNull();
    expect(result.opportunityScore).toBeNull();
    expect(result.opportunityGrade).toBe("NR");
    expect(result.nrReason).toMatch(/Missing underlying/);
  });

  it("uses low confidence for missing non-fatal Royco fields", () => {
    const result = scoreTranche(
      baseInput({
        statusNormalized: null,
        coverageRatio: null,
        utilizationRatio: null,
        tvlUsd: null,
      }),
    );
    expect(result.scoreStatus).toBe("low_confidence");
    expect(result.safetyScore).toEqual(expect.any(Number));
    expect(result.penaltyBreakdown.find((row) => row.key === "status")?.missing).toBe(true);
    expect(result.penaltyBreakdown.find((row) => row.key === "coverage")?.missing).toBe(true);
    expect(result.penaltyBreakdown.find((row) => row.key === "utilization")?.missing).toBe(true);
    expect(result.penaltyBreakdown.find((row) => row.key === "tvl")?.missing).toBe(true);
  });

  it("falls back to 7d APY when current APY is zero", () => {
    const snapshot = buildSnapshot(1_770_000_000);
    const zero = snapshot.tranches.find((entry) => entry.marketName === "Ember eEarn" && entry.side === "senior");
    expect(zero?.apyCurrentPct).toBe(0);
    expect(zero?.scoreStatus).toBe("computed");
    expect(zero?.apySource).toBe("7d");
    expect(zero?.apyUsedPct).toBeGreaterThan(0);
  });

  it("reconciles applied penalty rows to the combined exposure and structure haircuts", () => {
    const result = scoreTranche(baseInput({ underlyingSafetyScore: 33, coverageRatio: 0.20849, requiredCoverageRatio: 0.2 }));
    const exposureTotal = result.penaltyBreakdown
      .filter((row) => row.riskLayer === "exposure")
      .reduce((sum, row) => sum + row.appliedPenalty, 0);
    const structureTotal = result.penaltyBreakdown
      .filter((row) => row.riskLayer === "tranche-structure")
      .reduce((sum, row) => sum + row.appliedPenalty, 0);
    expect(Number(exposureTotal.toFixed(1))).toBe(result.exposureHaircut);
    expect(Number(structureTotal.toFixed(1))).toBe(result.trancheHaircut);
  });

  it("marks invalid tranche side as NR", () => {
    const result = scoreTranche({ ...baseInput(), side: null });
    expect(result.scoreStatus).toBe("nr");
    expect(result.nrReason).toMatch(/Invalid/);
  });
});

function baseInput(overrides: Partial<Parameters<typeof scoreTranche>[0]> = {}): Parameters<typeof scoreTranche>[0] {
  return {
    trancheId: "test",
    side: "senior",
    mappingStatus: "mapped",
    pharosStablecoinId: "apyusd-apyx",
    underlyingSafetyScore: 88,
    underlyingSafetyGrade: "B",
    statusNormalized: "normal",
    coverageRatio: 1.5,
    requiredCoverageRatio: 1.2,
    utilizationRatio: 0.4,
    utilizationLimitRatio: 1,
    tvlUsd: 1_000_000,
    drawdownRatio: 0,
    venueTier: "low",
    accessRestricted: false,
    withdrawalUnderlyingDependent: false,
    juniorRedemptionDelaySeconds: null,
    apyCurrentPct: 5,
    apy7dPct: 5,
    observedAt: null,
    ...overrides,
  };
}
