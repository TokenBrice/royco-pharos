import type { PharosDependency, PharosDewsSignal, UnderlyingSummary } from "./types";

type JsonRecord = Record<string, unknown>;

export interface PharosReportCardExtras {
  summary: string;
  dews: PharosDewsSignal | null;
  upstreamDependencies: PharosDependency[];
  pharosUrl: string | null;
}

const PHAROS_STABLECOIN_BASE_URL = "https://pharos.watch/stablecoin";

export function pharosStablecoinUrl(id: string | null | undefined) {
  return id ? `${PHAROS_STABLECOIN_BASE_URL}/${encodeURIComponent(id)}/` : null;
}

export function serializeUnderlyingReportCard(underlying: UnderlyingSummary) {
  return JSON.stringify({
    summary: underlying.summary,
    dews: underlying.dews,
    upstreamDependencies: underlying.upstreamDependencies,
    pharosUrl: underlying.pharosUrl,
  });
}

export function reportCardExtrasFromJson(summaryJson: string | null | undefined, pharosStablecoinId: string | null): PharosReportCardExtras {
  const parsed = parseJson(summaryJson);
  const record = isObject(parsed) ? parsed : null;
  return {
    summary: stringValue(record, "summary") ?? "Pharos summary unavailable.",
    dews: normalizeDews(record?.dews ?? null),
    upstreamDependencies: normalizeDependencies(record?.upstreamDependencies),
    pharosUrl: stringValue(record, "pharosUrl") ?? pharosStablecoinUrl(pharosStablecoinId),
  };
}

export function extractReportCardExtras({
  id,
  card,
  coin,
  fixture,
}: {
  id: string;
  card: JsonRecord | null;
  coin: JsonRecord | null;
  fixture: UnderlyingSummary | null;
}): PharosReportCardExtras {
  const dimensions = isObject(card?.dimensions) ? card.dimensions : null;
  const dependencyRisk = isObject(dimensions?.dependencyRisk) ? dimensions.dependencyRisk : null;
  const summary =
    stringValue(dependencyRisk, "detail") ??
    stringValue(dependencyRisk, "summary") ??
    stringValue(card, "summary") ??
    stringValue(card, "detail") ??
    fixture?.summary ??
    "Live Pharos report card summary unavailable.";

  return {
    summary,
    dews: extractDewsSignal(card, coin) ?? fixture?.dews ?? null,
    upstreamDependencies: withFixtureDependencies(extractDependencies(card, coin), fixture),
    pharosUrl: stringValue(card, "url") ?? stringValue(card, "pharosUrl") ?? pharosStablecoinUrl(id),
  };
}

function withFixtureDependencies(dependencies: PharosDependency[], fixture: UnderlyingSummary | null) {
  return dependencies.length > 0 ? dependencies.slice(0, 6) : fixture?.upstreamDependencies ?? [];
}

function extractDewsSignal(...sources: (JsonRecord | null)[]): PharosDewsSignal | null {
  for (const source of sources) {
    if (!source) continue;
    const keyed = findDewsContainer(source);
    if (keyed) {
      const normalized = normalizeDews(keyed);
      if (normalized) return normalized;
    }

    const directScore =
      numberValue(source, "dewsStress") ??
      numberValue(source, "dewsStressScore") ??
      numberValue(source, "dewsScore") ??
      numberValue(source, "depegEarlyWarningScore");
    const directStatus =
      stringValue(source, "dewsStatus") ??
      stringValue(source, "dewsBand") ??
      stringValue(source, "dewsState") ??
      stringValue(source, "depegEarlyWarningStatus");
    if (directScore != null || directStatus != null) {
      return {
        status: directStatus ?? statusFromDewsStress(directScore),
        stressScore: directScore,
        summary: stringValue(source, "dewsSummary") ?? stringValue(source, "dewsMessage") ?? null,
        observedAt: timestampValue(source, "observedAt") ?? timestampValue(source, "asOf"),
        updatedAt: timestampValue(source, "updatedAt"),
      };
    }
  }
  return null;
}

function findDewsContainer(source: JsonRecord): JsonRecord | number | string | null {
  const queue: unknown[] = [source];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const value = queue.shift();
    if (!isObject(value) || seen.has(value)) continue;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey === "dews" ||
        normalizedKey.includes("dews") ||
        normalizedKey.includes("depegearlywarning") ||
        normalizedKey.includes("depegwarning")
      ) {
        if (isObject(child) || typeof child === "number" || typeof child === "string") return child;
      }
      if (isObject(child)) queue.push(child);
      if (Array.isArray(child)) {
        for (const item of child) if (isObject(item)) queue.push(item);
      }
    }
  }
  return null;
}

