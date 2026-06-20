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
    summary: "cached",
    sourceUpdatedAt: fetchedAt,
    fetchedAt,
  };
}
