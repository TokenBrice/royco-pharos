export function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "NR";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `$${value.toFixed(0)}`;
}

export function formatPct(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "NR";
  return `${value.toFixed(digits)}%`;
}

export function formatRatio(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "NR";
  return `${value.toFixed(digits)}x`;
}

export function formatRatioPct(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "NR" : formatPct(value * 100, digits);
}

export function formatDelta(a: number | null | undefined, b: number | null | undefined, unit: string, digits: number) {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return "NR";
  const delta = a - b;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(digits)}${unit}`;
}

export function formatAge(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "unknown";
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

export function formatDurationShort(seconds: number | null | undefined) {
  if (seconds == null || seconds <= 0 || !Number.isFinite(seconds)) return "Immediate";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

export function formatTimestampUtc(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "unknown";
  return `${new Date(seconds * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

export function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
