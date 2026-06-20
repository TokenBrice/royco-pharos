import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPharosUnderlyings } from "./pharos-client";
import type { UnderlyingSummary } from "./types";

describe("Pharos client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not backfill missing live Pharos scores from fixtures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url);
        if (href.endsWith("/api/stablecoins")) {
          return Response.json({ peggedAssets: [{ id: "autousd", symbol: "autoUSD", name: "Auto USD" }] });
        }
        return Response.json({ cards: [] });
      }),
    );

    const result = await loadPharosUnderlyings(["autousd"], [], { apiKey: "ph_live_test", apiBase: "https://pharos.test" });

    expect(result.mode).toBe("live");
    expect(result.warning).toMatch(/Missing live Pharos Safety Score/);
    expect(result.underlyings[0]).toMatchObject({
      pharosStablecoinId: "autousd",
      underlyingSafetyScore: null,
      underlyingSafetyGrade: null,
    });
  });

  it("uses bounded stale-if-error cache only while it is inside the stale window", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));

    const freshFallback = [fallbackUnderlying(now - 60)];
    const freshResult = await loadPharosUnderlyings(["autousd"], freshFallback, {
      apiKey: "ph_live_test",
      apiBase: "https://pharos.test",
    });

    expect(freshResult.mode).toBe("stale-if-error");
    expect(freshResult.underlyings[0].fetchedAt).toBe(freshFallback[0].fetchedAt);

    const expiredResult = await loadPharosUnderlyings(["autousd"], [fallbackUnderlying(now - 2 * 86_400)], {
      apiKey: "ph_live_test",
      apiBase: "https://pharos.test",
    });

    expect(expiredResult.mode).toBe("fixture");
  });

  it("passes peg health, dimensions, and resolved upstream dependencies through live report cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url);
        if (href.endsWith("/api/stablecoins")) {
          return Response.json({
            peggedAssets: [
              { id: "savusd-avant", symbol: "savUSD", name: "Avant Staked USD", price: 1.01, circulating: { peggedUSD: 44_000_000 } },
            ],
          });
        }
        return Response.json({
          liveToFallbackCoins: [],
          collateralDriftCoins: [],
          cards: [
            {
              id: "savusd-avant",
              symbol: "savUSD",
              overallScore: 41,
              overallGrade: "D",
              baseScore: 40.9,
              dimensions: {
                pegStability: {
                  score: 99,
                  grade: "A+",
                  detail: "Peg reference (avUSD): 99/100.",
                  detailItems: [
                    { label: "Peg reference (avUSD)", value: "99/100", detail: "Peg reference (avUSD): 99/100" },
                    { label: "Adjustment", value: "Yield-bearing", detail: "yield-bearing — expected price appreciation excluded" },
                  ],
                },
                dependencyRisk: {
                  score: 32,
                  grade: "F",
                  detail: "Parent exposure dominates the dependency risk.",
                  detailItems: [],
                },
              },
              rawInputs: {
                pegScore: 99,
                activeDepeg: false,
                activeDepegBps: null,
                depegEventCount: 5,
                lastEventAt: 1_771_988_584,
                dependencies: [{ id: "avusd-avant", weight: 1, type: "wrapper" }],
                variantParentId: "avusd-avant",
                variantKind: "strategy-vault",
                navToken: true,
              },
              bridgeRouteRisk: { tier: "single-chain-or-native", score: 100, label: "Single-chain or issuer-native route", summary: "native route" },
            },
            { id: "avusd-avant", symbol: "avUSD", name: "Avant USD", overallScore: 42, overallGrade: "D" },
          ],
        });
      }),
    );

    const result = await loadPharosUnderlyings(["savusd-avant"], [], {
      apiKey: "ph_live_test",
      apiBase: "https://pharos.test",
    });

    const underlying = result.underlyings[0];
    expect(underlying).toMatchObject({
      pharosStablecoinId: "savusd-avant",
      underlyingSafetyScore: 41,
      underlyingSafetyGrade: "D",
      overallBaseScore: 40.9,
      pharosUrl: "https://pharos.watch/stablecoin/savusd-avant/",
      peg: { score: 99, grade: "A+", activeDepeg: false, depegEventCount: 5, yieldBearing: true },
      variantKind: "strategy-vault",
      navToken: true,
      bridgeRoute: { label: "Single-chain or issuer-native route", score: 100 },
      summary: "Parent exposure dominates the dependency risk.",
      upstreamDependencies: [
        {
          id: "avusd-avant",
          name: "Avant USD",
          symbol: "avUSD",
          weightPct: 100,
          safetyScore: 42,
          safetyGrade: "D",
          pharosUrl: "https://pharos.watch/stablecoin/avusd-avant/",
          relationship: "wrapper",
        },
      ],
    });
    expect(underlying.dimensions.map((dimension) => dimension.key)).toEqual(["pegStability", "dependencyRisk"]);
    expect(underlying.dimensions[0]).toMatchObject({ label: "Peg Stability", score: 99, grade: "A+" });
    // DEWS is no longer modeled by Pharos — it must not reappear on the summary.
    expect(underlying).not.toHaveProperty("dews");
  });
});

function fallbackUnderlying(fetchedAt: number): UnderlyingSummary {
  return {
    pharosStablecoinId: "autousd",
    symbol: "autoUSD",
    name: "Auto USD",
    price: 1,
    supplyUsd: 1_000_000,
    underlyingSafetyScore: 92,
    underlyingSafetyGrade: "A",
    overallBaseScore: 90,
    pharosUrl: "https://pharos.watch/stablecoin/autousd/",
    peg: null,
    dimensions: [],
    upstreamDependencies: [],
    variantKind: null,
    variantParentId: null,
    navToken: null,
    bridgeRoute: null,
    freshness: { fallback: false, collateralDrift: false, stale: false },
    summary: "cached",
    sourceUpdatedAt: fetchedAt,
    fetchedAt,
  };
}
