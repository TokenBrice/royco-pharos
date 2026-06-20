import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Braces, Database, Gauge, type LucideIcon, ShieldAlert, ShieldCheck } from "lucide-react";
import { getHealth } from "@/lib/roycopharos/repository";
import { formatTimestampUtc, titleCase } from "@/components/roycopharos/format";
import { RelativeTime } from "@/components/roycopharos/relative-time";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Data health · RoycoPharos Risk",
  description: "Whether the RoycoPharos grades you're reading are current and complete right now.",
};

type FreshKey = "royco" | "pharos" | "score";

const SOURCES: { key: FreshKey; name: string; origin: string; tag: string; blurb: string; icon: LucideIcon }[] = [
  {
    key: "royco",
    name: "Tranche data",
    origin: "Royco Dawn",
    tag: "Royco",
    blurb: "Markets, APYs, utilization, and coverage for every direct tranche.",
    icon: Database,
  },
  {
    key: "pharos",
    name: "Safety data",
    origin: "Pharos",
    tag: "Pharos",
    blurb: "Underlying stablecoin safety scores that anchor each Safety grade.",
    icon: ShieldCheck,
  },
  {
    key: "score",
    name: "Computed scores",
    origin: "Royco risk engine",
    tag: "Scores",
    blurb: "Safety and Opportunity grades derived from the two sources above.",
    icon: Gauge,
  },
];

const FRESHNESS: Record<string, { label: string; cls: string }> = {
  fresh: { label: "Fresh", cls: "badge good" },
  degraded: { label: "Behind", cls: "badge watch" },
  stale: { label: "Stale", cls: "badge bad" },
};

const listFormatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

