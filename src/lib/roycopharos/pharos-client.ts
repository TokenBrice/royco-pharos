import { createHash } from "node:crypto";
import { UNDERLYING_FIXTURES } from "./fixtures";
import { fetchWithTimeout, retryAfterMs, sleep } from "./http";
import { extractReportCardExtras } from "./pharos-report-card";
import type { PharosApiCacheEntry, UnderlyingSummary } from "./types";

const DEFAULT_PHAROS_API_BASE = "https://api.pharos.watch";
const CACHE_TTL_SECONDS = 60 * 60;
const STALE_IF_ERROR_SECONDS = 24 * 60 * 60;
const MAX_429_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 30_000;

type JsonRecord = Record<string, unknown>;

interface PharosEndpointResult {
  endpoint: string;
  body: JsonRecord;
  cacheEntry: PharosApiCacheEntry;
}

export interface PharosLoadResult {
  mode: "fixture" | "live" | "stale-if-error";
  underlyings: UnderlyingSummary[];
  cacheEntries: PharosApiCacheEntry[];
  warning: string | null;
}

export interface PharosLoadOptions {
  apiKey?: string | null;
  apiBase?: string | null;
}

export async function loadPharosUnderlyings(
  requiredIds: string[],
  fallbackUnderlyings: UnderlyingSummary[] = [],
  options: PharosLoadOptions = {},
): Promise<PharosLoadResult> {
  const apiKey = options.apiKey ?? process.env.PHAROS_API_KEY;
  if (!apiKey || apiKey === "ph_live_replace_me") {
    return {
      mode: "fixture",
      underlyings: fixtureUnderlyings(requiredIds),
      cacheEntries: fixtureCacheEntries(),
      warning: null,
    };
  }

  const fetchedAt = Math.floor(Date.now() / 1000);
  try {
    const [stablecoins, reportCards] = await Promise.all([
      fetchPharosEndpoint("/api/stablecoins", apiKey, fetchedAt, options.apiBase),
      fetchPharosEndpoint("/api/report-cards", apiKey, fetchedAt, options.apiBase),
    ]);
    const underlyings = buildUnderlyingSummaries(requiredIds, stablecoins.body, reportCards.body, fetchedAt);
    const missingSafetyIds = underlyings
      .filter((underlying) => underlying.underlyingSafetyScore == null)
      .map((underlying) => underlying.pharosStablecoinId ?? underlying.symbol);
    return {
      mode: "live",
      underlyings,
      cacheEntries: [stablecoins.cacheEntry, reportCards.cacheEntry],
      warning: missingSafetyIds.length > 0 ? `Missing live Pharos Safety Score for ${missingSafetyIds.join(", ")}.` : null,
    };
  } catch (error) {
    const warning = `Live Pharos fetch failed: ${error instanceof Error ? error.message : String(error)}`;
    const staleFallback = fallbackUnderlyings.filter((underlying) => {
      if (underlying.fetchedAt == null) return false;
      return underlying.fetchedAt + STALE_IF_ERROR_SECONDS >= fetchedAt;
    });
    const fallback = staleFallback.length > 0 ? staleFallback : fixtureUnderlyings(requiredIds);
    return {
      mode: staleFallback.length > 0 ? "stale-if-error" : "fixture",
      underlyings: fallback,
      cacheEntries: [errorCacheEntry("/api/stablecoins", fetchedAt, warning), errorCacheEntry("/api/report-cards", fetchedAt, warning)],
      warning,
    };
  }
}

async function fetchPharosEndpoint(
  endpoint: string,
  apiKey: string,
  fetchedAt: number,
  apiBaseOverride?: string | null,
): Promise<PharosEndpointResult> {
  const apiBase = (apiBaseOverride ?? process.env.PHAROS_API_BASE ?? DEFAULT_PHAROS_API_BASE).replace(/\/$/, "");
  const url = `${apiBase}${endpoint}`;
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt += 1) {
    const res = await fetchWithTimeout(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "royco-pharos-local/0.1",
        "X-API-Key": apiKey,
      },
    });
    lastStatus = res.status;

    // Pharos self-serve keys are 30 RPM; honor Retry-After with bounded backoff before giving up
    // (the caller then falls back to last-known-good / stale-if-error).
    if (res.status === 429 && attempt < MAX_429_RETRIES) {
      const wait = retryAfterMs(res.headers.get("retry-after"), MAX_RETRY_WAIT_MS) ?? Math.min(1000 * 2 ** attempt, MAX_RETRY_WAIT_MS);
      await res.text().catch(() => undefined); // drain the body before retrying
      await sleep(wait);
      continue;
    }

    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`${endpoint} returned HTTP ${res.status}`);
    }
    const body = JSON.parse(bodyText) as JsonRecord;
    const xDataAge = res.headers.get("x-data-age");
    const dataAgeSeconds = parseDataAgeSeconds(xDataAge);
    const sourceUpdatedAt = dataAgeSeconds == null ? updatedAtFromBody(body) : fetchedAt - dataAgeSeconds;
    return {
      endpoint,
      body,
      cacheEntry: {
        endpoint,
        cacheKey: "default",
        bodyJson: bodyText,
        bodyHash: bodyHash(bodyText),
        httpStatus: res.status,
        xDataAge,
        warning: dataAgeSeconds != null && dataAgeSeconds > CACHE_TTL_SECONDS ? "Pharos source data age exceeds one hour." : null,
        fetchedAt,
        sourceUpdatedAt,
        expiresAt: fetchedAt + CACHE_TTL_SECONDS,
        staleIfErrorUntil: fetchedAt + STALE_IF_ERROR_SECONDS,
        generation: 1,
        errorCode: null,
      },
    };
  }

  throw new Error(`${endpoint} returned HTTP ${lastStatus} after ${MAX_429_RETRIES + 1} attempts`);
}

