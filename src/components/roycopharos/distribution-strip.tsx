import { GRADE_LETTERS, gradeIndex } from "./grade";

/** A single A–F count bar: the whole book's risk shape at a glance. */
export function DistributionStrip({
  grades,
  label,
  showLegend = false,
}: {
  grades: (string | null | undefined)[];
  label?: string;
  showLegend?: boolean;
}) {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, NR: 0 };
  for (const g of grades) {
    const i = gradeIndex(g);
    if (i == null) counts.NR += 1;
    else counts[GRADE_LETTERS[i]] += 1;
  }
  const order = [...GRADE_LETTERS, "NR"];
  const segs = order.filter((g) => counts[g] > 0).map((g) => ({ g, n: counts[g] }));
  const total = grades.length;
  const summary = segs.map((s) => `${s.g === "NR" ? "Not rated" : `Grade ${s.g}`} ${s.n}`).join(", ");
  const ariaLabel = `${label ?? `Grade distribution across ${total} tranches`}: ${summary}.`;

  return (
    <div>
      <div className="dist-strip" role="img" aria-label={ariaLabel}>
        {segs.map((s) => (
          <span key={s.g} className="dist-strip__seg" data-grade={s.g} style={{ flexGrow: s.n }} title={`${s.g}: ${s.n}`}>
            {s.n}
          </span>
        ))}
      </div>
      {showLegend ? (
        <div className="dist-legend">
          {segs.map((s) => (
            <span key={s.g}>
              <i style={{ background: `var(--grade-${s.g.toLowerCase()})` }} />
              {s.g === "NR" ? "Not rated" : `Grade ${s.g}`} · {s.n}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
