import type { MappingStatus } from "./types";

// Authoritative Royco deposit-token -> Pharos stablecoin resolution, keyed by (chainId, address).
// This is the local stand-in for the signed token-mapping table Royco still owes (spec Phase 0).
// Address is the source of truth; symbol is only a last-resort fallback (see resolveMapping).
// `decimals` lives here too because the Royco Dawn payload does not carry deposit-token decimals,
// so live ingestion cannot read them from upstream.
export interface TokenMappingEntry {
  chainId: number;
  address: string; // lowercased
  symbol: string;
  pharosStablecoinId: string;
  decimals: number;
  confidence: "exact" | "manual" | "probable";
}

export const TOKEN_MAPPINGS: TokenMappingEntry[] = [
  { chainId: 43114, address: "0x06d47f3fb376649c3a9dafe069b3d6e35572219e", symbol: "savUSD", pharosStablecoinId: "savusd-avant", decimals: 18, confidence: "manual" },
  { chainId: 1, address: "0x38eeb52f0771140d10c4e9a9a72349a329fe8a6a", symbol: "apyUSD", pharosStablecoinId: "apyusd-apyx", decimals: 18, confidence: "manual" },
  { chainId: 1, address: "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b", symbol: "syrupUSDC", pharosStablecoinId: "syrupusdc-maple", decimals: 6, confidence: "manual" },
  { chainId: 1, address: "0xc26a6fa2c37b38e549a4a1807543801db684f99c", symbol: "AA_FalconXUSDC", pharosStablecoinId: "aa-falconx-mev-capital", decimals: 18, confidence: "manual" },
  { chainId: 1, address: "0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313", symbol: "sNUSD", pharosStablecoinId: "nusd-neutrl", decimals: 18, confidence: "manual" },
  { chainId: 1, address: "0x88887be419578051ff9f4eb6c858a951921d8888", symbol: "stcUSD", pharosStablecoinId: "stcusd-cap", decimals: 18, confidence: "manual" },
  { chainId: 1, address: "0x9be9294722f8aad37b11a9792be2c782182cafa2", symbol: "eEARN", pharosStablecoinId: "eearn-ember", decimals: 6, confidence: "manual" },
  { chainId: 42161, address: "0x0b2b2b2076d95dda7817e785989fe353fe955ef9", symbol: "sUSDai", pharosStablecoinId: "susdai-usd-ai", decimals: 18, confidence: "manual" },
  { chainId: 1, address: "0xa7569a44f348d3d70d8ad5889e50f78e33d80d35", symbol: "autoUSD", pharosStablecoinId: "autousd-auto-finance", decimals: 18, confidence: "manual" },
  { chainId: 1, address: "0x17418038ecf73ba4026c4f428547bf099706f27b", symbol: "ACRED", pharosStablecoinId: "acred-apollo-securitize", decimals: 6, confidence: "manual" },
  { chainId: 1, address: "0xbeefff209270748ddd194831b3fa287a5386f5bc", symbol: "bbqUSDC", pharosStablecoinId: "bbqusdc-steakhouse", decimals: 18, confidence: "manual" },
];

export interface MappingResolution {
  pharosStablecoinId: string | null;
  mappingStatus: MappingStatus;
  mappingSource: string;
  mappingConfidence: string;
  decimals: number | null;
}

function normalizeSymbol(symbol: string) {
  return symbol.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

const byAddress = new Map(TOKEN_MAPPINGS.map((entry) => [`${entry.chainId}:${entry.address.toLowerCase()}`, entry]));
const bySymbol = new Map(TOKEN_MAPPINGS.map((entry) => [normalizeSymbol(entry.symbol), entry]));
const pharosIdsByChain = new Set(TOKEN_MAPPINGS.map((entry) => `${entry.chainId}:${entry.pharosStablecoinId}`));

/**
 * Resolve a Royco deposit token to a Pharos stablecoin id.
 *
 * Address is authoritative: a known (chain, address) maps regardless of symbol — so a renamed
 * symbol on a known address still resolves. Symbol is only a last-resort fallback. Critically,
 * if a symbol is known but its observed (chain, address) is NOT the one we have on record for
 * that chain, that is a conflict (known symbol, unexpected address) and we refuse to map it —
 * this is exactly the silent symbol-based mismatch the spec warns against.
 */
export function resolveMapping(chainId: number, address: string | null | undefined, symbol: string | null | undefined): MappingResolution {
  const normalizedAddress = address?.trim().toLowerCase() ?? "";
  const addrHit = normalizedAddress ? byAddress.get(`${chainId}:${normalizedAddress}`) : undefined;
  if (addrHit) {
    return {
      pharosStablecoinId: addrHit.pharosStablecoinId,
      mappingStatus: "mapped",
      mappingSource: "manual-reviewed",
      mappingConfidence: addrHit.confidence,
      decimals: addrHit.decimals,
    };
  }

  const symbolHit = symbol ? bySymbol.get(normalizeSymbol(symbol)) : undefined;
  if (!symbolHit) {
    return { pharosStablecoinId: null, mappingStatus: "unmapped", mappingSource: "unmapped-live", mappingConfidence: "unknown", decimals: null };
  }

  // Symbol is known. Do we already have an on-chain address for this stablecoin on this chain?
  // If yes, the observed address differs from it -> conflict, refuse to trust the symbol.
  const knownOnChain = pharosIdsByChain.has(`${chainId}:${symbolHit.pharosStablecoinId}`);
  if (knownOnChain) {
    return { pharosStablecoinId: null, mappingStatus: "conflict", mappingSource: "symbol-registry", mappingConfidence: "probable", decimals: null };
  }

  // Symbol known, but no on-chain address record for it -> last-resort probable fallback.
  return {
    pharosStablecoinId: symbolHit.pharosStablecoinId,
    mappingStatus: "mapped",
    mappingSource: "symbol-registry",
    mappingConfidence: "probable",
    decimals: symbolHit.decimals,
  };
}
