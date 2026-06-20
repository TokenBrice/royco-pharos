import type { RoycoMarketFixture, UnderlyingSummary } from "./types";

const ADDRESS_PREFIX = "0x000000000000000000000000000000000000";

export const PHAROS_ID_BY_SYMBOL: Record<string, string> = {
  aa_falconxusdc: "aa-falconx-mev-capital",
  apyusd: "apyusd-apyx",
  autousd: "autousd-auto-finance",
  eearn: "eearn-ember",
  savusd: "savusd-avant",
  snusd: "nusd-neutrl",
  stcusd: "stcusd-cap",
  susdai: "susdai-usd-ai",
  syrupusdc: "syrupusdc-maple",
};

export const UNDERLYING_FIXTURES: UnderlyingSummary[] = [
  {
    pharosStablecoinId: "savusd-avant",
    symbol: "savUSD",
    name: "Avant savUSD",
    price: 1.1766,
    supplyUsd: 44_000_000,
    underlyingSafetyScore: 33,
    underlyingSafetyGrade: "F",
    summary: "Recorded Pharos fixture: yield-bearing Avant wrapper with concentrated strategy and issuer dependencies.",
    sourceUpdatedAt: null,
    fetchedAt: null,
  },
  {
    pharosStablecoinId: "apyusd-apyx",
    symbol: "apyUSD",
    name: "Apyx apyUSD",
    price: 1.001,
    supplyUsd: 82_400_000,
    underlyingSafetyScore: 49,
    underlyingSafetyGrade: "D",
    summary: "Recorded Pharos fixture: ERC-4626 wrapper exposure with issuer and governance watch items.",
    sourceUpdatedAt: null,
    fetchedAt: null,
  },
  {
    pharosStablecoinId: "syrupusdc-maple",
    symbol: "syrupUSDC",
    name: "Maple syrupUSDC",
    price: 1.07,
    supplyUsd: 432_000_000,
    underlyingSafetyScore: 63,
    underlyingSafetyGrade: "C+",
    summary: "Recorded Pharos fixture: institutional-credit vault with FIFO withdrawal and borrower concentration risk.",
    sourceUpdatedAt: null,
    fetchedAt: null,
  },
  {
    pharosStablecoinId: "aa-falconx-mev-capital",
    symbol: "AA_FalconXUSDC",
    name: "Pareto AA FalconXUSDC",
    price: 1.04,
    supplyUsd: 27_000_000,
    underlyingSafetyScore: 52,
    underlyingSafetyGrade: "C-",
    summary: "Recorded Pharos fixture: senior credit-vault share with monthly exit and credit-line dependencies.",
    sourceUpdatedAt: null,
    fetchedAt: null,
  },
  {
    pharosStablecoinId: "nusd-neutrl",
    symbol: "sNUSD",
    name: "Neutrl sNUSD",
    price: 0.999,
    supplyUsd: 44_100_000,
    underlyingSafetyScore: 64,
    underlyingSafetyGrade: "C+",
    summary: "Recorded Pharos fixture: moderate dependency and redemption watch items.",
    sourceUpdatedAt: null,
    fetchedAt: null,
  },
  {
    pharosStablecoinId: "stcusd-cap",
    symbol: "stcUSD",
    name: "Cap stcUSD",
    price: 1,
    supplyUsd: 39_000_000,
    underlyingSafetyScore: 28,
    underlyingSafetyGrade: "F",
    summary: "Recorded Pharos fixture: staked Cap wrapper with proportional-basket and liquidity caveats.",
    sourceUpdatedAt: null,
    fetchedAt: null,
  },
  {
    pharosStablecoinId: "eearn-ember",
    symbol: "eEARN",
    name: "Ember eEARN",
    price: 1.002,
    supplyUsd: 17_200_000,
    underlyingSafetyScore: 74,
    underlyingSafetyGrade: "C",
    summary: "Pharos fixture: higher dependency risk than stronger tracked underlyings.",
    sourceUpdatedAt: null,
    fetchedAt: null,
  },
  {
    pharosStablecoinId: "susdai-usd-ai",
    symbol: "sUSDai",
    name: "USD.AI sUSDai",
    price: 1.01,
    supplyUsd: 76_000_000,
    underlyingSafetyScore: 60,
    underlyingSafetyGrade: "C+",
    summary: "Recorded Pharos fixture: staked USDai wrapper with GPU-loan exposure and queued exits.",
    sourceUpdatedAt: null,
    fetchedAt: null,
  },
  {
    pharosStablecoinId: "autousd-auto-finance",
    symbol: "autoUSD",
    name: "Auto Finance autoUSD",
    price: 1,
    supplyUsd: 28_700_000,
    underlyingSafetyScore: 78,
    underlyingSafetyGrade: "C",
    summary: "Pharos fixture: Auto Finance vault share with venue and liquidity caveats.",
    sourceUpdatedAt: null,
    fetchedAt: null,
  },
];