function buildUnderlyingSummaries(requiredIds: string[], stablecoinsBody: JsonRecord, reportCardsBody: JsonRecord, fetchedAt: number) {
  const stablecoins = readArray(stablecoinsBody, "peggedAssets");
  const cards = readArray(reportCardsBody, "cards");
  const stablecoinById = new Map(stablecoins.map((entry) => [stringValue(entry, "id"), entry]).filter(([id]) => id != null) as [string, JsonRecord][]);
  const cardById = new Map(cards.map((entry) => [stringValue(entry, "id"), entry]).filter(([id]) => id != null) as [string, JsonRecord][]);
  const fixtureById = new Map(UNDERLYING_FIXTURES.map((entry) => [entry.pharosStablecoinId, entry]));

  return requiredIds.map((id) => {
    const coin = stablecoinById.get(id) ?? null;
    const card = cardById.get(id) ?? null;
    const fixture = fixtureById.get(id) ?? null;
    const extras = extractReportCardExtras({ id, card, coin, fixture });

    return {
      pharosStablecoinId: id,
      symbol: stringValue(coin, "symbol") ?? stringValue(card, "symbol") ?? fixture?.symbol ?? id,
      name: stringValue(coin, "name") ?? stringValue(card, "name") ?? fixture?.name ?? id,
      price: numberValue(coin, "price"),
      supplyUsd: supplyUsd(coin) ?? fixture?.supplyUsd ?? null,
      underlyingSafetyScore: numberValue(card, "overallScore"),
      underlyingSafetyGrade: stringValue(card, "overallGrade"),
      pharosUrl: extras.pharosUrl,
      dews: extras.dews,
      upstreamDependencies: extras.upstreamDependencies,
      summary: extras.summary,
      sourceUpdatedAt: updatedAtFromBody(reportCardsBody) ?? updatedAtFromBody(stablecoinsBody) ?? fetchedAt,
      fetchedAt,
    } satisfies UnderlyingSummary;
  });
}

function fixtureUnderlyings(requiredIds: string[]) {
  if (requiredIds.length === 0) return UNDERLYING_FIXTURES;
  const required = new Set(requiredIds);
  return UNDERLYING_FIXTURES.filter((underlying) => underlying.pharosStablecoinId == null || required.has(underlying.pharosStablecoinId));
}

function fixtureCacheEntries(): PharosApiCacheEntry[] {
  const fetchedAt = Math.floor(Date.now() / 1000);
  const bodyJson = JSON.stringify({ source: "fixture", underlyings: UNDERLYING_FIXTURES.map((entry) => entry.pharosStablecoinId) });
  return ["/api/stablecoins", "/api/report-cards"].map((endpoint) => ({
    endpoint,
    cacheKey: "fixture",
    bodyJson,
    bodyHash: bodyHash(bodyJson),
    httpStatus: 200,
    xDataAge: null,
    warning: "Fixture Pharos data; set PHAROS_API_KEY for live reads.",
    fetchedAt,
    sourceUpdatedAt: fetchedAt,
    expiresAt: fetchedAt + CACHE_TTL_SECONDS,
    staleIfErrorUntil: fetchedAt + STALE_IF_ERROR_SECONDS,
    generation: 1,
    errorCode: null,
  }));
}

function errorCacheEntry(endpoint: string, fetchedAt: number, warning: string): PharosApiCacheEntry {
  const bodyJson = JSON.stringify({ error: warning });
  return {
    endpoint,
    cacheKey: "error",
    bodyJson,
    bodyHash: bodyHash(bodyJson),
    httpStatus: 0,
    xDataAge: null,
    warning,
    fetchedAt,
    sourceUpdatedAt: null,
    expiresAt: null,
    staleIfErrorUntil: fetchedAt + STALE_IF_ERROR_SECONDS,
    generation: 1,
    errorCode: "fetch_failed",
  };
}

function readArray(body: JsonRecord, key: string): JsonRecord[] {
  const value = body[key];
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function supplyUsd(coin: JsonRecord | null) {
  if (!coin) return null;
  const circulating = coin.circulating;
  if (!isObject(circulating)) return null;
  // Royco deposit tokens are USD-pegged, so prefer the USD bucket when present rather than
  // summing across pegs (a EUR bucket would need fx conversion). Fall back to the sum.
  if (typeof circulating.peggedUSD === "number" && Number.isFinite(circulating.peggedUSD)) {
    return circulating.peggedUSD;
  }
  const values = Object.values(circulating).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function updatedAtFromBody(body: JsonRecord) {
  return numberValue(body, "updatedAt") ?? numberValue(body, "asOf") ?? null;
}

function parseDataAgeSeconds(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function bodyHash(body: string) {
  return `sha256-${createHash("sha256").update(body).digest("hex")}`;
}

function stringValue(value: unknown, key: string) {
  return isObject(value) && typeof value[key] === "string" ? value[key] : null;
}

function numberValue(value: unknown, key: string) {
  return isObject(value) && typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] : null;
}

function isObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value != null;
}
