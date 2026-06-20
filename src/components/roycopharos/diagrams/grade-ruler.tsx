import { GradeBadge } from "../grade";
import type { GradeBand } from "@/lib/roycopharos/types";
import styles from "./grade-ruler.module.css";

/**
 * One calibrated strip 0..max, segmented into the grade bands using the ramp
 * colors. Segment width is proportional to its score range; cutoffs labelled in
 * mono. This is the Rosetta stone linking a number to a color and a letter.
 */
function Ruler({
  title,
  unit,
  bands,
  max,
  topOpen,
  ariaLabel,
}: {
  title: string;
  unit: string;
  bands: GradeBand[];
  max: number;
  topOpen?: boolean;
  ariaLabel: string;
}) {
  // bands arrive best -> worst (A first). Each band runs [min, nextMin).
  // The lowest band runs [0, its-min-of-the-band-above) — i.e. F covers 0..nextMin.
  const sorted = [...bands].sort((a, b) => a.min - b.min); // worst -> best by min
  const segs = sorted.map((band, i) => {
    const lower = band.min;
    const upper = i < sorted.length - 1 ? sorted[i + 1].min : max;
    return { grade: band.grade, lower, upper, span: upper - lower };
  });

  return (
    <figure className={styles.ruler} role="img" aria-label={ariaLabel}>
      <figcaption className={styles.rulerHead}>
        <span className={styles.rulerTitle}>{title}</span>
        <span className={styles.rulerUnit}>{unit}</span>
      </figcaption>

      <div className={styles.strip}>
        {segs.map((seg) => (
          <div
            key={seg.grade}
            className={styles.seg}
            data-grade={seg.grade}
            style={{ flexGrow: seg.span }}
            title={`Grade ${seg.grade}: ${seg.lower} to ${seg.upper}${unit.includes("%") ? "%" : ""}`}
          >
            <GradeBadge grade={seg.grade} size="sm" />
          </div>
        ))}
      </div>

      <div className={styles.ticks}>
        {segs.map((seg) => (
          <span key={seg.grade} className={`mono ${styles.tick}`} style={{ flexGrow: seg.span }}>
            {seg.lower}
          </span>
        ))}
        <span className={`mono ${styles.tickEnd}`}>{topOpen ? `${max}+` : max}</span>
      </div>
    </figure>
  );
}

export function GradeRuler({
  safetyBands,
  opportunityBands,
}: {
  safetyBands: GradeBand[];
  opportunityBands: GradeBand[];
}) {
  return (
    <div className={styles.wrap}>
      <Ruler
        title="Safety score"
        unit="0 to 100"
        bands={safetyBands}
        max={100}
        ariaLabel="Safety ruler: scores 0 to 100 map to grades F through A. A at 70 and up, B at 60, C at 50, D at 40, E at 30, F below 30."
      />
      <Ruler
        title="Opportunity"
        unit="net yield %"
        bands={opportunityBands}
        max={16}
        topOpen
        ariaLabel="Opportunity ruler: net yield percent maps to grades F through A. A at 12 percent and up, B at 8, C at 5, D at 3, E at 1.5, F below 1.5."
      />
    </div>
  );
}