export const ROYCO_MARKET_FIXTURES: RoycoMarketFixture[] = [
  market("43114", "avalanche", "0x7240ff91b471217ff93349184abe9f102ca1955c", "Staked Avant USD", "normal", 5_659_540, 0.20849, 0.2, 0.95927, 0.9, 0, 0, "medium", [
    tranche("senior", "savUSD", "savusd-avant", 0.07008, 0.07798, 4_479_576, {
      decimals: 18,
      depositTokenAddress: "0x06d47f3fb376649c3a9dafe069b3d6e35572219e",
      shareTokenSymbol: "srRoySAVUSD",
    }),
    tranche("junior", "savUSD", "savusd-avant", 0.07814, 0.08296, 1_179_964, {
      decimals: 18,
      depositTokenAddress: "0x06d47f3fb376649c3a9dafe069b3d6e35572219e",
      shareTokenSymbol: "jrRoySAVUSD",
    }),
  ]),
  market("1", "ethereum", "0xcfbdea0990f21b103c8d123d0d5273b4ea269cb4", "Apyx apyUSD", "protected", 4_416_838, 0.33755, 0.15, 0.44438, 0.9, 0, 0, "medium", [
    tranche("senior", "apyUSD", "apyusd-apyx", 0, 0.0177, 2_925_987, {
      depositTokenAddress: "0x38eeb52f0771140d10c4e9a9a72349a329fe8a6a",
      shareTokenSymbol: "srRoyAPYUSD",
    }),
    tranche("junior", "apyUSD", "apyusd-apyx", 0.51716, 7.55082, 1_490_851, {
      depositTokenAddress: "0x38eeb52f0771140d10c4e9a9a72349a329fe8a6a",
      shareTokenSymbol: "jrRoyAPYUSD",
    }),
  ]),
  market("1", "ethereum", "0xde1ce2cf64808e50d000f93058784270e412b3a4", "Maple Finance syrupUSDC", "normal", 2_748_057, 0.11139, 0.02, 0.17954, 0.9, 0, 0, "medium", [
    tranche("senior", "syrupUSDC", "syrupusdc-maple", 0.04479, 0.04615, 2_441_941, {
      decimals: 6,
      depositTokenAddress: "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b",
      shareTokenSymbol: "srRoySYRUPUSDC",
    }),
    tranche("junior", "syrupUSDC", "syrupusdc-maple", 0.0538, 0.05915, 306_117, {
      decimals: 6,
      depositTokenAddress: "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b",
      shareTokenSymbol: "jrRoySYRUPUSDC",
    }),
  ]),
  market("1", "ethereum", "0x15bb63c07740ff972f76716cacc5766f0c641791", "Pareto AA FalconXUSDC", "normal", 2_699_068, 0.03705, 0.03, 0.80975, 0.9, 0, 0, "high", [
    tranche("senior", "AA_FalconXUSDC", "aa-falconx-mev-capital", 0.07276, 0.07276, 2_599_071, {
      depositTokenAddress: "0xc26a6fa2c37b38e549a4a1807543801db684f99c",
      shareTokenSymbol: "srRoyAA_FALCONXUSDC",
    }),
    tranche("junior", "AA_FalconXUSDC", "aa-falconx-mev-capital", 0.1981, 0.1981, 99_997, {
      depositTokenAddress: "0xc26a6fa2c37b38e549a4a1807543801db684f99c",
      shareTokenSymbol: "jrRoyAA_FALCONXUSDC",
    }),
  ]),
  market("1", "ethereum", "0x0ae0978b868804929fd4c06b3b22d9197b8cd3c6", "Staked Neutrl USD", "normal", 1_920_680, 0.07245, 0.07, 0.96618, 0.9, 0, 0, "medium", [
    tranche("senior", "sNUSD", "nusd-neutrl", 0.03015, 0.03396, 1_781_535, {
      depositTokenAddress: "0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313",
      shareTokenSymbol: "srRoySNUSD",
    }),
    tranche("junior", "sNUSD", "nusd-neutrl", 0.22417, 0.2665, 139_146, {
      depositTokenAddress: "0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313",
      shareTokenSymbol: "jrRoySNUSD",
    }),
  ]),
  market("1", "ethereum", "0x9911f227e9428964d8a35b852513919c8df92038", "Staked Cap USD", "normal", 1_694_724, 0.0537, 0.03, 0.55866, 0.9, 0, 0, "high", [
    tranche("senior", "stcUSD", "stcusd-cap", 0.05176, 0.04726, 1_603_719, {
      depositTokenAddress: "0x88887be419578051ff9f4eb6c858a951921d8888",
      shareTokenSymbol: "srRoySTCUSD",
    }),
    tranche("junior", "stcUSD", "stcusd-cap", 0.08204, 0.07949, 91_005, {
      depositTokenAddress: "0x88887be419578051ff9f4eb6c858a951921d8888",
      shareTokenSymbol: "jrRoySTCUSD",
    }),
  ]),
  market("1", "ethereum", "0x36c1d7cafa9a220fc1450fa070277aed69f8c9b2", "Ember eEarn", "normal", 1_018_422, 0.10973, 0.1, 0.91133, 0.9, 0, 0, "unknown", [
    tranche("senior", "eEARN", "eearn-ember", 0, 0.07404, 906_671, {
      decimals: 6,
      depositTokenAddress: "0x9be9294722f8aad37b11a9792be2c782182cafa2",
      shareTokenSymbol: "srRoyEEARN",
    }),
    tranche("junior", "eEARN", "eearn-ember", 0, 0.17854, 111_751, {
      decimals: 6,
      depositTokenAddress: "0x9be9294722f8aad37b11a9792be2c782182cafa2",
      shareTokenSymbol: "jrRoyEEARN",
    }),
  ]),
  market("42161", "arbitrum", "0xfdb17e53ea5d342124b8473188bcb9f05f1949ca", "Staked USDai", "normal", 634_446, 0.07968, 0.07, 0.87849, 0.9, 0, 0, "unknown", [
    tranche("senior", "sUSDai", "susdai-usd-ai", 0.0248, 0.02586, 583_893, {
      depositTokenAddress: "0x0b2b2b2076d95dda7817e785989fe353fe955ef9",
      shareTokenSymbol: "srRoySUSDAI",
    }),
    tranche("junior", "sUSDai", "susdai-usd-ai", 0.06303, 0.06622, 50_554, {
      depositTokenAddress: "0x0b2b2b2076d95dda7817e785989fe353fe955ef9",
      shareTokenSymbol: "jrRoySUSDAI",
    }),
  ]),
  market("1", "ethereum", "0x8748d1c21cc550b435487f473d9aaf6c84da46a6", "Auto Finance autoUSD", "normal", 102_958, 0.99288, 0.1, 0.10072, 0.9, 0, 0, "low", [
    tranche("senior", "autoUSD", "autousd-auto-finance", 0.134, 0.05443, 733, {
      depositTokenAddress: "0xa7569a44f348d3d70d8ad5889e50f78e33d80d35",
      shareTokenSymbol: "srRoyAUTOUSD",
    }),
    tranche("junior", "autoUSD", "autousd-auto-finance", 0.13654, 0.0558, 102_225, {
      depositTokenAddress: "0xa7569a44f348d3d70d8ad5889e50f78e33d80d35",
      shareTokenSymbol: "jrRoyAUTOUSD",
    }),
  ]),
];

