import type {
  PharosBridgeRoute,
  PharosDependency,
  PharosDimension,
  PharosDimensionItem,
  PharosFreshnessFlags,
  PharosPegHealth,
  UnderlyingSummary,
} from "./types";

type JsonRecord = Record<string, unknown>;

export interface PharosReportCardExtras {
  overallBaseScore: number | null;
  summary: string;
  peg: PharosPegHealth | null;
  dimensions: PharosDimension[];
  upstreamDependencies: PharosDependency[];
  variantKind: string | null;
  variantParentId: string | null;
  navToken: boolean | null;
  bridgeRoute: PharosBridgeRoute | null;
  freshness: PharosFreshnessFlags;
  pharosUrl: string | null;
}

/** Report-card-wide context so a dependency can resolve to its own Pharos grade and the
 *  per-asset degradation flags (which live at the top level of /api/report-cards). */
export interface ReportCardContext {
  cardById?: Map<string, JsonRecord>;
  fallbackIds?: Set<string>;
  driftIds?: Set<string>;
  stale?: boolean;
}

const PHAROS_STABLECOIN_BASE_URL = "https://pharos.watch/stablecoin";
const DIMENSION_ORDER = ["pegStability", "liquidity", "resilience", "decentralization", "dependencyRisk"];
const NO_FRESHNESS: PharosFreshnessFlags = { fallback: false, collateralDrift: false, stale: false };

export function pharosStablecoinUrl(id: string | null | undefined) {
  return id ? `${PHAROS_STABLECOIN_BASE_URL}/${encodeURIComponent(id)}/` : null;
}

export function serializeUnderlyingReportCard(underlying: UnderlyingSummary) {
  return JSON.stringify({
    overallBaseScore: underlying.overallBaseScore,
    summary: underlying.summary,
    peg: underlying.peg,
    dimensions: underlying.dimensions,
    upstreamDependencies: underlying.upstreamDependencies,
    variantKind: underlying.variantKind,
    variantParentId: underlying.variantParentId,
    navToken: underlying.navToken,
    bridgeRoute: underlying.bridgeRoute,
    freshness: underlying.freshness,
    pharosUrl: underlying.pharosUrl,
  });
}

export function reportCardExtrasFromJson(summaryJson: string | null | undefined, pharosStablecoinId: string | null): PharosReportCardExtras {
  const parsed = parseJson(summaryJson);
  const record = isObject(parsed) ? parsed : null;
  return {
    overallBaseScore: numberValue(record, "overallBaseScore"),
    summary: stringValue(record, "summary") ?? "Pharos summary unavailable.",
    peg: normalizePeg(record?.peg),
    dimensions: normalizeDimensions(record?.dimensions),
    upstreamDependencies: normalizeDependencies(record?.upstreamDependencies),
    variantKind: stringValue(record, "variantKind"),
    variantParentId: stringValue(record, "variantParentId"),
    navToken: boolValue(record, "navToken"),
    bridgeRoute: normalizeBridge(record?.bridgeRoute),
    freshness: normalizeFreshness(record?.freshness),
    pharosUrl: stringValue(record, "pharosUrl") ?? pharosStablecoinUrl(pharosStablecoinId),
  };
}

