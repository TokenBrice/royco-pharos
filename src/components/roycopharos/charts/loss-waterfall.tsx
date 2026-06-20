import styles from "./loss-waterfall.module.css";

/**
 * Loss waterfall — the vault dossier signature viz.
 *
 * A vertical capital stack: the Junior buffer (first-loss) sits at the bottom in
 * --warn, the Senior seat above it in --info. A dashed line marks the
 * required-coverage threshold; current drawdown eats up from the bottom in --bad.
 * You see your seat and how much cushion stands between a loss and the Senior.
 *
 * Ratios are coverage units (e.g. 1.6x buffer, 1.0x required). We normalize the
 * tallest input to the plot height so the stack always fits and stays labeled.
 * When a band is too thin to hold its label (a thin first-loss buffer, the
 * highest-stakes case), the label spills to a right-side callout with a leader
 * line instead of overprinting the threshold and floor labels.
 */
export function LossWaterfall({
  coverageRatio,
  requiredCoverageRatio,
  drawdownRatio,
}: {
  coverageRatio: number | null;
  requiredCoverageRatio: number | null;
  drawdownRatio: number | null;
}) {
  // Honest NR state: without a buffer there is nothing to draw.
  if (coverageRatio == null || !Number.isFinite(coverageRatio)) {
    return (
      <div className={styles.nr} role="img" aria-label="Loss waterfall not available: no coverage ratio reported.">
        <span className={styles.nrBadge}>NR</span>
        <p>No coverage ratio is reported for this market, so the loss waterfall cannot be drawn.</p>
      </div>
    );
  }

  const buffer = coverageRatio;
  const required = requiredCoverageRatio ?? null;
  const drawdown = drawdownRatio != null && Number.isFinite(drawdownRatio) ? Math.max(0, drawdownRatio) : 0;

  // Geometry. The "stack" is one exposure unit (the Senior seat, height = 1.0)
  // sitting on top of the Junior buffer (height = coverageRatio). The y-domain
  // spans 0..(buffer + seat), with a little headroom for the threshold line.
  const seat = 1; // Senior exposure unit, normalized
  const domainMax = Math.max(buffer + seat, (required ?? 0) + seat, 1.2) * 1.06;

  const baseW = 320;
  const H = 300;
  const padT = 18;
  const padB = 40;
  const padL = 96;
  const basePadR = 18;
  const plotH = H - padT - padB;
  const barX = padL;
  const barW = baseW - padL - basePadR;

  // value (a coverage unit, measured from the floor) -> y pixel
  const yFor = (v: number) => padT + plotH - (v / domainMax) * plotH;

  const floorY = yFor(0);
  const bufferTopY = yFor(buffer);
  const seatTopY = yFor(buffer + seat);
  const drawdownTopY = yFor(Math.min(drawdown, buffer + seat));
  const requiredY = required != null ? yFor(required) : null;

  // Band labels: keep a label inside its band when the band is tall enough;
  // otherwise spill it to a right-side callout so thin bands never overprint.
  type Band = { key: string; topY: number; botY: number; needs: number; lines: { text: string; cls: string }[] };
  const bands: Band[] = [
    { key: "seat", topY: seatTopY, botY: bufferTopY, needs: 22, lines: [{ text: "Senior seat", cls: styles.barLabel }] },
    {
      key: "buffer",
      topY: bufferTopY,
      botY: floorY,
      needs: 42,
      lines: [
        { text: "Junior buffer", cls: styles.barLabelStrong },
        { text: `${buffer.toFixed(2)}x · first-loss`, cls: styles.barSub },
      ],
    },
  ];

  const inBar = bands.filter((b) => b.botY - b.topY >= b.needs).map((b) => ({ ...b, midY: (b.topY + b.botY) / 2 }));
  const callouts = bands.filter((b) => b.botY - b.topY < b.needs).map((b) => ({ ...b, midY: (b.topY + b.botY) / 2 }));

  // Lay callouts out down the right rail, clamped so blocks never overlap.
  const lineH = 13;
  const railW = callouts.length ? 104 : 0;
  const W = baseW + railW;
  const railX = barX + barW + 16;
  callouts.sort((a, b) => a.midY - b.midY);
  let floorCursor = padT;
  const placed = callouts.map((c) => {
    const blockH = c.lines.length * lineH;
    const top = Math.min(Math.max(c.midY - blockH / 2, floorCursor + 4), H - padB - blockH);
    floorCursor = top + blockH;
    return { ...c, top, blockH };
  });

  const ariaParts = [
    `Loss waterfall. Junior buffer ${buffer.toFixed(2)} times the exposure unit, drawn first-loss at the bottom.`,
    `Senior seat sits above the buffer.`,
    required != null ? `Required coverage threshold at ${required.toFixed(2)} times.` : null,
    drawdown > 0 ? `Current drawdown ${drawdown.toFixed(2)} times, eating up from the floor.` : `No current drawdown.`,
  ].filter(Boolean);

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaParts.join(" ")}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Junior buffer (first-loss) */}
        <rect
          x={barX}
          y={bufferTopY}
          width={barW}
          height={floorY - bufferTopY}
          fill="var(--warn-wash)"
          stroke="var(--warn)"
          strokeWidth="1.5"
        />
        {/* Senior seat */}
        <rect
          x={barX}
          y={seatTopY}
          width={barW}
          height={bufferTopY - seatTopY}
          fill="var(--info-wash)"
          stroke="var(--info)"
          strokeWidth="1.5"
        />

        {/* Current drawdown eating up from the floor */}
        {drawdown > 0 ? (
          <rect
            x={barX}
            y={drawdownTopY}
            width={barW}
            height={floorY - drawdownTopY}
            fill="var(--bad)"
            opacity="0.78"
          >
            <title>{`Current drawdown: ${drawdown.toFixed(2)}x of the exposure unit`}</title>
          </rect>
        ) : null}

        {/* Required-coverage threshold (dashed) */}
        {requiredY != null ? (
          <g>
            <line
              x1={barX - 8}
              y1={requiredY}
              x2={barX + barW}
              y2={requiredY}
              stroke="var(--ink)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text x={barX - 12} y={requiredY + 4} textAnchor="end" className={styles.threshLabel}>
              required {required!.toFixed(2)}x
            </text>
          </g>
        ) : null}

        {/* In-bar labels (bands tall enough to hold their text) */}
        {inBar.map((b) => {
          const cx = barX + barW / 2;
          if (b.lines.length === 1) {
            return (
              <text key={b.key} x={cx} y={b.midY + 4} textAnchor="middle" className={b.lines[0].cls}>
                {b.lines[0].text}
              </text>
            );
          }
          return (
            <g key={b.key}>
              <text x={cx} y={b.midY - 4} textAnchor="middle" className={b.lines[0].cls}>
                {b.lines[0].text}
              </text>
              <text x={cx} y={b.midY + 12} textAnchor="middle" className={b.lines[1].cls}>
                {b.lines[1].text}
              </text>
            </g>
          );
        })}

        {/* Right-rail callouts (bands too thin to label in place) */}
        {placed.map((c) => (
          <g key={c.key}>
            <polyline
              points={`${barX + barW},${c.midY} ${railX - 6},${c.top + c.blockH / 2}`}
              fill="none"
              stroke="var(--hairline-strong)"
              strokeWidth="1"
            />
            {c.lines.map((ln, i) => (
              <text key={i} x={railX} y={c.top + lineH * (i + 1) - 3} textAnchor="start" className={ln.cls}>
                {ln.text}
              </text>
            ))}
          </g>
        ))}

        {/* Floor baseline */}
        <line x1={barX} y1={floorY} x2={barX + barW} y2={floorY} stroke="var(--hairline-strong)" strokeWidth="1" />
        <text x={barX + barW / 2} y={floorY + 22} textAnchor="middle" className={styles.floorLabel}>
          total loss
        </text>
      </svg>

      <p className={styles.annotation}>Senior is exposed only after the Junior buffer is gone.</p>

      <ul className={styles.legend} aria-hidden="true">
        <li>
          <i style={{ background: "var(--info)" }} /> Senior seat
        </li>
        <li>
          <i style={{ background: "var(--warn)" }} /> Junior buffer (first-loss)
        </li>
        <li>
          <i style={{ background: "var(--bad)" }} /> Current drawdown
        </li>
      </ul>
    </div>
  );
}