function normalizeDews(value: unknown): PharosDewsSignal | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      status: statusFromDewsStress(value),
      stressScore: value,
      summary: null,
      observedAt: null,
      updatedAt: null,
    };
  }
  if (typeof value === "string") {
    return {
      status: value,
      stressScore: null,
      summary: null,
      observedAt: null,
      updatedAt: null,
    };
  }
  if (!isObject(value)) return null;
  const stressScore =
    numberValue(value, "stressScore") ??
    numberValue(value, "score") ??
    numberValue(value, "value") ??
    numberValue(value, "dews") ??
    numberValue(value, "dewsScore");
  const status =
    stringValue(value, "status") ??
    stringValue(value, "state") ??
    stringValue(value, "band") ??
    stringValue(value, "severity") ??
    stringValue(value, "level") ??
    statusFromDewsStress(stressScore);
  const summary =
    stringValue(value, "summary") ??
    stringValue(value, "message") ??
    stringValue(value, "detail") ??
    stringValue(value, "label") ??
    null;
  if (stressScore == null && summary == null && status === "not reported") return null;
  return {
    status,
    stressScore,
    summary,
    observedAt: timestampValue(value, "observedAt") ?? timestampValue(value, "asOf") ?? timestampValue(value, "timestamp"),
    updatedAt: timestampValue(value, "updatedAt"),
  };
}

function statusFromDewsStress(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) return "not reported";
  if (score >= 75) return "critical";
  if (score >= 50) return "warning";
  if (score >= 25) return "watch";
  return "normal";
}

function extractDependencies(...sources: (JsonRecord | null)[]): PharosDependency[] {
  const dependencies = new Map<string, PharosDependency>();
  for (const source of sources) {
    if (!source) continue;
    for (const item of dependencyCandidates(source)) {
      const dep = normalizeDependency(item);
      if (!dep) continue;
      const key = dep.id ?? dep.symbol ?? dep.name;
      const existing = dependencies.get(key);
      if (!existing || dependencyCompleteness(dep) > dependencyCompleteness(existing)) {
        dependencies.set(key, dep);
      }
    }
  }
  return [...dependencies.values()].sort((a, b) => (b.weightPct ?? -1) - (a.weightPct ?? -1));
}

function dependencyCandidates(source: JsonRecord): unknown[] {
  const candidates: unknown[] = [];
  const queue: unknown[] = [source];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const value = queue.shift();
    if (!isObject(value) || seen.has(value)) continue;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      const looksLikeDependency =
        normalizedKey.includes("depend") ||
        normalizedKey.includes("upstream") ||
        normalizedKey.includes("constituent") ||
        normalizedKey.includes("reserve") ||
        normalizedKey.includes("collateral");
      if (looksLikeDependency) {
        if (Array.isArray(child)) candidates.push(...child);
        else if (isObject(child)) {
          const nested = child.items ?? child.dependencies ?? child.upstreams ?? child.breakdown ?? child.components;
          if (Array.isArray(nested)) candidates.push(...nested);
          else candidates.push(child);
        }
      }
      if (isObject(child)) queue.push(child);
      if (Array.isArray(child)) {
        for (const item of child) if (isObject(item)) queue.push(item);
      }
    }
  }
  return candidates;
}

function normalizeDependencies(value: unknown): PharosDependency[] {
  return Array.isArray(value) ? value.map(normalizeDependency).filter((dep): dep is PharosDependency => dep != null) : [];
}

function normalizeDependency(value: unknown): PharosDependency | null {
  if (!isObject(value)) return null;
  const id =
    stringValue(value, "id") ??
    stringValue(value, "coinId") ??
    stringValue(value, "stablecoinId") ??
    stringValue(value, "pharosStablecoinId") ??
    stringValue(value, "dependencyId");
  const symbol = stringValue(value, "symbol") ?? stringValue(value, "ticker") ?? stringValue(value, "assetSymbol");
  const name =
    stringValue(value, "name") ??
    stringValue(value, "label") ??
    stringValue(value, "asset") ??
    stringValue(value, "dependency") ??
    symbol ??
    id;
  if (!name) return null;

  const weightPct = pctValue(value, "weightPct") ?? pctValue(value, "weight") ?? pctValue(value, "sharePct") ?? pctValue(value, "share");
  const safetyScore =
    numberValue(value, "safetyScore") ??
    numberValue(value, "score") ??
    numberValue(value, "dependencyScore") ??
    numberValue(value, "overallScore");
  return {
    id,
    name,
    symbol,
    weightPct,
    safetyScore,
    safetyGrade: stringValue(value, "safetyGrade") ?? stringValue(value, "grade") ?? stringValue(value, "overallGrade"),
    pharosUrl: stringValue(value, "url") ?? stringValue(value, "pharosUrl") ?? pharosStablecoinUrl(id),
    relationship: stringValue(value, "relationship") ?? stringValue(value, "type") ?? stringValue(value, "source") ?? null,
  };
}

function dependencyCompleteness(dep: PharosDependency) {
  return [
    dep.id,
    dep.symbol,
    dep.name,
    dep.weightPct,
    dep.safetyScore,
    dep.safetyGrade,
    dep.pharosUrl,
    dep.relationship,
  ].filter((value) => value != null && value !== "").length;
}

function pctValue(value: JsonRecord, key: string) {
  const raw = numberValue(value, key);
  if (raw == null) return null;
  return Math.abs(raw) <= 1 ? raw * 100 : raw;
}

function timestampValue(value: JsonRecord, key: string) {
  const raw = value[key];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 2_000_000_000 ? Math.floor(raw / 1000) : raw;
  }
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }
  return null;
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
  return isObject(value) && typeof value[key] === "string" && value[key].trim() ? value[key].trim() : null;
}

function numberValue(value: unknown, key: string) {
  return isObject(value) && typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] : null;
}

function isObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