export function extractReportCardExtras({
  id,
  card,
  fixture,
  context = {},
}: {
  id: string;
  card: JsonRecord | null;
  fixture: UnderlyingSummary | null;
  context?: ReportCardContext;
}): PharosReportCardExtras {
  const rawInputs = isObject(card?.rawInputs) ? (card.rawInputs as JsonRecord) : null;
  const dimensions = extractDimensions(card);
  const dependencies = extractDependencies(rawInputs, context.cardById);
  const summary =
    dimensions.find((dim) => dim.key === "dependencyRisk")?.detail ??
    dimensions.find((dim) => dim.key === "resilience")?.detail ??
    fixture?.summary ??
    "Live Pharos report card summary unavailable.";

  return {
    overallBaseScore: numberValue(card, "baseScore") ?? fixture?.overallBaseScore ?? null,
    summary,
    peg: extractPeg(card) ?? fixture?.peg ?? null,
    dimensions: dimensions.length > 0 ? dimensions : fixture?.dimensions ?? [],
    upstreamDependencies: dependencies.length > 0 ? dependencies : fixture?.upstreamDependencies ?? [],
    variantKind: stringValue(rawInputs, "variantKind") ?? fixture?.variantKind ?? null,
    variantParentId: stringValue(rawInputs, "variantParentId") ?? fixture?.variantParentId ?? null,
    navToken: boolValue(rawInputs, "navToken") ?? fixture?.navToken ?? null,
    bridgeRoute: extractBridge(card) ?? fixture?.bridgeRoute ?? null,
    freshness: {
      fallback: context.fallbackIds?.has(id) ?? false,
      collateralDrift: context.driftIds?.has(id) ?? false,
      stale: context.stale ?? false,
    },
    pharosUrl: stringValue(card, "url") ?? stringValue(card, "pharosUrl") ?? pharosStablecoinUrl(id),
  };
}

function extractDimensions(card: JsonRecord | null): PharosDimension[] {
  const dims = isObject(card?.dimensions) ? (card.dimensions as JsonRecord) : null;
  if (!dims) return [];
  const keys = [...new Set([...DIMENSION_ORDER, ...Object.keys(dims)])].filter((key) => isObject(dims[key]));
  return keys.map((key) => {
    const dim = dims[key] as JsonRecord;
    return {
      key,
      label: humanizeKey(key),
      score: numberValue(dim, "score"),
      grade: stringValue(dim, "grade"),
      detail: stringValue(dim, "detail"),
      items: extractDimensionItems(dim),
    } satisfies PharosDimension;
  });
}

function extractDimensionItems(dim: JsonRecord): PharosDimensionItem[] {
  const items = Array.isArray(dim.detailItems) ? dim.detailItems : [];
  return items.filter(isObject).map((item) => ({
    label: stringValue(item, "label"),
    value: stringValue(item, "value"),
    detail: stringValue(item, "detail"),
  }));
}

function extractPeg(card: JsonRecord | null): PharosPegHealth | null {
  const rawInputs = isObject(card?.rawInputs) ? (card.rawInputs as JsonRecord) : null;
  const dims = isObject(card?.dimensions) ? (card.dimensions as JsonRecord) : null;
  const pegStability = dims && isObject(dims.pegStability) ? (dims.pegStability as JsonRecord) : null;
  if (!rawInputs && !pegStability) return null;
  const items = pegStability && Array.isArray(pegStability.detailItems) ? pegStability.detailItems : [];
  const yieldBearing = items.some(
    (item) => isObject(item) && /yield-bearing/i.test(`${stringValue(item, "value") ?? ""} ${stringValue(item, "detail") ?? ""}`),
  );
  return {
    score: numberValue(pegStability, "score") ?? numberValue(rawInputs, "pegScore"),
    grade: stringValue(pegStability, "grade"),
    activeDepeg: boolValue(rawInputs, "activeDepeg"),
    activeDepegBps: numberValue(rawInputs, "activeDepegBps"),
    depegEventCount: numberValue(rawInputs, "depegEventCount"),
    lastEventAt: numberValue(rawInputs, "lastEventAt"),
    yieldBearing,
  };
}

function extractDependencies(rawInputs: JsonRecord | null, cardById?: Map<string, JsonRecord>): PharosDependency[] {
  const list = rawInputs && Array.isArray(rawInputs.dependencies) ? rawInputs.dependencies : [];
  return list
    .filter(isObject)
    .map((dep) => normalizeRawDependency(dep, cardById))
    .filter((dep): dep is PharosDependency => dep != null);
}

