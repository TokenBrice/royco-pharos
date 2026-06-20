type Level = "good" | "warn" | "bad";

const STATUS_LABEL: Record<string, string> = {
  normal: "Normal",
  protected: "Protection mode",
  unhealthy: "Unhealthy",
  critical: "Critical",
  unknown: "Unknown",
};

export function StatusDot({ status }: { status: string | null | undefined }) {
  const s = status ?? "unknown";
  return (
    <span className="status-dot" data-status={s}>
      {STATUS_LABEL[s] ?? STATUS_LABEL.unknown}
    </span>
  );
}

/** Utilization severity vs its limit (or 90% fallback). */
export function utilizationLevel(util: number | null | undefined, limit: number | null | undefined): Level {
  if (util == null) return "good";
  const cap = limit ?? 90;
  if (util >= cap) return "bad";
  if (util >= cap * 0.85) return "warn";
  return "good";
}

/** Coverage-headroom severity: thin buffer is dangerous. */
export function headroomLevel(headroomPct: number | null | undefined): Level {
  if (headroomPct == null) return "good";
  if (headroomPct < 10) return "bad";
  if (headroomPct < 25) return "warn";
  return "good";
}

/**
 * A bar that fills `value/max` and can mark a `limit` threshold.
 * `level` colors the fill (good/warn/bad).
 */
export function MicroBar({
  value,
  max = 100,
  limit,
  level = "good",
  label,
}: {
  value: number | null | undefined;
  max?: number;
  limit?: number | null;
  level?: Level;
  label?: string;
}) {
  const pct = value == null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const limitPct = limit == null || !Number.isFinite(limit) ? null : Math.max(0, Math.min(100, (limit / max) * 100));
  return (
    <span className="microbar" role="img" aria-label={label ?? `${Math.round(pct)} percent`}>
      <span className="microbar__fill" data-level={level} style={{ transform: `scaleX(${pct / 100})` }} />
      {limitPct != null ? <span className="microbar__limit" style={{ left: `${limitPct}%` }} /> : null}
    </span>
  );
}