function market(
  chainId: string,
  chainSlug: string,
  marketId: string,
  name: string,
  statusNormalized: RoycoMarketFixture["statusNormalized"],
  tvlUsd: number | null,
  coverageRatio: number | null,
  requiredCoverageRatio: number | null,
  utilizationRatio: number | null,
  utilizationLimitRatio: number | null,
  drawdownRatio: number | null,
  totalDrawdowns: number,
  venueTier: RoycoMarketFixture["venueTier"],
  tranches: RoycoMarketFixture["tranches"],
): RoycoMarketFixture {
  return {
    chainId: Number(chainId),
    chainSlug,
    marketId,
    name,
    listingType: "verified",
    statusNormalized,
    tvlUsd,
    coverageRatio,
    requiredCoverageRatio,
    utilizationRatio,
    utilizationLimitRatio,
    drawdownRatio,
    totalDrawdowns,
    juniorRedemptionDelaySeconds: 0,
    venueTier,
    accessRestricted: false,
    withdrawalUnderlyingDependent: true,
    tranches,
  };
}

function tranche(
  side: "senior" | "junior",
  symbol: string,
  pharosStablecoinId: string | null,
  apyCurrentRaw: number,
  apy7dRaw: number,
  tvlUsd: number | null,
  options: {
    decimals?: number;
    depositTokenAddress?: string;
    shareTokenSymbol?: string;
    shareTokenDecimals?: number;
  } = {},
): RoycoMarketFixture["tranches"][number] {
  const addressSeed = `${symbol}-${side}`.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8).padEnd(8, "0");
  const mappingStatus = pharosStablecoinId ? "mapped" : "unmapped";
  return {
    side,
    vaultAddress: `${ADDRESS_PREFIX}${side === "senior" ? "01" : "02"}${addressSeed.slice(0, 2)}`,
    depositTokenSymbol: symbol,
    depositTokenName: symbol === "mystUSD" ? "Mystery USD" : `${symbol} deposit token`,
    depositTokenAddress: options.depositTokenAddress ?? `${ADDRESS_PREFIX}${addressSeed.slice(0, 4)}`,
    depositTokenDecimals: options.decimals ?? 18,
    shareTokenSymbol: options.shareTokenSymbol ?? `${side === "senior" ? "sr" : "jr"}${symbol}`,
    shareTokenName: `${side} ${symbol} Royco share`,
    shareTokenAddress: `${ADDRESS_PREFIX}${side === "senior" ? "11" : "22"}${addressSeed.slice(2, 4)}`,
    shareTokenDecimals: options.shareTokenDecimals ?? 18,
    pharosStablecoinId,
    mappingStatus,
    mappingSource: mappingStatus === "mapped" ? "manual-reviewed" : "royco-provided",
    mappingConfidence: mappingStatus === "mapped" ? "manual" : "probable",
    apyCurrentRaw,
    apyCurrentPct: apyCurrentRaw * 100,
    apy7dRaw,
    apy7dPct: apy7dRaw * 100,
    apyUnit: "ratio",
    apyWindow: "current",
    tvlUsd,
  };
}