function normalizeRawDependency(dep: JsonRecord, cardById?: Map<string, JsonRecord>): PharosDependency | null {
  const id = stringValue(dep, "id") ?? stringValue(dep, "coinId") ?? stringValue(dep, "stablecoinId");
  const ownCard = id && cardById ? cardById.get(id) ?? null : null;
  const symbol = stringValue(ownCard, "symbol") ?? stringValue(dep, "symbol");
  const name = stringValue(ownCard, "name") ?? stringValue(dep, "name") ?? symbol ?? id;
  if (!name) return null;
  const weight = numberValue(dep, "weight") ?? numberValue(dep, "weightPct");
  return {
    id,
    name,
    symbol,
    weightPct: weight == null ? null : Math.abs(weight) <= 1 ? Math.round(weight * 1000) / 10 : weight,
    safetyScore: numberValue(ownCard, "overallScore"),
    safetyGrade: stringValue(ownCard, "overallGrade"),
    pharosUrl: pharosStablecoinUrl(id),
    relationship: stringValue(dep, "type") ?? stringValue(dep, "relationship"),
  };
}

function extractBridge(card: JsonRecord | null): PharosBridgeRoute | null {
  const bridge = isObject(card?.bridgeRouteRisk) ? (card.bridgeRouteRisk as JsonRecord) : null;
  if (!bridge) return null;
  return { label: stringValue(bridge, "label"), score: numberValue(bridge, "score") };
}

function normalizePeg(value: unknown): PharosPegHealth | null {
  if (!isObject(value)) return null;
  return {
    score: numberValue(value, "score"),
    grade: stringValue(value, "grade"),
    activeDepeg: boolValue(value, "activeDepeg"),
    activeDepegBps: numberValue(value, "activeDepegBps"),
    depegEventCount: numberValue(value, "depegEventCount"),
    lastEventAt: numberValue(value, "lastEventAt"),
    yieldBearing: value.yieldBearing === true,
  };
}

function normalizeDimensions(value: unknown): PharosDimension[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((dim) => ({
      key: stringValue(dim, "key") ?? "",
      label: stringValue(dim, "label") ?? humanizeKey(stringValue(dim, "key") ?? ""),
      score: numberValue(dim, "score"),
      grade: stringValue(dim, "grade"),
      detail: stringValue(dim, "detail"),
      items: Array.isArray(dim.items)
        ? dim.items.filter(isObject).map((item) => ({
            label: stringValue(item, "label"),
            value: stringValue(item, "value"),
            detail: stringValue(item, "detail"),
          }))
        : [],
    }))
    .filter((dim) => dim.key);
}

function normalizeDependencies(value: unknown): PharosDependency[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((dep) => ({
      id: stringValue(dep, "id"),
      name: stringValue(dep, "name") ?? stringValue(dep, "symbol") ?? stringValue(dep, "id") ?? "",
      symbol: stringValue(dep, "symbol"),
      weightPct: numberValue(dep, "weightPct"),
      safetyScore: numberValue(dep, "safetyScore"),
      safetyGrade: stringValue(dep, "safetyGrade"),
      pharosUrl: stringValue(dep, "pharosUrl") ?? pharosStablecoinUrl(stringValue(dep, "id")),
      relationship: stringValue(dep, "relationship"),
    }))
    .filter((dep) => dep.name);
}

function normalizeBridge(value: unknown): PharosBridgeRoute | null {
  if (!isObject(value)) return null;
  return { label: stringValue(value, "label"), score: numberValue(value, "score") };
}

function normalizeFreshness(value: unknown): PharosFreshnessFlags {
  if (!isObject(value)) return { ...NO_FRESHNESS };
  return {
    fallback: value.fallback === true,
    collateralDrift: value.collateralDrift === true,
    stale: value.stale === true,
  };
}

function humanizeKey(key: string) {
  if (!key) return "";
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stringValue(value: unknown, key: string) {
  return isObject(value) && typeof value[key] === "string" && value[key].trim() ? (value[key] as string).trim() : null;
}

function numberValue(value: unknown, key: string) {
  return isObject(value) && typeof value[key] === "number" && Number.isFinite(value[key]) ? (value[key] as number) : null;
}

function boolValue(value: unknown, key: string): boolean | null {
  return isObject(value) && typeof value[key] === "boolean" ? (value[key] as boolean) : null;
}

function isObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
