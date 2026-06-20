import { GradeBadge, GRADE_LETTERS, NumericScoreBadge, gradeIndex } from "../grade";
import styles from "./penalty-bar.module.css";

type Severity = "info" | "watch" | "warning" | "critical";
type RiskCategory = "loss-risk" | "liquidity-friction" | "data-confidence" | "access-friction";

type PenaltyRow = {
  key: string;
  label: string;
  riskCategory: RiskCategory;
  appliedPenalty: number;
  severity: Severity;
  explanation: string;
};

const SEVERITY_VAR: Record<Severity, string> = {
  info: "var(--sev-info)",
  watch: "var(--sev-watch)",
  warning: "var(--sev-warning)",
  critical: "var(--sev-critical)",
};

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  "loss-risk": "Loss risk",
  "liquidity-friction": "Liquidity friction",
  "data-confidence": "Data confidence",
  "access-friction": "Access friction",
};

const CATEGORY_ORDER: RiskCategory[] = ["loss-risk", "liquidity-friction", "access-friction", "data-confidence"];

/**
 * Penalty breakdown bar — "Why this grade".
 *
 * A horizontal bar that starts at the tranche anchor and is reduced, segment by
 * segment, by every penalty with appliedPenalty > 0, down to the final safetyScore.
 * The Pharos vault score is shown as an input, not as a hard ceiling.
 */
export function PenaltyBar({
  baseScore,
  baseGrade,
  finalScore,
  finalGrade,
  penalties,
  scoreStatus,
}: {
  baseScore: number | null;
  baseGrade: string | null;
  finalScore: number | null;
  finalGrade: string | null;
  penalties: PenaltyRow[];
  scoreStatus?: string | null;
}) {
  // Honest NR state when we cannot explain the tranche deduction.
  if (baseScore == null || finalScore == null || !Number.isFinite(baseScore) || !Number.isFinite(finalScore)) {
    return (
      <div className={styles.nr} role="img" aria-label="Penalty breakdown not available: this tranche is not rated.">
        <NumericScoreBadge score={finalScore} grade={finalGrade} status={scoreStatus} />
        <p>This tranche is not rated, so there is no tranche-level deduction to show.</p>
      </div>
    );
  }

  const applied = penalties
    .filter((row) => row.appliedPenalty > 0)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.riskCategory) - CATEGORY_ORDER.indexOf(b.riskCategory));

  // Scale: the full track is the 0..100 score range. The kept stub is the final score
  // (colored by its grade), then each tranche-level deduction, then empty headroom.
  const totalApplied = applied.reduce((sum, row) => sum + row.appliedPenalty, 0);
  const anchorScore = Math.max(0, Math.min(100, Math.round(finalScore + totalApplied)));
  // The anchor sits above the Pharos vault score only via the Senior cushion credit — the one
  // sanctioned path for a Senior seat to exceed the whole-vault score. Surface it explicitly so
  // the base -> anchor jump is never unexplained.
  const cushionCredit = anchorScore - baseScore;
  const pctOf = (points: number) => Math.max(0, Math.min(100, points));
  const finalIdx = gradeIndex(finalGrade);
  const keptColor = finalIdx != null ? `var(--grade-${GRADE_LETTERS[finalIdx].toLowerCase()})` : "var(--grade-nr)";

  // categories actually present, in canonical order, for the legend
  const presentCategories = CATEGORY_ORDER.filter((cat) => applied.some((row) => row.riskCategory === cat));

  const ariaLabel = `Why this grade. Pharos vault score ${baseScore}${
    cushionCredit > 0 ? `, plus ${cushionCredit} Senior cushion credit` : ""
  }, tranche anchor ${anchorScore}, reduced by ${totalApplied.toFixed(
    1,
  )} points across ${applied.length} factor${applied.length === 1 ? "" : "s"}, down to a final Safety score of ${finalScore}, grade ${finalGrade ?? "NR"}.`;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.baseline}>
          <span className={styles.baseLabel}>Pharos vault</span>
          <span className={styles.num}>{baseScore}</span>
          <GradeBadge grade={baseGrade} size="sm" />
        </span>
        {cushionCredit > 0 ? <span className={styles.cushion}>+{cushionCredit} Senior cushion</span> : null}
        <span className={styles.baseline}>
          <span className={styles.baseLabel}>Tranche anchor</span>
          <span className={styles.num}>{anchorScore}</span>
        </span>
        <span className={styles.minus}>
          minus {totalApplied.toFixed(1)} {totalApplied === 1 ? "point" : "points"}
        </span>
        <span className={styles.finalCell}>
          <span className={styles.baseLabel}>Final Safety</span>
          <NumericScoreBadge score={finalScore} grade={finalGrade} status={scoreStatus} label="Final Safety score" />
        </span>
      </div>

      <div className={styles.bar} role="img" aria-label={ariaLabel}>
        {/* remaining score (the part the wrapper did NOT subtract) */}
        <span
          className={styles.kept}
          style={{ width: `${pctOf(finalScore)}%`, background: keptColor }}
          title={`Final Safety score ${finalScore} of 100`}
        />
        {/* deducted segments, by severity color */}
        {applied.map((row) => (
          <span
            key={row.key}
            className={styles.seg}
            style={{ width: `${pctOf(row.appliedPenalty)}%`, background: SEVERITY_VAR[row.severity] }}
            data-severity={row.severity}
            title={`${CATEGORY_LABEL[row.riskCategory]} · ${row.label}: -${row.appliedPenalty.toFixed(1)}. ${row.explanation}`}
          />
        ))}
      </div>

      {/* grouped factor list, by risk category */}
      <dl className={styles.factors}>
        {presentCategories.map((cat) => (
          <div key={cat} className={styles.factorGroup}>
            <dt className={styles.catLabel}>{CATEGORY_LABEL[cat]}</dt>
            <dd>
              <ul>
                {applied
                  .filter((row) => row.riskCategory === cat)
                  .map((row) => (
                    <li key={row.key}>
                      <span className={styles.sevDot} style={{ background: SEVERITY_VAR[row.severity] }} aria-hidden="true" />
                      <span className={styles.factorLabel}>{row.label}</span>
                      <span className={styles.factorVal}>-{row.appliedPenalty.toFixed(1)}</span>
                    </li>
                  ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>

      <ul className={styles.legend}>
        {(["info", "watch", "warning", "critical"] as Severity[]).map((sev) => (
          <li key={sev}>
            <i style={{ background: SEVERITY_VAR[sev] }} /> {sev}
          </li>
        ))}
      </ul>
    </div>
  );
}
