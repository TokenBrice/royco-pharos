import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRoycoDawnMarkets } from "./royco-dawn";

describe("Royco Dawn loader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts malformed live market rows as parse errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          count: 2,
          data: [
            {
              chainId: 1,
              marketId: "valid-market",
              name: "Valid Market",
              listingType: "direct",
              status: "normal",
              seniorVault: {
                address: "0x0000000000000000000000000000000000000001",
                apy: 0.05,
                tvl: { tokenAmountUsd: 1000000 },
                depositToken: {
                  symbol: "USDC",
                  name: "USD Coin",
                  contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                  decimals: 6,
                },
                shareToken: {
                  symbol: "srUSDC",
                  name: "Senior USDC",
                  contractAddress: "0x0000000000000000000000000000000000000002",
                  decimals: 18,
                },
              },
            },
            {
              chainId: 1,
              marketId: "missing-vaults",
              name: "Missing Vaults",
            },
          ],
        }),
      ),
    );

    const result = await loadRoycoDawnMarkets({ dawnLive: "1" });

    expect(result.mode).toBe("live");
    expect(result.markets).toHaveLength(1);
    expect(result.parseErrorCount).toBe(1);
    expect(result.warning).toMatch(/could not be parsed/);
  });

  it("assigns reviewed venue tiers for supported non-mainnet chains", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          count: 1,
          data: [
            {
              chainId: 42161,
              marketId: "arbitrum-market",
              name: "Arbitrum Market",
              listingType: "direct",
              status: "normal",
              seniorVault: {
                address: "0x0000000000000000000000000000000000000001",
                apy: 0.05,
                tvl: { tokenAmountUsd: 1000000 },
                depositToken: {
                  symbol: "sUSDai",
                  name: "Staked USDai",
                  contractAddress: "0x0b2b2b2076d95dda7817e785989fe353fe955ef9",
                  decimals: 18,
                },
                shareToken: {
                  symbol: "srsUSDai",
                  name: "Senior sUSDai",
                  contractAddress: "0x0000000000000000000000000000000000000002",
                  decimals: 18,
                },
              },
            },
          ],
        }),
      ),
    );

    const result = await loadRoycoDawnMarkets({ dawnLive: "1" });

    expect(result.markets[0]?.chainSlug).toBe("arbitrum");
    expect(result.markets[0]?.venueTier).toBe("medium");
  });
});
