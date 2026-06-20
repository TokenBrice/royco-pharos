import type { ReactNode } from "react";

export const GRADE_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export type GradeSize = "sm" | "md" | "lg" | "xl";

/** A=0 (best/top) … F=5 (worst/bottom). NR / unknown → null. */
export function gradeIndex(grade?: string | null): number | null {
  if (!grade) return null;
  const letter = grade.trim().charAt(0).toUpperCase();
  const i = (GRADE_LETTERS as readonly string[]).indexOf(letter);
  return i >= 0 ? i : null;
}

export function gradeColorVar(grade?: string | null, fallback = "var(--chart-line)") {
  const index = gradeIndex(grade);
  return index == null ? fallback : `var(--grade-${GRADE_LETTERS[index].toLowerCase()})`;
}

function scoreBand(score?: number | null) {
  if (score == null || !Number.isFinite(score)) return "NR";
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  if (score >= 30) return "E";
  return "F";
}

function gradeLabel(grade?: string | null) {
  return grade && grade !== "NR" && gradeIndex(grade) != null ? grade.trim().charAt(0).toUpperCase() : "NR";
}

/**
 * The seat ring: a circle in the Safety-grade color whose line style encodes the seat.
 * Solid = Senior (protected), dashed = Junior (first-loss). Shared by the scatter markers
 * and the ledger so the two surfaces speak the same seat language. pathLength normalizes
 * the Junior dashes so they divide evenly with no seam at any size.
 */
export function SeatRing({
  seat,
  grade,
  size,
  className,
}: {
  seat: "senior" | "junior";
  grade?: string | null;
  size?: number;
  className?: string;
}) {
  const idx = gradeIndex(grade);
  const letter = idx == null ? "nr" : GRADE_LETTERS[idx].toLowerCase();
  const junior = seat === "junior";
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ color: `var(--grade-${letter})` }}
    >
      <circle
        cx="20"
        cy="20"
        r="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        pathLength={junior ? 120 : undefined}
        strokeDasharray={junior ? "5 3" : undefined}
      />
    </svg>
  );
}

/** The colored grade square. Color + letter are redundant channels (colorblind-safe). */
export function GradeBadge({
  grade,
  size = "md",
  status,
}: {
  grade?: string | null;
  size?: GradeSize;
  status?: string | null;
}) {
  const letter = gradeLabel(grade);
  const cls = ["grade-badge", size !== "md" ? size : ""].filter(Boolean).join(" ");
  return (
    <span className={cls} data-grade={letter} data-confidence={status ?? undefined} aria-label={`Grade ${letter}`}>
      {letter}
    </span>
  );
}

/** Grade square + numeric score. */
export function GradeChip({
  grade,
  score,
  size = "sm",
  status,
}: {
  grade?: string | null;
  score?: number | string | null;
  size?: GradeSize;
  status?: string | null;
}) {
  const hasScore = score != null && score !== "";
  return (
    <span className="grade-chip">
      <GradeBadge grade={grade} size={size} status={status} />
      <span className={`num${hasScore ? "" : " is-nr"}`}>{hasScore ? score : "NR"}</span>
    </span>
  );
}

/** Numeric Royco score badge. Color comes from the score band; the visible value stays numeric. */
export function NumericScoreBadge({
  score,
  grade,
  size = "md",
  status,
  label = "Score",
}: {
  score?: number | null;
  grade?: string | null;
  size?: GradeSize;
  status?: string | null;
  label?: string;
}) {
  const value = score == null || !Number.isFinite(score) ? "NR" : String(Math.round(score));
  const band = gradeLabel(grade ?? scoreBand(score));
  const cls = ["score-badge", size !== "md" ? size : ""].filter(Boolean).join(" ");
  const aria = value === "NR" ? `${label} not rated` : `${label} ${value} out of 100`;
  return (
    <span className={cls} data-grade={band} data-confidence={status ?? undefined} aria-label={aria}>
      {value}
    </span>
  );
}

export function ScorePair({
  safetyScore,
  opportunityScore,
  safetyGrade,
  opportunityGrade,
  status,
  size = "md",
  showLabels = true,
}: {
  safetyScore?: number | null;
  opportunityScore?: number | null;
  safetyGrade?: string | null;
  opportunityGrade?: string | null;
  status?: string | null;
  size?: GradeSize;
  showLabels?: boolean;
}) {
  return (
    <span className="score-pair">
      <span className="score-pair__col">
        {showLabels ? <span className="score-pair__label">Safety</span> : null}
        <NumericScoreBadge score={safetyScore} grade={safetyGrade} status={status} size={size} label="Safety score" />
      </span>
      <span className="score-pair__slash" aria-hidden="true">
        /
      </span>
      <span className="score-pair__col">
        {showLabels ? <span className="score-pair__label">Opp</span> : null}
        <NumericScoreBadge
          score={opportunityScore}
          grade={opportunityGrade}
          status={status}
          size={size}
          label="Opportunity score"
        />
      </span>
    </span>
  );
}

/**
 * The signature object: Safety + Opportunity grades joined by a slope connector.
 * Slope rises to the right when Opportunity outranks Safety (yield richly pays for risk).
 */
export function DivergencePair({
  safetyGrade,
  opportunityGrade,
  status,
  size = "md",
  showLabels = true,
}: {
  safetyGrade?: string | null;
  opportunityGrade?: string | null;
  status?: string | null;
  size?: GradeSize;
  showLabels?: boolean;
}) {
  const s = gradeIndex(safetyGrade);
  const o = gradeIndex(opportunityGrade);
  const gap = s != null && o != null ? s - o : null; // > 0 → opportunity better than safety
  const paid = gap != null && gap >= 2;

  const w = 30;
  const h = size === "lg" || size === "xl" ? 52 : 42;
  const yFor = (i: number | null) => (i == null ? h / 2 : 7 + (i / 5) * (h - 14));
  const y1 = yFor(s);
  const y2 = yFor(o);
  const lineColor = paid ? "var(--brand)" : "var(--muted)";

  return (
    <span className={`divergence${paid ? " is-paid" : ""}`}>
      <span className="divergence__col">
        {showLabels ? <span className="divergence__label">Safety</span> : null}
        <GradeBadge grade={safetyGrade} status={status} size={size} />
      </span>
      <span className="divergence__link" aria-hidden="true">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <line x1="2" y1={y1} x2={w - 2} y2={y2} stroke={lineColor} strokeWidth={paid ? 2.5 : 1.75} strokeLinecap="round" />
          <circle cx="2" cy={y1} r="2.6" fill="var(--muted)" />
          <circle cx={w - 2} cy={y2} r="2.8" fill={lineColor} />
        </svg>
      </span>
      <span className="divergence__col">
        {showLabels ? <span className="divergence__label">Opp</span> : null}
        <GradeBadge grade={opportunityGrade} status={status} size={size} />
      </span>
      {paid ? <span className="divergence__delta" aria-label={`Opportunity outranks safety by ${gap}`}>▲{gap}</span> : null}
    </span>
  );
}

/** Small helper so pages can wrap a divergence row with a caption. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="divergence__col">
      <span className="divergence__label">{label}</span>
      {children}
    </span>
  );
}
