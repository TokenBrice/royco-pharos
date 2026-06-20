import { titleCase } from "./format";
import { GradeBadge, type GradeSize } from "./grade";
import { badgeClassForState } from "@/lib/roycopharos/snapshot-health";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = status ?? "unknown";
  const className =
    normalized === "normal"
      ? "badge good"
      : normalized === "protected"
        ? "badge watch"
        : normalized === "unhealthy" || normalized === "critical"
          ? "badge bad"
          : "badge";

  return <span className={className}>{normalized === "protected" ? "Protection mode" : titleCase(normalized)}</span>;
}

export function ScoreBadge({
  grade,
  status,
  size = "md",
}: {
  grade: string | null | undefined;
  status?: string | null;
  size?: GradeSize;
}) {
  return <GradeBadge grade={grade} status={status} size={size} />;
}

export function DataBadge({ value }: { value: string | null | undefined }) {
  const normalized = value ?? "unknown";
  const label = normalized === "nr" ? "NR" : titleCase(normalized);
  return <span className={badgeClassForState(normalized)}>{label}</span>;
}
