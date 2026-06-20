import { titleCase } from "./format";
import type { PharosDependency, PharosDewsSignal } from "@/lib/roycopharos/types";
import styles from "./pharos-signals.module.css";

export function DewsPill({ dews, compact = false }: { dews: PharosDewsSignal | null | undefined; compact?: boolean }) {
  if (!dews) {
    return (
      <span className={styles.dewsPill} data-tone="neutral">
        DEWS not reported
      </span>
    );
  }
  const label = `${compact ? "" : "DEWS "}${titleCase(dews.status)}`;
  return (
    <span className={styles.dewsPill} data-tone={dewsTone(dews)}>
      {label}
      {dews.stressScore != null ? <span className={styles.dewsScore}>{Math.round(dews.stressScore)}</span> : null}
    </span>
  );
}

export function DewsNote({ dews }: { dews: PharosDewsSignal | null | undefined }) {
  if (!dews?.summary) return null;
  return <p className={styles.dewsNote}>{dews.summary}</p>;
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

export function dewsTone(dews: PharosDewsSignal | null | undefined) {
  const status = dews?.status.toLowerCase() ?? "";
  const score = dews?.stressScore ?? null;
  if (status.includes("critical") || status.includes("severe") || status.includes("warning") || (score != null && score >= 50)) {
    return "bad";
  }
  if (status.includes("watch") || status.includes("notice") || status.includes("elevated") || (score != null && score >= 25)) {
    return "watch";
  }
  if (status.includes("normal") || status.includes("clear") || status.includes("low") || (score != null && score < 25)) {
    return "good";
  }
  return "neutral";
}

function formatWeight(value: number) {
  if (!Number.isFinite(value)) return "NR";
  return `${value.toFixed(Math.abs(value) >= 10 ? 0 : 1)}% weight`;
}
