import styles from "./penalty-taxonomy.module.css";

/**
 * Penalty taxonomy — the four risk categories as labeled columns, each with
 * example factors, plus a severity-tier legend (info < watch < warning <
 * critical) using the --sev-* tokens. Pure CSS, tokens only.
 */
const CATEGORIES = [
  {
    key: "loss-risk",
    title: "Loss risk",
    blurb: "Drives capital downside.",
    factors: ["Junior first-loss", "Market status", "Coverage below required", "Drawdown"],
  },
  {
    key: "liquidity-friction",
    title: "Liquidity friction",
    blurb: "How hard it is to exit.",
    factors: ["Utilization pressure", "Tranche TVL below thresholds", "Junior redemption delay"],
  },
  {
    key: "data-confidence",
    title: "Data confidence",
    blurb: "How sure we are of inputs.",
    factors: ["Missing status or coverage", "Missing tranche TVL", "Stale snapshot"],
  },
  {
    key: "access-friction",
    title: "Access friction",
    blurb: "Who can get in and out.",
    factors: ["Venue tier", "Withdrawal underlying-dependent", "Access restricted or KYC"],
  },
] as const;

const SEVERITIES = [
  { key: "info", label: "info" },
  { key: "watch", label: "watch" },
  { key: "warning", label: "warning" },
  { key: "critical", label: "critical" },
] as const;

export function PenaltyTaxonomy() {
  return (
    <figure
      className={styles.fig}
      role="img"
      aria-label="Penalty taxonomy. Four risk categories: loss risk, liquidity friction, data confidence, and access friction. Each factor carries a severity tier, ordered info, watch, warning, then critical."
    >
      <div className={styles.root}>Base-asset Pharos score</div>

      <div className={styles.cols}>
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className={styles.col}>
            <div className={styles.colHead}>
              <strong className={styles.colTitle}>{cat.title}</strong>
              <span className={styles.colBlurb}>{cat.blurb}</span>
            </div>
            <ul className={styles.factors}>
              {cat.factors.map((f) => (
                <li key={f} className={styles.factor}>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendLabel}>Severity</span>
        <div className={styles.legendItems}>
          {SEVERITIES.map((sev, i) => (
            <span key={sev.key} className={styles.legendItem}>
              <i className={styles.swatch} data-sev={sev.key} aria-hidden="true" />
              {sev.label}
              {i < SEVERITIES.length - 1 ? (
                <span className={styles.legendArrow} aria-hidden="true">
                  &lt;
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