export default async function HealthPage() {
  const health = await getHealth();
  const renderedAt = Math.floor(Date.now() / 1000);

  const sourceTime: Record<FreshKey, number | null> = {
    royco: health.meta.royco.fetchedAt ?? health.meta.royco.sourceUpdatedAt ?? health.generatedAt,
    pharos: health.meta.pharos.fetchedAt ?? health.meta.pharos.sourceUpdatedAt ?? health.generatedAt,
    score: health.meta.score.computedAt ?? health.generatedAt,
  };

  const behind = SOURCES.filter((s) => health.freshness[s.key] !== "fresh");
  const behindLabel = listFormatter.format(behind.map((s) => s.tag));

  const tone = !health.ok ? "bad" : health.degraded ? "watch" : "good";
  const refreshed = <RelativeTime time={health.generatedAt} now={renderedAt} />;

  const verdict =
    tone === "bad"
      ? {
          icon: ShieldAlert,
          title: "Coverage is incomplete",
          body: (
            <>
              Only {health.trancheCount} of the expected 18 tranches are present, so some grades may be missing. Last
              refreshed {refreshed}.
            </>
          ),
        }
      : tone === "watch"
        ? {
            icon: ShieldAlert,
            title:
              behind.length === 0
                ? "Current, last sync ran degraded"
                : behind.length === 1
                  ? "Current, one feed is behind"
                  : `Current, ${behind.length} feeds are behind`,
            body: (
              <>
                {behind.length === 0
                  ? `The last sync finished in a degraded state, but all ${health.trancheCount} tranches are still scored.`
                  : `${behindLabel} ${behind.length === 1 ? "is behind its feed" : "are behind their feeds"}, but all ${health.trancheCount} tranches are still scored.`}{" "}
                Last refreshed {refreshed}.
              </>
            ),
          }
        : {
            icon: ShieldCheck,
            title: "Everything is current",
            body: (
              <>
                All {health.trancheCount} tranches across {health.marketCount} markets are scored from current data. Last
                refreshed {refreshed}.
              </>
            ),
          };

  const flags: string[] = [];
  if (health.nrCount) flags.push(`${health.nrCount} unrated`);
  if (health.lowConfidenceCount) flags.push(`${health.lowConfidenceCount} low-confidence`);
  if (health.staleCount) flags.push(`${health.staleCount} stale`);
  if (health.conflictCount) flags.push(`${health.conflictCount} with a mapping conflict`);

  const coverageLede =
    flags.length === 0
      ? `All ${health.trancheCount} tranches are mapped to an underlying asset and scored. None are unrated, low-confidence, or stale.`
      : `${health.mappedTrancheCount} of ${health.trancheCount} tranches are mapped and scored. Flagged: ${listFormatter.format(flags)}.`;

  const coverageMetrics: { label: string; value: string; kind?: "exception"; flag?: "watch" | "bad" | null }[] = [
    { label: "Tranches", value: String(health.trancheCount) },
    { label: "Markets", value: String(health.marketCount) },
    {
      label: "Mapped",
      value: `${health.mappedTrancheCount}/${health.trancheCount}`,
      flag: health.mappedTrancheCount < health.trancheCount ? "watch" : null,
    },
    { label: "Unrated", value: String(health.nrCount), kind: "exception", flag: health.nrCount > 0 ? "bad" : null },
    {
      label: "Low confidence",
      value: String(health.lowConfidenceCount),
      kind: "exception",
      flag: health.lowConfidenceCount > 0 ? "watch" : null,
    },
    { label: "Stale scores", value: String(health.staleCount), kind: "exception", flag: health.staleCount > 0 ? "watch" : null },
    {
      label: "Conflicts",
      value: String(health.conflictCount),
      kind: "exception",
      flag: health.conflictCount > 0 ? "bad" : null,
    },
  ];

  const run = health.lastRun;
  const VerdictIcon = verdict.icon;

  return (
    <main className="page-shell">
      <header className={styles.intro}>
        <h1>Data health</h1>
        <p>
          Whether the grades you&apos;re reading are current and complete. This view pulls tranche data from Royco Dawn
          and safety data from Pharos, then computes Royco seat-level scores. This is the state of all three right now.
        </p>
      </header>

      <section className={styles.verdict} data-tone={tone} aria-label="Overall data health">
        <span className={styles.seal} aria-hidden="true">
          <VerdictIcon />
        </span>
        <div className={styles.verdictBody}>
          <h2>{verdict.title}</h2>
          <p>{verdict.body}</p>
        </div>
        <div className={styles.feeds}>
          {SOURCES.map(({ key, tag }) => {
            const status = health.freshness[key] ?? "stale";
            const badge = FRESHNESS[status] ?? FRESHNESS.stale;
            const dotTone = status === "fresh" ? "good" : status === "stale" ? "bad" : "watch";
            return (
              <span key={key} className={styles.feed} data-tone={dotTone}>
                <span className={styles.feedDot} aria-hidden="true" />
                <b>{tag}</b>
                {badge.label}
              </span>
            );
          })}
        </div>
      </section>

      <section className={styles.block} aria-labelledby="sources-title">
        <div className="section-heading-row">
          <h2 id="sources-title" className="section-title">
            Where the data comes from
          </h2>
          <p className={styles.blockNote}>Ages count up live as each feed gets older.</p>
        </div>
        <div className={styles.sources}>
          {SOURCES.map(({ key, name, origin, blurb, icon: Icon }) => {
            const status = health.freshness[key] ?? "stale";
            const badge = FRESHNESS[status] ?? FRESHNESS.stale;
            const warning = health.meta[key].warning;
            return (
              <article key={key} className={styles.source}>
                <div className={styles.sourceTop}>
                  <span className={styles.sourceIcon}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span className={badge.cls}>{badge.label}</span>
                </div>
                <h3>
                  {name} <span className={styles.origin}>{origin}</span>
                </h3>
                <p className={styles.blurb}>{blurb}</p>
                <p className={styles.updated}>
                  Updated <RelativeTime time={sourceTime[key]} now={renderedAt} />
                </p>
                {warning ? <p className={styles.sourceWarn}>{warning}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.block} aria-labelledby="coverage-title">
        <h2 id="coverage-title" className="section-title">
          Coverage
        </h2>
        <div className={styles.coverage}>
          <p className={styles.coverageLede}>{coverageLede}</p>
          <div className={styles.metrics}>
            {coverageMetrics.map((metric) => (
              <div
                key={metric.label}
                className={styles.metric}
                data-kind={metric.kind ?? undefined}
                data-flag={metric.flag ?? undefined}
              >
                <span className="metric-label">{metric.label}</span>
                <span className="metric-value">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.foot}>
        <p className={styles.lastSync}>
          {run ? (
            <>
              <span>Last sync</span>
              <span className={run.status === "ok" ? "badge good" : "badge watch"}>
                {titleCase(run.status ?? "unknown")}
              </span>
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
              <span>
                {run.published ? "published" : "held"}{" "}
                <RelativeTime time={run.publishedAt ?? run.completedAt} now={renderedAt} />
              </span>
              {run.runId ? (
                <>
                  <span className={styles.dot} aria-hidden="true">
                    ·
                  </span>
                  <span className={styles.runId} title={`Run ${run.runId}`}>
                    run {run.runId.slice(0, 8)}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            <span>No sync run has been recorded yet.</span>
          )}
        </p>
        <div className={styles.footLinks}>
          <a className="text-link" href="/api/health">
            <Braces size={14} aria-hidden="true" />
            Raw JSON
          </a>
          <Link className="text-link" href="/methodology">
            <ArrowUpRight size={14} aria-hidden="true" />
            How grades are built
          </Link>
        </div>
      </footer>

      <p className={`subtle ${styles.snapshot}`}>
        Snapshot generated {formatTimestampUtc(health.generatedAt)}.
      </p>
    </main>
  );
}
