import { GRADE_LETTERS, gradeIndex, GradeBadge, SeatRing } from "./grade";
import { AssetLogo } from "./asset-logo";
import { formatUsd } from "./format";

export type ScatterTranche = {
  trancheId: string;
  marketKey: string;
  marketName: string;
  side: "senior" | "junior";
  safetyScore: number | null;
  opportunityScore: number | null;
  safetyGrade: string | null;
  opportunityGrade: string | null;
  tvlUsd: number | null;
  depositTokenSymbol: string | null;
};

/** The most "richly paid for risk" tranche: largest Opportunity-minus-Safety score gap. */
export function mostDivergent<T extends ScatterTranche>(tranches: T[]): { tranche: T; gap: number } | null {
  let best: { tranche: T; gap: number } | null = null;
  for (const t of tranches) {
    if (t.safetyScore == null || t.opportunityScore == null) continue;
    const gap = Math.round(t.opportunityScore - t.safetyScore);
    if (best == null || gap > best.gap) best = { tranche: t, gap };
  }
  return best && best.gap > 0 ? best : null;
}

const TICKS = [0, 25, 50, 75, 100] as const;
// Percentages of the plot box: high Safety → right, high Opportunity → top.
const xPct = (score: number) => score;
const yPct = (score: number) => 100 - score;

// Every marker is one uniform size so the stablecoin logos stay legible and consistent;
// TVL lives in the hover detail rather than the marker diameter.
const MARKER = 38; // px diameter

/**
 * Safety (x, improves right) × Opportunity (y, improves up) for every tranche.
 * Each marker is the tranche's stablecoin logo; the ring color encodes the Safety band and
 * the ring line-style encodes the seat (solid = Senior/protected, dashed = Junior/first-loss).
 * The upper-left region is "richly paid for risk".
 */
