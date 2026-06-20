import { GradeBadge, gradeColorVar } from "./grade";
import { formatAge, titleCase } from "./format";
import type { PharosDependency, PharosDimension, PharosFreshnessFlags, PharosPegHealth } from "@/lib/roycopharos/types";
import styles from "./pharos-signals.module.css";

/**
 * Peg stability — the real Pharos depeg signal (replaces the fabricated DEWS).
 * Featured readout: the pegStability score/grade plus the structured depeg facts
 * (active depeg, historical event count, yield-bearing adjustment) from rawInputs.
 */
export function PegStabilityReadout({ peg }: { peg: PharosPegHealth | null }) {
  if (!peg || (peg.score == null && peg.depegEventCount == null && peg.activeDepeg == null)) {
    return <p className={styles.empty}>Pharos does not report peg-stability detail for this asset.</p>;
  }
  const facts: string[] = [];
  if (peg.activeDepeg === true) facts.push(`active depeg${peg.activeDepegBps != null ? ` ${Math.round(peg.activeDepegBps)} bps` : ""}`);
  else if (peg.activeDepeg === false) facts.push("no active depeg");
  if (peg.depegEventCount != null) facts.push(`${peg.depegEventCount} depeg event${peg.depegEventCount === 1 ? "" : "s"}`);
  return (
    <div className={styles.peg} data-alarm={peg.activeDepeg === true ? "" : undefined}>
      <div className={styles.pegHead}>
        <span className={styles.pegLabel}>Peg stability</span>
        <span className={styles.pegScore}>
          <span className="num">{peg.score == null ? "NR" : Math.round(peg.score)}</span>
          <GradeBadge grade={peg.grade} size="sm" />
        </span>
      </div>
      <p className={styles.pegFacts}>
        {facts.join(" · ") || "Peg detail reported by Pharos."}
        {peg.yieldBearing ? <span className={styles.pegNote}> · yield-bearing (appreciation excluded)</span> : null}
      </p>
    </div>
  );
}

/** Compact peg indicator for the overview ledger and the vault masthead. */
export function PegPill({ peg, compact = false }: { peg: PharosPegHealth | null | undefined; compact?: boolean }) {
  if (!peg || peg.score == null) {
    return (
      <span className={styles.pegPill} data-tone="neutral">
        {compact ? "Peg NR" : "Peg not rated"}
      </span>
    );
  }
  const tone = peg.activeDepeg === true ? "bad" : peg.score >= 70 ? "good" : peg.score >= 40 ? "watch" : "bad";
  return (
    <span className={styles.pegPill} data-tone={tone}>
      {compact ? "Peg" : "Peg stability"} {peg.grade ?? Math.round(peg.score)}
      {peg.activeDepeg === true ? <span className={styles.pegAlarm}>depeg</span> : null}
    </span>
  );
}

/**
 * The five Pharos report-card dimensions as 0–100 band-track bars coloured by grade.
 * Score + grade are always visible; the per-dimension detail and detailItems open on expand.
 */
export function DimensionBars({ dimensions }: { dimensions: PharosDimension[] | null | undefined }) {
  if (!dimensions || dimensions.length === 0) {
    return <p className={styles.empty}>No Pharos dimension breakdown reported for this asset.</p>;
  }
  return (
    <ul className={styles.dimensionList}>
      {dimensions.map((dimension) => (
        <DimensionRow key={dimension.key} dimension={dimension} />
      ))}
    </ul>
  );
}

