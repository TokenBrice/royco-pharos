// Real downloaded stablecoin logos (public/assets/logos), keyed by normalized symbol.
// Aliases map deposit-token symbols (e.g. sNUSD) to their base asset's logo.
const LOGO_FILE: Record<string, string> = {
  savusd: "savusd.png",
  apyusd: "apyusd.png",
  syrupusdc: "syrupusdc.png",
  falconxusdc: "falconxusdc.png",
  aafalconxusdc: "falconxusdc.png",
  nusd: "nusd.png",
  snusd: "nusd.png",
  stcusd: "stcusd.png",
  eearn: "eearn.jpg",
  susdai: "susdai.png",
  autousd: "autousd.png",
};

function normalize(symbol: string) {
  return symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function logoFile(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  return LOGO_FILE[normalize(symbol)] ?? null;
}

/**
 * A circular asset mark. Renders the real brand logo when we have one (clipped to a
 * circle so logos with their own background stay tidy), otherwise a monogram fallback.
 * Decorative by default: the symbol text sits beside it, so alt is empty.
 */
export function AssetLogo({ symbol, size = 24 }: { symbol: string | null | undefined; size?: number }) {
  const file = logoFile(symbol);
  if (file) {
    return (
      <span className="asset-logo" style={{ width: size, height: size }}>
        <img src={`/assets/logos/${file}`} alt="" width={size} height={size} loading="lazy" decoding="async" />
      </span>
    );
  }
  const initials = (symbol ?? "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  return (
    <span
      className="asset-logo asset-logo--mono"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