export function OpportunityScatter({ tranches }: { tranches: ScatterTranche[] }) {
  const pts = tranches
    .map((t) => ({ t, s: t.safetyScore, o: t.opportunityScore, band: gradeIndex(t.safetyGrade) }))
    .filter(
      (p): p is { t: ScatterTranche; s: number; o: number; band: number | null } =>
        p.s != null && Number.isFinite(p.s) && p.o != null && Number.isFinite(p.o),
    );

  // Group near-coincident markers (rounded to the nearest 5 score points) so logos spread
  // around their shared cell instead of stacking into an unreadable pile.
  const groups = new Map<string, typeof pts>();
  for (const p of pts) {
    const k = `${Math.round(p.s / 5) * 5}:${Math.round(p.o / 5) * 5}`;
    const arr = groups.get(k);
    if (arr) arr.push(p);
    else groups.set(k, [p]);
  }

  const star = mostDivergent(tranches);
  const placed = pts.map((p) => {
    const k = `${Math.round(p.s / 5) * 5}:${Math.round(p.o / 5) * 5}`;
    const group = groups.get(k)!;
    const idx = group.indexOf(p);
    const n = group.length;
    const spread = n > 1 ? Math.min(6, 3 + n * 0.9) : 0; // x-percent radius
    const angle = (idx / n) * Math.PI * 2;
    const left = Math.max(2.5, Math.min(97.5, xPct(p.s) + Math.cos(angle) * spread));
    const top = Math.max(3, Math.min(97, yPct(p.o) + Math.sin(angle) * spread * 1.6)); // 1.6 ≈ plot aspect
    return {
      ...p,
      left,
      top,
      d: MARKER,
      place: top < 24 ? "below" : "above",
      align: left < 17 ? "left" : left > 83 ? "right" : "center",
      isStar: star != null && star.tranche.trancheId === p.t.trancheId,
    };
  });

  const ariaLabel = star
    ? `Scatter of ${pts.length} tranches by Safety and Opportunity score. Most divergent: ${star.tranche.marketName} ${star.tranche.side}, Safety ${star.tranche.safetyScore}, Opportunity ${star.tranche.opportunityScore}.`
    : `Scatter of ${pts.length} tranches by Safety and Opportunity score.`;

  return (
    <figure className="oscatter">
      <div className="oscatter__frame">
        <span className="oscatter__axis-title oscatter__axis-title--y">Opportunity score →</span>

        <div className="oscatter__ticks oscatter__ticks--y" aria-hidden="true">
          {TICKS.map((score) => (
            <span key={`yl-${score}`} className="num" style={{ top: `${yPct(score)}%` }}>
              {score}
            </span>
          ))}
        </div>

        <div className="oscatter__plot">
          <svg className="oscatter__grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {/* money-shot region: high opportunity, low safety */}
            <polygon points="0,0 100,0 0,100" fill="var(--info-wash)" opacity="0.6" />
            {/* grid */}
            {TICKS.map((score) => (
              <g key={`grid-${score}`}>
                <line x1={xPct(score)} y1="0" x2={xPct(score)} y2="100" stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1={yPct(score)} x2="100" y2={yPct(score)} stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </g>
            ))}
            {/* fairly-priced diagonal */}
            <line x1="100" y1="0" x2="0" y2="100" stroke="var(--hairline-strong)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          </svg>

          <span className="oscatter__region" aria-hidden="true">
            Yield outruns risk
          </span>

          <div className="oscatter__points">
            {placed.map((p) => {
              const letter = p.band == null ? "NR" : GRADE_LETTERS[p.band];
              const seatLabel = p.t.side === "senior" ? "Senior, protected" : "Junior, first-loss";
              return (
                <a
                  key={p.t.trancheId}
                  className="oscatter__pt"
                  href={`/markets/${encodeURIComponent(p.t.marketKey)}`}
                  // Only the headline "best-paid risk" marker is a keyboard stop; the rest of the
                  // data is reachable via the table fallback below, so 18 tab stops aren't needed.
                  tabIndex={p.isStar ? 0 : -1}
                  aria-hidden={p.isStar ? undefined : true}
                  aria-label={
                    p.isStar
                      ? `Best-paid risk: ${p.t.marketName}, ${seatLabel}. Safety ${p.t.safetyScore}, Opportunity ${p.t.opportunityScore}. View market.`
                      : undefined
                  }
                  data-grade={letter}
                  data-seat={p.t.side}
                  data-star={p.isStar ? "" : undefined}
                  style={{ left: `${p.left}%`, top: `${p.top}%`, ["--d" as string]: `${p.d}px` }}
                >
                  <SeatRing seat={p.t.side} grade={p.t.safetyGrade} className="oscatter__ring" />
                  <span className="oscatter__logo">
                    <AssetLogo symbol={p.t.depositTokenSymbol} size={Math.round(p.d * 0.64)} />
                  </span>
                  <span className="oscatter__tip" data-place={p.place} data-align={p.align}>
                    <span className="oscatter__tip-head">
                      <AssetLogo symbol={p.t.depositTokenSymbol} size={20} />
                      <strong>{p.t.marketName}</strong>
                    </span>
                    <span className="oscatter__tip-seat" data-seat={p.t.side}>
                      {seatLabel}
                    </span>
                    <span className="oscatter__tip-grades">
                      <span>
                        <span className="oscatter__tip-k">Safety</span>
                        <GradeBadge grade={p.t.safetyGrade} size="sm" />
                      </span>
                      <span>
                        <span className="oscatter__tip-k">Opp</span>
                        <GradeBadge grade={p.t.opportunityGrade} size="sm" />
                      </span>
                      <span>
                        <span className="oscatter__tip-k">TVL</span>
                        <span className="num">{formatUsd(p.t.tvlUsd)}</span>
                      </span>
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        </div>

        <span className="oscatter__corner" aria-hidden="true" />
        <div className="oscatter__ticks oscatter__ticks--x" aria-hidden="true">
          {TICKS.map((score) => (
            <span key={`xl-${score}`} className="num" style={{ left: `${xPct(score)}%` }}>
              {score}
            </span>
          ))}
        </div>
        <span className="oscatter__axis-title oscatter__axis-title--x">Safety score →</span>
      </div>

      <div className="oscatter__legend" aria-hidden="true">
        <span className="oscatter__legend-item">
          <svg className="oscatter__legend-ring" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          Senior · protected
        </span>
        <span className="oscatter__legend-item">
          <svg className="oscatter__legend-ring" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="4" pathLength={120} strokeDasharray="6 4" />
          </svg>
          Junior · first-loss
        </span>
        <span className="oscatter__legend-item">
          <span className="oscatter__legend-ramp">
            <i style={{ background: "var(--grade-a)" }} />
            <i style={{ background: "var(--grade-c)" }} />
            <i style={{ background: "var(--grade-f)" }} />
          </span>
          Ring color = Safety grade
        </span>
      </div>

      {/* The same data the chart encodes visually, for screen readers and keyboard users.
          The hidden table is wrapped (not itself .sr-only): a <table>'s intrinsic min-width
          overrides width:1px, so on a narrow viewport a bare .sr-only table leaks ~900px into
          the document scroll region. The wrapper clips it to a 1px box. */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th>Tranche</th>
              <th>Seat</th>
              <th>Safety score</th>
              <th>Opportunity score</th>
              <th>TVL</th>
            </tr>
          </thead>
          <tbody>
            {tranches.map((t) => (
              <tr key={t.trancheId}>
                <td>{t.marketName}</td>
                <td>{t.side}</td>
                <td>{t.safetyScore ?? "NR"}</td>
                <td>{t.opportunityScore ?? "NR"}</td>
                <td>{formatUsd(t.tvlUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
