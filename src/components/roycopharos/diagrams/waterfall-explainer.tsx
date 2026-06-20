import styles from "./waterfall-explainer.module.css";

/**
 * Standalone loss-waterfall worked example (own SVG, not the dossier chart).
 * A stacked bar: Junior buffer (first-loss, --warn) at the bottom, Senior
 * (--info) above. A drawdown arrow shows losses eating up from the bottom, so
 * the Junior buffer absorbs them before the Senior is ever touched.
 */
export function WaterfallExplainer() {
  // illustrative worked-example proportions of total capital
  const junior = 30; // first-loss buffer
  const senior = 70;
  const drawdown = 18; // current losses, smaller than the junior buffer

  const W = 360;
  const H = 220;
  const barX = 150;
  const barW = 92;
  const top = 16;
  const bottom = 16;
  const plotH = H - top - bottom;

  const yFor = (fromBottomPct: number) => top + plotH * (1 - fromBottomPct / 100);

  const juniorY = yFor(junior);
  const juniorH = plotH * (junior / 100);
  const seniorY = top;
  const seniorH = plotH * (senior / 100);
  const drawTop = yFor(drawdown);
  const drawH = plotH * (drawdown / 100);

  return (
    <figure className={styles.fig}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Loss waterfall worked example. The Junior buffer is the bottom ${junior} percent of capital and absorbs losses first. The Senior seat is the top ${senior} percent. A drawdown of ${drawdown} percent eats up from the bottom and is fully absorbed by the Junior buffer, so the Senior is untouched.`}
      >
        {/* Senior (top) */}
        <rect x={barX} y={seniorY} width={barW} height={seniorH} rx="4" className={styles.senior} />
        {/* Junior buffer (bottom, first-loss) */}
        <rect x={barX} y={juniorY} width={barW} height={juniorH} rx="4" className={styles.junior} />

        {/* current drawdown eating up from the bottom */}
        <rect x={barX} y={drawTop} width={barW} height={drawH} className={styles.draw} />

        {/* segment labels */}
        <text x={barX + barW / 2} y={seniorY + seniorH / 2} className={styles.segLabel} textAnchor="middle" dominantBaseline="middle">
          Senior
        </text>
        <text x={barX + barW / 2} y={juniorY + juniorH / 2 - 5} className={styles.segLabelDark} textAnchor="middle" dominantBaseline="middle">
          Junior
        </text>
        <text x={barX + barW / 2} y={juniorY + juniorH / 2 + 9} className={styles.segSub} textAnchor="middle" dominantBaseline="middle">
          first-loss
        </text>

        {/* drawdown arrow rising from the bottom */}
        <defs>
          <marker id="wf-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" className={styles.arrowHead} />
          </marker>
        </defs>
        <line
          x1={barX - 22}
          y1={top + plotH}
          x2={barX - 22}
          y2={drawTop + 4}
          className={styles.arrow}
          markerEnd="url(#wf-arrow)"
        />
        <text x={barX - 30} y={(top + plotH + drawTop) / 2} className={styles.arrowLabel} textAnchor="end" dominantBaseline="middle">
          losses
        </text>

        {/* dashed line where the current drawdown reaches */}
        <line x1={barX} y1={drawTop} x2={barX + barW + 14} y2={drawTop} className={styles.threshold} />
        <text x={barX + barW + 18} y={drawTop} className={styles.thresholdLabel} dominantBaseline="middle">
          drawdown
        </text>
      </svg>
      <figcaption className={styles.caption}>
        Losses eat the Junior buffer from the bottom first. The Senior seat is exposed only after the Junior buffer is
        gone. Junior&apos;s pay for taking that first loss is its yield, rewarded in Opportunity, not in Safety.
      </figcaption>
    </figure>
  );
}