function DimensionRow({ dimension }: { dimension: PharosDimension }) {
  const score = dimension.score;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const color = gradeColorVar(dimension.grade);
  const expandable = Boolean(dimension.detail) || dimension.items.length > 0;
  return (
    <li className={styles.dimensionRow}>
      <div className={styles.dimensionHead}>
        <span className={styles.dimensionLabel}>{dimension.label}</span>
        <span className={styles.dimensionScore}>
          <span className="num">{score == null ? "NR" : Math.round(score)}</span>
          <GradeBadge grade={dimension.grade} size="sm" />
        </span>
      </div>
      <div
        className={styles.dimensionTrack}
        role="img"
        aria-label={`${dimension.label} ${score == null ? "not rated" : `${Math.round(score)} of 100`}, grade ${dimension.grade ?? "NR"}`}
      >
        <span className={styles.dimensionFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      {expandable ? (
        <details className={styles.dimensionDetail}>
          <summary className={styles.dimensionSummary}>Detail</summary>
          {dimension.detail ? <p className={styles.dimensionDetailText}>{dimension.detail}</p> : null}
          {dimension.items.length > 0 ? (
            <ul className={styles.dimensionItems}>
              {dimension.items.map((item, index) => (
                <li key={`${dimension.key}-item-${index}`}>
                  {item.label ? <span className={styles.itemLabel}>{item.label}</span> : null}
                  <span className={styles.itemValue}>{item.value ?? item.detail ?? ""}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
    </li>
  );
}

/**
 * "Just Pharos" source badge: reads `Pharos · as of {age}` on the happy path, and only
 * adds a qualifier (fallback / drift / stale) when this specific asset is degraded.
 */
export function PharosSourceBadge({ ageSeconds, freshness }: { ageSeconds: number | null; freshness: PharosFreshnessFlags | null | undefined }) {
  const degraded = freshness?.fallback ? "fallback" : freshness?.collateralDrift ? "drift" : freshness?.stale ? "stale" : null;
  return (
    <span className={styles.sourceBadge} data-degraded={degraded ?? undefined} title={degraded ? `Pharos data for this asset is on ${degraded}` : "Live Pharos read"}>
      <span className={styles.sourceDot} aria-hidden="true" />
      Pharos
      {degraded ? <span className={styles.sourceFlag}>{degraded}</span> : null}
      {ageSeconds != null ? <span className={styles.sourceAge}>· as of {formatAge(ageSeconds)} ago</span> : null}
    </span>
  );
}

export function DependencyList({
  dependencies,
  empty = "No upstream dependency detail reported by Pharos.",
}: {
  dependencies: PharosDependency[] | null | undefined;
  empty?: string;
}) {
  if (!dependencies || dependencies.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <ul className={styles.dependencyList}>
      {dependencies.map((dependency) => (
        <li className={styles.dependencyItem} key={`${dependency.id ?? dependency.name}-${dependency.weightPct ?? "weight"}`}>
          <span className={styles.dependencyName}>
            {dependency.pharosUrl ? (
              <a href={dependency.pharosUrl} target="_blank" rel="noreferrer">
                {dependency.name}
              </a>
            ) : (
              <strong>{dependency.name}</strong>
            )}
            {dependency.symbol ? <span className={styles.dependencySymbol}>{dependency.symbol}</span> : null}
          </span>
          <span className={styles.dependencyMeta}>
            {dependency.weightPct != null ? <span className="num">{formatWeight(dependency.weightPct)}</span> : null}
            {dependency.safetyScore != null ? (
              <span>
                Pharos <span className="num">{Math.round(dependency.safetyScore)}</span>
                {dependency.safetyGrade ? ` ${dependency.safetyGrade}` : ""}
              </span>
            ) : dependency.safetyGrade ? (
              <span>Pharos {dependency.safetyGrade}</span>
            ) : null}
          </span>
          {dependency.relationship ? <span className={styles.dependencyRelationship}>{titleCase(dependency.relationship)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function PharosProfileLink({ href }: { href: string | null | undefined }) {
  if (!href) return null;
  return (
    <a className={styles.pharosLink} href={href} target="_blank" rel="noreferrer">
      Open Pharos dossier
    </a>
  );
}

function formatWeight(value: number) {
  if (!Number.isFinite(value)) return "NR";
  return `${value.toFixed(Math.abs(value) >= 10 ? 0 : 1)}% weight`;
}
