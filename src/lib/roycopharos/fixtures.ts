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
    "pharosStablecoinId": "autousd-auto-finance",
    "symbol": "autoUSD",
    "name": "Auto Finance autoUSD",
    "price": null,
    "supplyUsd": 6675184,
    "underlyingSafetyScore": 39,
    "underlyingSafetyGrade": "F",
    "overallBaseScore": 40.6,
    "pharosUrl": "https://pharos.watch/stablecoin/autousd-auto-finance/",
    "peg": {
      "score": 93,
      "grade": "A+",
      "activeDepeg": false,
      "activeDepegBps": null,
      "depegEventCount": 3,
      "lastEventAt": 1678683726,
      "yieldBearing": true
    },
    "dimensions": [
      {
        "key": "pegStability",
        "label": "Peg Stability",
        "score": 93,
        "grade": "A+",
        "detail": "Peg reference (USDC): 93/100. 3 depeg events. worst deviation: -1211 bps (yield-bearing — expected price appreciation excluded)",
        "items": [
          {
            "label": "Peg reference (USDC)",
            "value": "93/100",
            "detail": "Peg reference (USDC): 93/100"
          },
          {
            "label": "Detail",
            "value": "3 depeg events",
            "detail": "3 depeg events"
          },
          {
            "label": "worst deviation",
            "value": "-1211 bps",
            "detail": "worst deviation: -1211 bps"
          },
          {
            "label": "Adjustment",
            "value": "Yield-bearing",
            "detail": "yield-bearing — expected price appreciation excluded"
          }
        ]
      },
      {
        "key": "liquidity",
        "label": "Liquidity",
        "score": 3,
        "grade": "F",
        "detail": "Effective exit score: 3/100. DEX liquidity unavailable. 0 pools across 0 chains. Redemption backstop 70/100. Stablecoin redeem. immediate capacity 0.2% of supply",
        "items": [
          {
            "label": "Effective exit score",
            "value": "3/100",
            "detail": "Effective exit score: 3/100"
          },
          {
            "label": "Detail",
            "value": "DEX liquidity unavailable",
            "detail": "DEX liquidity unavailable"
          },
          {
            "label": "Detail",
            "value": "0 pools across 0 chains",
            "detail": "0 pools across 0 chains"
          },
          {
            "label": "Detail",
            "value": "Redemption backstop 70/100",
            "detail": "Redemption backstop 70/100"
          },
          {
            "label": "Detail",
            "value": "Stablecoin redeem",
            "detail": "Stablecoin redeem"
          },
          {
            "label": "Detail",
            "value": "immediate capacity 0.2% of supply",
            "detail": "immediate capacity 0.2% of supply"
          }
        ]
      },
      {
        "key": "resilience",
        "label": "Resilience",
        "score": 63,
        "grade": "C+",
        "detail": "Collateral: High risk (25). Custody: Fully on-chain (100). Blacklist: Upstream (descriptive only)",
        "items": [
          {
            "label": "Collateral",
            "value": "High risk",
            "detail": "25"
          },
          {
            "label": "Custody",
            "value": "Fully on-chain",
            "detail": "100"
          },
          {
            "label": "Blacklist",
            "value": "Upstream",
            "detail": "descriptive only"
          }
        ]
      },
      {
        "key": "decentralization",
        "label": "Decentralization",
        "score": 35,
        "grade": "F",
        "detail": "Governance: Wrapper (inherits upstream) (35). Wrapped asset: usdc-circle (parent 40 - 5). Bridge route: Single-chain or issuer-native route (100/100) (0)",
        "items": [
          {
            "label": "Governance",
            "value": "Wrapper (inherits upstream)",
            "detail": "35"
          },
          {
            "label": "Wrapped asset",
            "value": "usdc-circle",
            "detail": "parent 40 - 5"
          },
          {
            "label": "Bridge route",
            "value": "Single-chain or issuer-native route (100/100)",
            "detail": "0"
          }
        ]
      },
      {
        "key": "dependencyRisk",
        "label": "Dependency Risk",
        "score": 71,
        "grade": "B",
        "detail": "Upstream: 1 upstream dep (100% weight) (76). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Ceiling: wrapper dependency ceiling (71)",
        "items": [
          {
            "label": "Upstream",
            "value": "1 upstream dep (100% weight) (76)",
            "detail": "Upstream: 1 upstream dep (100% weight) (76)"
          },
          {
            "label": "Declared dependency weight",
            "value": "100%",
            "detail": "Declared dependency weight: 100%"
          },
          {
            "label": "Self-backed",
            "value": "Partially centralized (75)",
            "detail": "Self-backed: Partially centralized (75)"
          },
          {
            "label": "Ceiling",
            "value": "wrapper dependency ceiling (71)",
            "detail": "Ceiling: wrapper dependency ceiling (71)"
          }
        ]
      }
    ],
    "upstreamDependencies": [
      {
        "id": "usdc-circle",
        "name": "USD Coin",
        "symbol": "USDC",
        "weightPct": 100,
        "safetyScore": 76,
        "safetyGrade": "B+",
        "pharosUrl": "https://pharos.watch/stablecoin/usdc-circle/",
        "relationship": "wrapper"
      }
    ],
    "variantKind": "strategy-vault",
    "variantParentId": "usdc-circle",
    "navToken": true,
    "bridgeRoute": {
      "label": "Single-chain or issuer-native route",
      "score": 100
    },
    "freshness": {
      "fallback": false,
      "collateralDrift": false,
      "stale": false
    },
    "summary": "Upstream: 1 upstream dep (100% weight) (76). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Ceiling: wrapper dependency ceiling (71)",
    "sourceUpdatedAt": null,
    "fetchedAt": null
  },
  {
    "pharosStablecoinId": "savusd-avant",
    "symbol": "savUSD",
    "name": "Avant Staked USD",
    "price": 1.1776842604831583,
    "supplyUsd": 92409290,
    "underlyingSafetyScore": 41,
    "underlyingSafetyGrade": "D",
    "overallBaseScore": 40.9,
    "pharosUrl": "https://pharos.watch/stablecoin/savusd-avant/",
    "peg": {
      "score": 99,
      "grade": "A+",
      "activeDepeg": false,
      "activeDepegBps": null,
      "depegEventCount": 5,
      "lastEventAt": 1771988584,
      "yieldBearing": true
    },
    "dimensions": [
      {
        "key": "pegStability",
        "label": "Peg Stability",
        "score": 99,
        "grade": "A+",
        "detail": "Peg reference (avUSD): 99/100. 5 depeg events. worst deviation: -321 bps (yield-bearing — expected price appreciation excluded)",
        "items": [
          {
            "label": "Peg reference (avUSD)",
            "value": "99/100",
            "detail": "Peg reference (avUSD): 99/100"
          },
          {
            "label": "Detail",
            "value": "5 depeg events",
            "detail": "5 depeg events"
          },
          {
            "label": "worst deviation",
            "value": "-321 bps",
            "detail": "worst deviation: -321 bps"
          },
          {
            "label": "Adjustment",
            "value": "Yield-bearing",
            "detail": "yield-bearing — expected price appreciation excluded"
          }
        ]
      },
      {
        "key": "liquidity",
        "label": "Liquidity",
        "score": 70,
        "grade": "B",
        "detail": "Effective exit score: 70/100. DEX liquidity 41/100. 9 pools across 3 chains. Redemption backstop 70/100. Queue redeem. immediate capacity 100.0% of supply",
        "items": [
          {
            "label": "Effective exit score",
            "value": "70/100",
            "detail": "Effective exit score: 70/100"
          },
          {
            "label": "Detail",
            "value": "DEX liquidity 41/100",
            "detail": "DEX liquidity 41/100"
          },
          {
            "label": "Detail",
            "value": "9 pools across 3 chains",
            "detail": "9 pools across 3 chains"
          },
          {
            "label": "Detail",
            "value": "Redemption backstop 70/100",
            "detail": "Redemption backstop 70/100"
          },
          {
            "label": "Detail",
            "value": "Queue redeem",
            "detail": "Queue redeem"
          },
          {
            "label": "Detail",
            "value": "immediate capacity 100.0% of supply",
            "detail": "immediate capacity 100.0% of supply"
          }
        ]
      },
      {
        "key": "resilience",
        "label": "Resilience",
        "score": 28,
        "grade": "F",
        "detail": "Collateral: High risk (25). Custody: Unregulated custodian (30). Blacklist: Upstream (descriptive only)",
        "items": [
          {
            "label": "Collateral",
            "value": "High risk",
            "detail": "25"
          },
          {
            "label": "Custody",
            "value": "Unregulated custodian",
            "detail": "30"
          },
          {
            "label": "Blacklist",
            "value": "Upstream",
            "detail": "descriptive only"
          }
        ]
      },
      {
        "key": "decentralization",
        "label": "Decentralization",
        "score": 15,
        "grade": "F",
        "detail": "Governance: Wrapper (inherits upstream) (15). Wrapped asset: avusd-avant (parent 20 - 5). Bridge route: External lock/mint bridge (40/100) (0)",
        "items": [
          {
            "label": "Governance",
            "value": "Wrapper (inherits upstream)",
            "detail": "15"
          },
          {
            "label": "Wrapped asset",
            "value": "avusd-avant",
            "detail": "parent 20 - 5"
          },
          {
            "label": "Bridge route",
            "value": "External lock/mint bridge (40/100)",
            "detail": "0"
          }
        ]
      },
      {
        "key": "dependencyRisk",
        "label": "Dependency Risk",
        "score": 32,
        "grade": "F",
        "detail": "Upstream: 1 upstream dep (100% weight) (42). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Penalty: 1 weak dep below 75 (-10). Ceiling: wrapper dependency ceiling (37)",
        "items": [
          {
            "label": "Upstream",
            "value": "1 upstream dep (100% weight) (42)",
            "detail": "Upstream: 1 upstream dep (100% weight) (42)"
          },
          {
            "label": "Declared dependency weight",
            "value": "100%",
            "detail": "Declared dependency weight: 100%"
          },
          {
            "label": "Self-backed",
            "value": "Partially centralized (75)",
            "detail": "Self-backed: Partially centralized (75)"
          },
          {
            "label": "Penalty",
            "value": "1 weak dep below 75 (-10)",
            "detail": "Penalty: 1 weak dep below 75 (-10)"
          },
          {
            "label": "Ceiling",
            "value": "wrapper dependency ceiling (37)",
            "detail": "Ceiling: wrapper dependency ceiling (37)"
          }
        ]
      }
    ],
    "upstreamDependencies": [
      {
        "id": "avusd-avant",
        "name": "Avant USD",
        "symbol": "avUSD",
        "weightPct": 100,
        "safetyScore": 42,
        "safetyGrade": "D",
        "pharosUrl": "https://pharos.watch/stablecoin/avusd-avant/",
        "relationship": "wrapper"
      }
    ],
    "variantKind": "strategy-vault",
    "variantParentId": "avusd-avant",
    "navToken": true,
    "bridgeRoute": {
      "label": "External lock/mint bridge",
      "score": 40
    },
    "freshness": {
      "fallback": false,
      "collateralDrift": false,
      "stale": false
    },
    "summary": "Upstream: 1 upstream dep (100% weight) (42). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Penalty: 1 weak dep below 75 (-10). Ceiling: wrapper dependency ceiling (37)",
    "sourceUpdatedAt": null,
    "fetchedAt": null
  },
  {
    "pharosStablecoinId": "apyusd-apyx",
    "symbol": "apyUSD",
    "name": "apyUSD",
    "price": 1.23,
    "supplyUsd": 157721178,
    "underlyingSafetyScore": 34,
    "underlyingSafetyGrade": "F",
    "overallBaseScore": 46.4,
    "pharosUrl": "https://pharos.watch/stablecoin/apyusd-apyx/",
    "peg": {
      "score": 47,
      "grade": "D",
      "activeDepeg": true,
      "activeDepegBps": 1804,
      "depegEventCount": 2,
      "lastEventAt": 1780437028,
      "yieldBearing": true
    },
    "dimensions": [
      {
        "key": "pegStability",
        "label": "Peg Stability",
        "score": 47,
        "grade": "D",
        "detail": "Peg reference (apxUSD): 47/100. active depeg. 2 depeg events. worst deviation: -1804 bps (yield-bearing — expected price appreciation excluded)",
        "items": [
          {
            "label": "Peg reference (apxUSD)",
            "value": "47/100",
            "detail": "Peg reference (apxUSD): 47/100"
          },
          {
            "label": "Detail",
            "value": "active depeg",
            "detail": "active depeg"
          },
          {
            "label": "Detail",
            "value": "2 depeg events",
            "detail": "2 depeg events"
          },
          {
            "label": "worst deviation",
            "value": "-1804 bps",
            "detail": "worst deviation: -1804 bps"
          },
          {
            "label": "Adjustment",
            "value": "Yield-bearing",
            "detail": "yield-bearing — expected price appreciation excluded"
          }
        ]
      },
      {
        "key": "liquidity",
        "label": "Liquidity",
        "score": 75,
        "grade": "B+",
        "detail": "Effective exit score: 75/100. DEX liquidity 75/100. 20 pools across 2 chains. high concentration (HHI: 0.70). Redemption backstop 65/100. Queue redeem. immediate capacity 100.0% of supply",
        "items": [
          {
            "label": "Effective exit score",
            "value": "75/100",
            "detail": "Effective exit score: 75/100"
          },
          {
            "label": "Detail",
            "value": "DEX liquidity 75/100",
            "detail": "DEX liquidity 75/100"
          },
          {
            "label": "Detail",
            "value": "20 pools across 2 chains",
            "detail": "20 pools across 2 chains"
          },
          {
            "label": "high concentration (HHI",
            "value": "0.70)",
            "detail": "high concentration (HHI: 0.70)"
          },
          {
            "label": "Detail",
            "value": "Redemption backstop 65/100",
            "detail": "Redemption backstop 65/100"
          },
          {
            "label": "Detail",
            "value": "Queue redeem",
            "detail": "Queue redeem"
          },
          {
            "label": "Detail",
            "value": "immediate capacity 100.0% of supply",
            "detail": "immediate capacity 100.0% of supply"
          }
        ]
      },
      {
        "key": "resilience",
        "label": "Resilience",
        "score": 40,
        "grade": "D",
        "detail": "Collateral: High risk (25). Custody: Regulated custodian (55). Blacklist: Yes (descriptive only)",
        "items": [
          {
            "label": "Collateral",
            "value": "High risk",
            "detail": "25"
          },
          {
            "label": "Custody",
            "value": "Regulated custodian",
            "detail": "55"
          },
          {
            "label": "Blacklist",
            "value": "Yes",
            "detail": "descriptive only"
          }
        ]
      },
      {
        "key": "decentralization",
        "label": "Decentralization",
        "score": 15,
        "grade": "F",
        "detail": "Governance: Wrapper (inherits upstream) (15). Wrapped asset: apxusd-apyx (parent 20 - 5). Bridge route: Single-chain or issuer-native route (100/100) (0)",
        "items": [
          {
            "label": "Governance",
            "value": "Wrapper (inherits upstream)",
            "detail": "15"
          },
          {
            "label": "Wrapped asset",
            "value": "apxusd-apyx",
            "detail": "parent 20 - 5"
          },
          {
            "label": "Bridge route",
            "value": "Single-chain or issuer-native route (100/100)",
            "detail": "0"
          }
        ]
      },
      {
        "key": "dependencyRisk",
        "label": "Dependency Risk",
        "score": 36,
        "grade": "F",
        "detail": "Upstream: 1 upstream dep (100% weight) (46). Declared dependency weight: 100%. Self-backed: Centralized (95). Penalty: 1 weak dep below 75 (-10). Ceiling: wrapper dependency ceiling (41)",
        "items": [
          {
            "label": "Upstream",
            "value": "1 upstream dep (100% weight) (46)",
            "detail": "Upstream: 1 upstream dep (100% weight) (46)"
          },
          {
            "label": "Declared dependency weight",
            "value": "100%",
            "detail": "Declared dependency weight: 100%"
          },
          {
            "label": "Self-backed",
            "value": "Centralized (95)",
            "detail": "Self-backed: Centralized (95)"
          },
          {
            "label": "Penalty",
            "value": "1 weak dep below 75 (-10)",
            "detail": "Penalty: 1 weak dep below 75 (-10)"
          },
          {
            "label": "Ceiling",
            "value": "wrapper dependency ceiling (41)",
            "detail": "Ceiling: wrapper dependency ceiling (41)"
          }
        ]
      }
    ],
    "upstreamDependencies": [
      {
        "id": "apxusd-apyx",
        "name": "apxUSD",
        "symbol": "apxUSD",
        "weightPct": 100,
        "safetyScore": 46,
        "safetyGrade": "D",
        "pharosUrl": "https://pharos.watch/stablecoin/apxusd-apyx/",
        "relationship": "wrapper"
      }
    ],
    "variantKind": "strategy-vault",
    "variantParentId": "apxusd-apyx",
    "navToken": true,
    "bridgeRoute": {
      "label": "Single-chain or issuer-native route",
      "score": 100
    },
    "freshness": {
      "fallback": false,
      "collateralDrift": false,
      "stale": false
    },
    "summary": "Upstream: 1 upstream dep (100% weight) (46). Declared dependency weight: 100%. Self-backed: Centralized (95). Penalty: 1 weak dep below 75 (-10). Ceiling: wrapper dependency ceiling (41)",
    "sourceUpdatedAt": null,
    "fetchedAt": null
  },
  {
    "pharosStablecoinId": "syrupusdc-maple",
    "symbol": "syrupUSDC",
    "name": "Maple syrupUSDC",
    "price": 1.1694589347883357,
    "supplyUsd": 1298453738,
    "underlyingSafetyScore": 59,
    "underlyingSafetyGrade": "C",
    "overallBaseScore": 61.2,
    "pharosUrl": "https://pharos.watch/stablecoin/syrupusdc-maple/",
    "peg": {
      "score": 93,
      "grade": "A+",
      "activeDepeg": false,
      "activeDepegBps": null,
      "depegEventCount": 3,
      "lastEventAt": 1678683726,
      "yieldBearing": true
    },
    "dimensions": [
      {
        "key": "pegStability",
        "label": "Peg Stability",
        "score": 93,
        "grade": "A+",
        "detail": "Peg reference (USDC): 93/100. 3 depeg events. worst deviation: -1211 bps (yield-bearing — expected price appreciation excluded)",
        "items": [
          {
            "label": "Peg reference (USDC)",
            "value": "93/100",
            "detail": "Peg reference (USDC): 93/100"
          },
          {
            "label": "Detail",
            "value": "3 depeg events",
            "detail": "3 depeg events"
          },
          {
            "label": "worst deviation",
            "value": "-1211 bps",
            "detail": "worst deviation: -1211 bps"
          },
          {
            "label": "Adjustment",
            "value": "Yield-bearing",
            "detail": "yield-bearing — expected price appreciation excluded"
          }
        ]
      },
      {
        "key": "liquidity",
        "label": "Liquidity",
        "score": 59,
        "grade": "C",
        "detail": "Effective exit score: 59/100. DEX liquidity 59/100. 16 pools across 4 chains. Redemption backstop 62/100. Queue redeem. immediate capacity 1.7% of supply",
        "items": [
          {
            "label": "Effective exit score",
            "value": "59/100",
            "detail": "Effective exit score: 59/100"
          },
          {
            "label": "Detail",
            "value": "DEX liquidity 59/100",
            "detail": "DEX liquidity 59/100"
          },
          {
            "label": "Detail",
            "value": "16 pools across 4 chains",
            "detail": "16 pools across 4 chains"
          },
          {
            "label": "Detail",
            "value": "Redemption backstop 62/100",
            "detail": "Redemption backstop 62/100"
          },
          {
            "label": "Detail",
            "value": "Queue redeem",
            "detail": "Queue redeem"
          },
          {
            "label": "Detail",
            "value": "immediate capacity 1.7% of supply",
            "detail": "immediate capacity 1.7% of supply"
          }
        ]
      },
      {
        "key": "resilience",
        "label": "Resilience",
        "score": 75,
        "grade": "B+",
        "detail": "Collateral: Medium risk (50). Custody: Fully on-chain (100). Blacklist: Yes (descriptive only)",
        "items": [
          {
            "label": "Collateral",
            "value": "Medium risk",
            "detail": "50"
          },
          {
            "label": "Custody",
            "value": "Fully on-chain",
            "detail": "100"
          },
          {
            "label": "Blacklist",
            "value": "Yes",
            "detail": "descriptive only"
          }
        ]
      },
      {
        "key": "decentralization",
        "label": "Decentralization",
        "score": 31,
        "grade": "F",
        "detail": "Governance: Wrapper (inherits upstream) (35). Wrapped asset: usdc-circle (parent 40 - 5). Bridge route: Opaque or unknown bridge route (20/100) (-3). Mint authority: 29/100 (Exposed) (-1)",
        "items": [
          {
            "label": "Governance",
            "value": "Wrapper (inherits upstream)",
            "detail": "35"
          },
          {
            "label": "Wrapped asset",
            "value": "usdc-circle",
            "detail": "parent 40 - 5"
          },
          {
            "label": "Bridge route",
            "value": "Opaque or unknown bridge route (20/100)",
            "detail": "-3"
          },
          {
            "label": "Mint authority",
            "value": "29/100 (Exposed)",
            "detail": "-1"
          }
        ]
      },
      {
        "key": "dependencyRisk",
        "label": "Dependency Risk",
        "score": 71,
        "grade": "B",
        "detail": "Upstream: 1 upstream dep (100% weight) (76). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Ceiling: wrapper dependency ceiling (71)",
        "items": [
          {
            "label": "Upstream",
            "value": "1 upstream dep (100% weight) (76)",
            "detail": "Upstream: 1 upstream dep (100% weight) (76)"
          },
          {
            "label": "Declared dependency weight",
            "value": "100%",
            "detail": "Declared dependency weight: 100%"
          },
          {
            "label": "Self-backed",
            "value": "Partially centralized (75)",
            "detail": "Self-backed: Partially centralized (75)"
          },
          {
            "label": "Ceiling",
            "value": "wrapper dependency ceiling (71)",
            "detail": "Ceiling: wrapper dependency ceiling (71)"
          }
        ]
      }
    ],
    "upstreamDependencies": [
      {
        "id": "usdc-circle",
        "name": "USD Coin",
        "symbol": "USDC",
        "weightPct": 100,
        "safetyScore": 76,
        "safetyGrade": "B+",
        "pharosUrl": "https://pharos.watch/stablecoin/usdc-circle/",
        "relationship": "wrapper"
      }
    ],
    "variantKind": "strategy-vault",
    "variantParentId": "usdc-circle",
    "navToken": true,
    "bridgeRoute": {
      "label": "Opaque or unknown bridge route",
      "score": 20
    },
    "freshness": {
      "fallback": false,
      "collateralDrift": false,
      "stale": false
    },
    "summary": "Upstream: 1 upstream dep (100% weight) (76). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Ceiling: wrapper dependency ceiling (71)",
    "sourceUpdatedAt": null,
    "fetchedAt": null
  },
  {
    "pharosStablecoinId": "aa-falconx-mev-capital",
    "symbol": "AA_FalconXUSDC",
    "name": "Pareto FalconX Credit Vault",
    "price": 1.087882638415284,
    "supplyUsd": 131173843,
    "underlyingSafetyScore": 52,
    "underlyingSafetyGrade": "C-",
    "overallBaseScore": 59.3,
    "pharosUrl": "https://pharos.watch/stablecoin/aa-falconx-mev-capital/",
    "peg": {
      "score": 93,
      "grade": "A+",
      "activeDepeg": false,
      "activeDepegBps": null,
      "depegEventCount": 3,
      "lastEventAt": 1678683726,
      "yieldBearing": true
    },
    "dimensions": [
      {
        "key": "pegStability",
        "label": "Peg Stability",
        "score": 93,
        "grade": "A+",
        "detail": "Peg reference (USDC): 93/100. 3 depeg events. worst deviation: -1211 bps (yield-bearing — expected price appreciation excluded)",
        "items": [
          {
            "label": "Peg reference (USDC)",
            "value": "93/100",
            "detail": "Peg reference (USDC): 93/100"
          },
          {
            "label": "Detail",
            "value": "3 depeg events",
            "detail": "3 depeg events"
          },
          {
            "label": "worst deviation",
            "value": "-1211 bps",
            "detail": "worst deviation: -1211 bps"
          },
          {
            "label": "Adjustment",
            "value": "Yield-bearing",
            "detail": "yield-bearing — expected price appreciation excluded"
          }
        ]
      },
      {
        "key": "liquidity",
        "label": "Liquidity",
        "score": null,
        "grade": "NR",
        "detail": "DEX liquidity unavailable. Redemption route is configured but not used for Safety Score liquidity (eventual-only route)",
        "items": [
          {
            "label": "Liquidity",
            "value": "DEX liquidity unavailable. Redemption route is configured but not used for Safety Score liquidity (eventual-only route)",
            "detail": null
          }
        ]
      },
      {
        "key": "resilience",
        "label": "Resilience",
        "score": 63,
        "grade": "C+",
        "detail": "Collateral: High risk (25). Custody: Fully on-chain (100). Blacklist: Upstream (descriptive only)",
        "items": [
          {
            "label": "Collateral",
            "value": "High risk",
            "detail": "25"
          },
          {
            "label": "Custody",
            "value": "Fully on-chain",
            "detail": "100"
          },
          {
            "label": "Blacklist",
            "value": "Upstream",
            "detail": "descriptive only"
          }
        ]
      },
      {
        "key": "decentralization",
        "label": "Decentralization",
        "score": 35,
        "grade": "F",
        "detail": "Governance: Wrapper (inherits upstream) (35). Wrapped asset: usdc-circle (parent 40 - 5)",
        "items": [
          {
            "label": "Governance",
            "value": "Wrapper (inherits upstream)",
            "detail": "35"
          },
          {
            "label": "Wrapped asset",
            "value": "usdc-circle",
            "detail": "parent 40 - 5"
          }
        ]
      },
      {
        "key": "dependencyRisk",
        "label": "Dependency Risk",
        "score": 71,
        "grade": "B",
        "detail": "Upstream: 1 upstream dep (100% weight) (76). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Ceiling: wrapper dependency ceiling (71)",
        "items": [
          {
            "label": "Upstream",
            "value": "1 upstream dep (100% weight) (76)",
            "detail": "Upstream: 1 upstream dep (100% weight) (76)"
          },
          {
            "label": "Declared dependency weight",
            "value": "100%",
            "detail": "Declared dependency weight: 100%"
          },
          {
            "label": "Self-backed",
            "value": "Partially centralized (75)",
            "detail": "Self-backed: Partially centralized (75)"
          },
          {
            "label": "Ceiling",
            "value": "wrapper dependency ceiling (71)",
            "detail": "Ceiling: wrapper dependency ceiling (71)"
          }
        ]
      }
    ],
    "upstreamDependencies": [
      {
        "id": "usdc-circle",
        "name": "USD Coin",
        "symbol": "USDC",
        "weightPct": 100,
        "safetyScore": 76,
        "safetyGrade": "B+",
        "pharosUrl": "https://pharos.watch/stablecoin/usdc-circle/",
        "relationship": "wrapper"
      }
    ],
    "variantKind": "strategy-vault",
    "variantParentId": "usdc-circle",
    "navToken": true,
    "bridgeRoute": null,
    "freshness": {
      "fallback": false,
      "collateralDrift": false,
      "stale": false
    },
    "summary": "Upstream: 1 upstream dep (100% weight) (76). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Ceiling: wrapper dependency ceiling (71)",
    "sourceUpdatedAt": null,
    "fetchedAt": null
  },
  {
    "pharosStablecoinId": "nusd-neutrl",
    "symbol": "NUSD",
    "name": "Neutrl USD",
    "price": 0.9992551289963697,
    "supplyUsd": 92403480,
    "underlyingSafetyScore": 64,
    "underlyingSafetyGrade": "C+",
    "overallBaseScore": 64.5,
    "pharosUrl": "https://pharos.watch/stablecoin/nusd-neutrl/",
    "peg": {
      "score": 99,
      "grade": "A+",
      "activeDepeg": false,
      "activeDepegBps": null,
      "depegEventCount": 5,
      "lastEventAt": 1781517830,
      "yieldBearing": true
    },
    "dimensions": [
      {
        "key": "pegStability",
        "label": "Peg Stability",
        "score": 99,
        "grade": "A+",
        "detail": "Peg score: 99/100. 5 depeg events. worst deviation: -197 bps (yield-bearing — expected price appreciation excluded)",
        "items": [
          {
            "label": "Peg score",
            "value": "99/100",
            "detail": "Peg score: 99/100"
          },
          {
            "label": "Detail",
            "value": "5 depeg events",
            "detail": "5 depeg events"
          },
          {
            "label": "worst deviation",
            "value": "-197 bps",
            "detail": "worst deviation: -197 bps"
          },
          {
            "label": "Adjustment",
            "value": "Yield-bearing",
            "detail": "yield-bearing — expected price appreciation excluded"
          }
        ]
      },
      {
        "key": "liquidity",
        "label": "Liquidity",
        "score": 67,
        "grade": "B-",
        "detail": "Effective exit score: 67/100. DEX liquidity 67/100. 1 pool across 1 chain. high concentration (HHI: 1.00). Redemption backstop 70/100. Queue redeem. not used for Safety Score uplift (eventual-only route). eventual redeemability modeled; immediate buffer not separately quantified",
        "items": [
          {
            "label": "Effective exit score",
            "value": "67/100",
            "detail": "Effective exit score: 67/100"
          },
          {
            "label": "Detail",
            "value": "DEX liquidity 67/100",
            "detail": "DEX liquidity 67/100"
          },
          {
            "label": "Detail",
            "value": "1 pool across 1 chain",
            "detail": "1 pool across 1 chain"
          },
          {
            "label": "high concentration (HHI",
            "value": "1.00)",
            "detail": "high concentration (HHI: 1.00)"
          },
          {
            "label": "Detail",
            "value": "Redemption backstop 70/100",
            "detail": "Redemption backstop 70/100"
          },
          {
            "label": "Detail",
            "value": "Queue redeem",
            "detail": "Queue redeem"
          },
          {
            "label": "Detail",
            "value": "not used for Safety Score uplift (eventual-only route)",
            "detail": "not used for Safety Score uplift (eventual-only route)"
          },
          {
            "label": "Detail",
            "value": "eventual redeemability modeled; immediate buffer not separately quantified",
            "detail": "eventual redeemability modeled; immediate buffer not separately quantified"
          }
        ]
      },
      {
        "key": "resilience",
        "label": "Resilience",
        "score": 60,
        "grade": "C+",
        "detail": "Collateral: Low risk (65). Custody: Regulated custodian (55). Blacklist: Yes (descriptive only)",
        "items": [
          {
            "label": "Collateral",
            "value": "Low risk",
            "detail": "65"
          },
          {
            "label": "Custody",
            "value": "Regulated custodian",
            "detail": "55"
          },
          {
            "label": "Blacklist",
            "value": "Yes",
            "detail": "descriptive only"
          }
        ]
      },
      {
        "key": "decentralization",
        "label": "Decentralization",
        "score": 48,
        "grade": "D",
        "detail": "Governance: Multisig governance (55). Mint authority: 35/100 (Concentrated) (-7)",
        "items": [
          {
            "label": "Governance",
            "value": "Multisig governance",
            "detail": "55"
          },
          {
            "label": "Mint authority",
            "value": "35/100 (Concentrated)",
            "detail": "-7"
          }
        ]
      },
      {
        "key": "dependencyRisk",
        "label": "Dependency Risk",
        "score": 75,
        "grade": "B+",
        "detail": "Self-backed: Partially centralized (75)",
        "items": [
          {
            "label": "Self-backed",
            "value": "Partially centralized",
            "detail": "75"
          }
        ]
      }
    ],
    "upstreamDependencies": [],
    "variantKind": null,
    "variantParentId": null,
    "navToken": false,
    "bridgeRoute": null,
    "freshness": {
      "fallback": false,
      "collateralDrift": false,
      "stale": false
    },
    "summary": "Self-backed: Partially centralized (75)",
    "sourceUpdatedAt": null,
    "fetchedAt": null
  },
  {
    "pharosStablecoinId": "stcusd-cap",
    "symbol": "stcUSD",
    "name": "Staked Cap USD",
    "price": 1.066196353920862,
    "supplyUsd": 70899778,
    "underlyingSafetyScore": 52,
    "underlyingSafetyGrade": "C-",
    "overallBaseScore": 51.7,
    "pharosUrl": "https://pharos.watch/stablecoin/stcusd-cap/",
    "peg": {
      "score": 100,
      "grade": "A+",
      "activeDepeg": false,
      "activeDepegBps": null,
      "depegEventCount": 0,
      "lastEventAt": null,
      "yieldBearing": true
    },
    "dimensions": [
      {
        "key": "pegStability",
        "label": "Peg Stability",
        "score": 100,
        "grade": "A+",
        "detail": "Peg reference (CUSD): 100/100. No depeg events recorded (yield-bearing — expected price appreciation excluded)",
        "items": [
          {
            "label": "Peg reference (CUSD)",
            "value": "100/100",
            "detail": "Peg reference (CUSD): 100/100"
          },
          {
            "label": "Detail",
            "value": "No depeg events recorded",
            "detail": "No depeg events recorded"
          },
          {
            "label": "Adjustment",
            "value": "Yield-bearing",
            "detail": "yield-bearing — expected price appreciation excluded"
          }
        ]
      },
      {
        "key": "liquidity",
        "label": "Liquidity",
        "score": 65,
        "grade": "B-",
        "detail": "Effective exit score: 65/100. DEX liquidity 15/100. 4 pools across 1 chain. Redemption backstop 86/100. Stablecoin redeem. immediate capacity 100.0% of supply",
        "items": [
          {
            "label": "Effective exit score",
            "value": "65/100",
            "detail": "Effective exit score: 65/100"
          },
          {
            "label": "Detail",
            "value": "DEX liquidity 15/100",
            "detail": "DEX liquidity 15/100"
          },
          {
            "label": "Detail",
            "value": "4 pools across 1 chain",
            "detail": "4 pools across 1 chain"
          },
          {
            "label": "Detail",
            "value": "Redemption backstop 86/100",
            "detail": "Redemption backstop 86/100"
          },
          {
            "label": "Detail",
            "value": "Stablecoin redeem",
            "detail": "Stablecoin redeem"
          },
          {
            "label": "Detail",
            "value": "immediate capacity 100.0% of supply",
            "detail": "immediate capacity 100.0% of supply"
          }
        ]
      },
      {
        "key": "resilience",
        "label": "Resilience",
        "score": 40,
        "grade": "D",
        "detail": "Collateral: High risk (25). Custody: Regulated custodian (55). Blacklist: Upstream (descriptive only)",
        "items": [
          {
            "label": "Collateral",
            "value": "High risk",
            "detail": "25"
          },
          {
            "label": "Custody",
            "value": "Regulated custodian",
            "detail": "55"
          },
          {
            "label": "Blacklist",
            "value": "Upstream",
            "detail": "descriptive only"
          }
        ]
      },
      {
        "key": "decentralization",
        "label": "Decentralization",
        "score": 40,
        "grade": "D",
        "detail": "Governance: Wrapper (inherits upstream) (40). Wrapped asset: cusd-cap (parent 45 - 5)",
        "items": [
          {
            "label": "Governance",
            "value": "Wrapper (inherits upstream)",
            "detail": "40"
          },
          {
            "label": "Wrapped asset",
            "value": "cusd-cap",
            "detail": "parent 45 - 5"
          }
        ]
      },
      {
        "key": "dependencyRisk",
        "label": "Dependency Risk",
        "score": 52,
        "grade": "C-",
        "detail": "Upstream: 1 upstream dep (100% weight) (62). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Penalty: 1 weak dep below 75 (-10). Ceiling: wrapper dependency ceiling (57)",
        "items": [
          {
            "label": "Upstream",
            "value": "1 upstream dep (100% weight) (62)",
            "detail": "Upstream: 1 upstream dep (100% weight) (62)"
          },
          {
            "label": "Declared dependency weight",
            "value": "100%",
            "detail": "Declared dependency weight: 100%"
          },
          {
            "label": "Self-backed",
            "value": "Partially centralized (75)",
            "detail": "Self-backed: Partially centralized (75)"
          },
          {
            "label": "Penalty",
            "value": "1 weak dep below 75 (-10)",
            "detail": "Penalty: 1 weak dep below 75 (-10)"
          },
          {
            "label": "Ceiling",
            "value": "wrapper dependency ceiling (57)",
            "detail": "Ceiling: wrapper dependency ceiling (57)"
          }
        ]
      }
    ],
    "upstreamDependencies": [
      {
        "id": "cusd-cap",
        "name": "Cap cUSD",
        "symbol": "CUSD",
        "weightPct": 100,
        "safetyScore": 62,
        "safetyGrade": "C+",
        "pharosUrl": "https://pharos.watch/stablecoin/cusd-cap/",
        "relationship": "wrapper"
      }
    ],
    "variantKind": "strategy-vault",
    "variantParentId": "cusd-cap",
    "navToken": true,
    "bridgeRoute": null,
    "freshness": {
      "fallback": false,
      "collateralDrift": false,
      "stale": false
    },
    "summary": "Upstream: 1 upstream dep (100% weight) (62). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Penalty: 1 weak dep below 75 (-10). Ceiling: wrapper dependency ceiling (57)",
    "sourceUpdatedAt": null,
    "fetchedAt": null
  },
  {
    "pharosStablecoinId": "eearn-ember",
    "symbol": "eEARN",
    "name": "Ember Earn",
    "price": 1.020946813726626,
    "supplyUsd": 4818864,
    "underlyingSafetyScore": 53,
    "underlyingSafetyGrade": "C-",
    "overallBaseScore": 54.6,
    "pharosUrl": "https://pharos.watch/stablecoin/eearn-ember/",
    "peg": {
      "score": 93,
      "grade": "A+",
      "activeDepeg": false,
      "activeDepegBps": null,
      "depegEventCount": 3,
      "lastEventAt": 1678683726,
      "yieldBearing": true
    },
    "dimensions": [
      {
        "key": "pegStability",
        "label": "Peg Stability",
        "score": 93,
        "grade": "A+",
        "detail": "Peg reference (USDC): 93/100. 3 depeg events. worst deviation: -1211 bps (yield-bearing — expected price appreciation excluded)",
        "items": [
          {
            "label": "Peg reference (USDC)",
            "value": "93/100",
            "detail": "Peg reference (USDC): 93/100"
          },
          {
            "label": "Detail",
            "value": "3 depeg events",
            "detail": "3 depeg events"
          },
          {
            "label": "worst deviation",
            "value": "-1211 bps",
            "detail": "worst deviation: -1211 bps"
          },
          {
            "label": "Adjustment",
            "value": "Yield-bearing",
            "detail": "yield-bearing — expected price appreciation excluded"
          }
        ]
      },
      {
        "key": "liquidity",
        "label": "Liquidity",
        "score": 45,
        "grade": "D",
        "detail": "Effective exit score: 45/100. DEX liquidity 45/100. 1 pool across 1 chain. high concentration (HHI: 1.00). Redemption backstop 69/100. Stablecoin redeem. immediate capacity 0.0% of supply",
        "items": [
          {
            "label": "Effective exit score",
            "value": "45/100",
            "detail": "Effective exit score: 45/100"
          },
          {
            "label": "Detail",
            "value": "DEX liquidity 45/100",
            "detail": "DEX liquidity 45/100"
          },
          {
            "label": "Detail",
            "value": "1 pool across 1 chain",
            "detail": "1 pool across 1 chain"
          },
          {
            "label": "high concentration (HHI",
            "value": "1.00)",
            "detail": "high concentration (HHI: 1.00)"
          },
          {
            "label": "Detail",
            "value": "Redemption backstop 69/100",
            "detail": "Redemption backstop 69/100"
          },
          {
            "label": "Detail",
            "value": "Stablecoin redeem",
            "detail": "Stablecoin redeem"
          },
          {
            "label": "Detail",
            "value": "immediate capacity 0.0% of supply",
            "detail": "immediate capacity 0.0% of supply"
          }
        ]
      },
      {
        "key": "resilience",
        "label": "Resilience",
        "score": 63,
        "grade": "C+",
        "detail": "Collateral: High risk (25). Custody: Fully on-chain (100). Blacklist: Upstream (descriptive only)",
        "items": [
          {
            "label": "Collateral",
            "value": "High risk",
            "detail": "25"
          },
          {
            "label": "Custody",
            "value": "Fully on-chain",
            "detail": "100"
          },
          {
            "label": "Blacklist",
            "value": "Upstream",
            "detail": "descriptive only"
          }
        ]
      },
      {
        "key": "decentralization",
        "label": "Decentralization",
        "score": 35,
        "grade": "F",
        "detail": "Governance: Wrapper (inherits upstream) (35). Wrapped asset: usdc-circle (parent 40 - 5). Bridge route: Single-chain or issuer-native route (100/100) (0)",
        "items": [
          {
            "label": "Governance",
            "value": "Wrapper (inherits upstream)",
            "detail": "35"
          },
          {
            "label": "Wrapped asset",
            "value": "usdc-circle",
            "detail": "parent 40 - 5"
          },
          {
            "label": "Bridge route",
            "value": "Single-chain or issuer-native route (100/100)",
            "detail": "0"
          }
        ]
      },
      {
        "key": "dependencyRisk",
        "label": "Dependency Risk",
        "score": 71,
        "grade": "B",
        "detail": "Upstream: 1 upstream dep (100% weight) (76). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Ceiling: wrapper dependency ceiling (71)",
        "items": [
          {
            "label": "Upstream",
            "value": "1 upstream dep (100% weight) (76)",
            "detail": "Upstream: 1 upstream dep (100% weight) (76)"
          },
          {
            "label": "Declared dependency weight",
            "value": "100%",
            "detail": "Declared dependency weight: 100%"
          },
          {
            "label": "Self-backed",
            "value": "Partially centralized (75)",
            "detail": "Self-backed: Partially centralized (75)"
          },
          {
            "label": "Ceiling",
            "value": "wrapper dependency ceiling (71)",
            "detail": "Ceiling: wrapper dependency ceiling (71)"
          }
        ]
      }
    ],
    "upstreamDependencies": [
      {
        "id": "usdc-circle",
        "name": "USD Coin",
        "symbol": "USDC",
        "weightPct": 100,
        "safetyScore": 76,
        "safetyGrade": "B+",
        "pharosUrl": "https://pharos.watch/stablecoin/usdc-circle/",
        "relationship": "wrapper"
      }
    ],
    "variantKind": "strategy-vault",
    "variantParentId": "usdc-circle",
    "navToken": true,
    "bridgeRoute": {
      "label": "Single-chain or issuer-native route",
      "score": 100
    },
    "freshness": {
      "fallback": false,
      "collateralDrift": false,
      "stale": false
    },
    "summary": "Upstream: 1 upstream dep (100% weight) (76). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Ceiling: wrapper dependency ceiling (71)",
    "sourceUpdatedAt": null,
    "fetchedAt": null
  },
  {
    "pharosStablecoinId": "susdai-usd-ai",
    "symbol": "sUSDai",
    "name": "Staked USDai",
    "price": 1.0910493232280571,
    "supplyUsd": 292924724,
    "underlyingSafetyScore": 58,
    "underlyingSafetyGrade": "C",
    "overallBaseScore": 57.9,
    "pharosUrl": "https://pharos.watch/stablecoin/susdai-usd-ai/",
    "peg": {
      "score": 100,
      "grade": "A+",
      "activeDepeg": false,
      "activeDepegBps": null,
      "depegEventCount": 0,
      "lastEventAt": null,
      "yieldBearing": true
    },
    "dimensions": [
      {
        "key": "pegStability",
        "label": "Peg Stability",
        "score": 100,
        "grade": "A+",
        "detail": "Peg reference (USDai): 100/100. No depeg events recorded (yield-bearing — expected price appreciation excluded)",
        "items": [
          {
            "label": "Peg reference (USDai)",
            "value": "100/100",
            "detail": "Peg reference (USDai): 100/100"
          },
          {
            "label": "Detail",
            "value": "No depeg events recorded",
            "detail": "No depeg events recorded"
          },
          {
            "label": "Adjustment",
            "value": "Yield-bearing",
            "detail": "yield-bearing — expected price appreciation excluded"
          }
        ]
      },
      {
        "key": "liquidity",
        "label": "Liquidity",
        "score": 74,
        "grade": "B",
        "detail": "Effective exit score: 74/100. DEX liquidity 74/100. 11 pools across 3 chains. Redemption backstop 70/100. Queue redeem. not used for Safety Score uplift (eventual-only route). eventual redeemability modeled; immediate buffer not separately quantified",
        "items": [
          {
            "label": "Effective exit score",
            "value": "74/100",
            "detail": "Effective exit score: 74/100"
          },
          {
            "label": "Detail",
            "value": "DEX liquidity 74/100",
            "detail": "DEX liquidity 74/100"
          },
          {
            "label": "Detail",
            "value": "11 pools across 3 chains",
            "detail": "11 pools across 3 chains"
          },
          {
            "label": "Detail",
            "value": "Redemption backstop 70/100",
            "detail": "Redemption backstop 70/100"
          },
          {
            "label": "Detail",
            "value": "Queue redeem",
            "detail": "Queue redeem"
          },
          {
            "label": "Detail",
            "value": "not used for Safety Score uplift (eventual-only route)",
            "detail": "not used for Safety Score uplift (eventual-only route)"
          },
          {
            "label": "Detail",
            "value": "eventual redeemability modeled; immediate buffer not separately quantified",
            "detail": "eventual redeemability modeled; immediate buffer not separately quantified"
          }
        ]
      },
      {
        "key": "resilience",
        "label": "Resilience",
        "score": 48,
        "grade": "D",
        "detail": "Collateral: Low risk (66). Custody: Unregulated custodian (30). Blacklist: Upstream (descriptive only)",
        "items": [
          {
            "label": "Collateral",
            "value": "Low risk",
            "detail": "66"
          },
          {
            "label": "Custody",
            "value": "Unregulated custodian",
            "detail": "30"
          },
          {
            "label": "Blacklist",
            "value": "Upstream",
            "detail": "descriptive only"
          }
        ]
      },
      {
        "key": "decentralization",
        "label": "Decentralization",
        "score": 44,
        "grade": "D",
        "detail": "Governance: Multisig governance (55). Chain: Ethereum mainnet (third-party bridge) (-10). Bridge route: External lock/mint bridge (40/100) (-1)",
        "items": [
          {
            "label": "Governance",
            "value": "Multisig governance",
            "detail": "55"
          },
          {
            "label": "Chain",
            "value": "Ethereum mainnet (third-party bridge)",
            "detail": "-10"
          },
          {
            "label": "Bridge route",
            "value": "External lock/mint bridge (40/100)",
            "detail": "-1"
          }
        ]
      },
      {
        "key": "dependencyRisk",
        "label": "Dependency Risk",
        "score": 55,
        "grade": "C",
        "detail": "Upstream: 2 upstream deps (100% weight) (69). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Penalty: 1 weak dep below 75 (-10). Ceiling: wrapper dependency ceiling (55)",
        "items": [
          {
            "label": "Upstream",
            "value": "2 upstream deps (100% weight) (69)",
            "detail": "Upstream: 2 upstream deps (100% weight) (69)"
          },
          {
            "label": "Declared dependency weight",
            "value": "100%",
            "detail": "Declared dependency weight: 100%"
          },
          {
            "label": "Self-backed",
            "value": "Partially centralized (75)",
            "detail": "Self-backed: Partially centralized (75)"
          },
          {
            "label": "Penalty",
            "value": "1 weak dep below 75 (-10)",
            "detail": "Penalty: 1 weak dep below 75 (-10)"
          },
          {
            "label": "Ceiling",
            "value": "wrapper dependency ceiling (55)",
            "detail": "Ceiling: wrapper dependency ceiling (55)"
          }
        ]
      }
    ],
    "upstreamDependencies": [
      {
        "id": "pyusd-paypal",
        "name": "PayPal USD",
        "symbol": "PYUSD",
        "weightPct": 82.3,
        "safetyScore": 79,
        "safetyGrade": "B+",
        "pharosUrl": "https://pharos.watch/stablecoin/pyusd-paypal/",
        "relationship": "collateral"
      },
      {
        "id": "usdai-usd-ai",
        "name": "USD.AI",
        "symbol": "USDai",
        "weightPct": 100,
        "safetyScore": 60,
        "safetyGrade": "C+",
        "pharosUrl": "https://pharos.watch/stablecoin/usdai-usd-ai/",
        "relationship": "wrapper"
      }
    ],
    "variantKind": "strategy-vault",
    "variantParentId": "usdai-usd-ai",
    "navToken": true,
    "bridgeRoute": {
      "label": "External lock/mint bridge",
      "score": 40
    },
    "freshness": {
      "fallback": true,
      "collateralDrift": false,
      "stale": false
    },
    "summary": "Upstream: 2 upstream deps (100% weight) (69). Declared dependency weight: 100%. Self-backed: Partially centralized (75). Penalty: 1 weak dep below 75 (-10). Ceiling: wrapper dependency ceiling (55)",
    "sourceUpdatedAt": null,
    "fetchedAt": null
  }
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
  market("1", "ethereum", "0x36c1d7cafa9a220fc1450fa070277aed69f8c9b2", "Ember eEarn", "normal", 1_018_422, 0.10973, 0.1, 0.91133, 0.9, 0, 0, "medium", [
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
  market("42161", "arbitrum", "0xfdb17e53ea5d342124b8473188bcb9f05f1949ca", "Staked USDai", "normal", 634_446, 0.07968, 0.07, 0.87849, 0.9, 0, 0, "medium", [
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
