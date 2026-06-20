import Link from "next/link";
import { OverviewTable } from "@/components/roycopharos/overview-table";
import { DistributionStrip } from "@/components/roycopharos/distribution-strip";
import { OpportunityScatter } from "@/components/roycopharos/opportunity-scatter";
import { AssetLogo } from "@/components/roycopharos/asset-logo";
import { ScorePair } from "@/components/roycopharos/grade";
import { formatAge, formatPct, titleCase } from "@/components/roycopharos/format";
import { getRoycoPharosSnapshot } from "@/lib/roycopharos/repository";
import { buildChangeFeed } from "@/lib/roycopharos/snapshot";
import type { RoycoTrancheView } from "@/lib/roycopharos/types";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/** Best Safety score, tie-broken by APY. The top-right dot in the scatter. */
function safestTranche(tranches: RoycoTrancheView[]): RoycoTrancheView | null {
  let best: RoycoTrancheView | null = null;
  for (const t of tranches) {
    if (t.safetyScore == null) continue;
    if (best == null) {
      best = t;
      continue;
    }
    if (t.safetyScore > (best.safetyScore ?? -1)) best = t;
  }
  return best;
}

/** The largest positive Opportunity-minus-Safety score gap. */
function mostDivergent(tranches: RoycoTrancheView[]): { tranche: RoycoTrancheView; gap: number } | null {
  let best: { tranche: RoycoTrancheView; gap: number } | null = null;
  for (const tranche of tranches) {
    if (tranche.safetyScore == null || tranche.opportunityScore == null) continue;
    const gap = Math.round(tranche.opportunityScore - tranche.safetyScore);
    if (best == null || gap > best.gap) best = { tranche, gap };
  }
  return best && best.gap > 0 ? best : null;
}

function topOpportunityGaps(tranches: RoycoTrancheView[], limit = 3) {
  return tranches
    .flatMap((tranche) => {
      if (tranche.safetyScore == null || tranche.opportunityScore == null) return [];
      const gap = Math.round(tranche.opportunityScore - tranche.safetyScore);
      return gap > 0 ? [{ tranche, gap }] : [];
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, limit);
}

/** One lead card: a tranche framed by its role (safest seat / largest grade gap). */
function SignalCard({ kicker, tranche, reason }: { kicker: string; tranche: RoycoTrancheView; reason: string }) {
  const apy = formatPct(
    tranche.apyCurrentPct != null && tranche.apyCurrentPct > 0 ? tranche.apyCurrentPct : tranche.apy7dPct,
  );
  return (
    <Link className={styles.signalCard} href={`/markets/${encodeURIComponent(tranche.marketKey)}`}>
      <span className={styles.signalKicker}>{kicker}</span>
      <div className={styles.signalLead}>
        <AssetLogo symbol={tranche.depositTokenSymbol} size={34} priority />
        <div className={styles.signalName}>
          <strong>
            {tranche.marketName} {titleCase(tranche.side)}
          </strong>
          <span>{tranche.depositTokenSymbol ?? "unmapped base asset"}</span>
        </div>
      </div>
      <div className={styles.signalMetrics}>
        <ScorePair
          safetyScore={tranche.safetyScore}
          opportunityScore={tranche.opportunityScore}
          safetyGrade={tranche.safetyGrade}
          opportunityGrade={tranche.opportunityGrade}
          status={tranche.scoreStatus}
          size="md"
        />
        <span className={styles.signalApy}>
          {apy}
          <small>current APY</small>
        </span>
      </div>
      <p className={styles.signalReason}>{reason}</p>
    </Link>
  );
}

export default async function HomePage() {
  const snapshot = await getRoycoPharosSnapshot();

  if (snapshot.tranches.length === 0) {
    return (
      <main className={`page-shell ${styles.homeShell}`}>
        <section className={styles.emptyState}>
          <h1>No snapshot yet</h1>
          <p>
            No published Royco Dawn snapshot has been ingested. Run <code>npm run sync</code> to collect Royco and Pharos
            data, then reload this page to see all 18 tranches rated.
          </p>
        </section>
      </main>
    );
  }

  const trancheCount = snapshot.tranches.length;
  const marketCount = snapshot.markets.length;
  const ratedCount = snapshot.tranches.filter((t) => t.safetyScore != null).length;
  const nrCount = snapshot.tranches.filter((t) => t.scoreStatus === "nr" || t.safetyScore == null).length;
  const lowConfidenceCount = snapshot.tranches.filter((t) => t.scoreStatus === "low_confidence").length;
  const staleScoreCount = snapshot.tranches.filter((t) => t.scoreStatus === "stale").length;
  const unmappedCount = snapshot.tranches.filter((t) => t.mappingStatus === "unmapped").length;
  const conflictCount = snapshot.tranches.filter((t) => t.mappingStatus === "conflict").length;

  // Two complementary leads, safety-first: the protected seat a cautious depositor should
  // start from, then the largest Opportunity/Safety gap for those comparing yield to cushion.
  const safest = safestTranche(snapshot.tranches);
  const divergent = mostDivergent(snapshot.tranches);
  // Don't show the same tranche twice if the safest also happens to be the most divergent.
  const showDivergent = divergent != null && divergent.tranche.trancheId !== safest?.trancheId;
  const divergentReason = divergent
    ? `Opportunity is ${divergent.gap} points above Safety: yield stands out relative to a lower Safety score.`
    : null;
  const highlightTrancheIds = [safest?.trancheId, showDivergent ? divergent?.tranche.trancheId : null].filter(
    (id): id is string => Boolean(id),
  );
  const topGaps = topOpportunityGaps(snapshot.tranches);

  const changes = buildChangeFeed(snapshot.markets);

  const royco = snapshot.meta.royco;
  const pharos = snapshot.meta.pharos;
  const score = snapshot.meta.score;
  const bothFresh = royco.status === "fresh" && pharos.status === "fresh";
  const allFresh = bothFresh && score.status === "fresh";
  const eitherFresh = royco.status === "fresh" || pharos.status === "fresh" || score.status === "fresh";
  const freshnessWord = bothFresh ? "fresh" : eitherFresh ? "partly aging" : "aging";
  const feedAges = [royco.ageSeconds, pharos.ageSeconds, score.ageSeconds].filter(
    (age): age is number => age != null && Number.isFinite(age),
  );
  const oldestFeedAge = feedAges.length > 0 ? Math.max(...feedAges) : null;
  const snapshotFlagCount = nrCount + lowConfidenceCount + staleScoreCount + unmappedCount + conflictCount;
  const hasHardSnapshotFlags = conflictCount > 0 || staleScoreCount > 0 || nrCount > 0;
  const snapshotTone = hasHardSnapshotFlags ? "bad" : !allFresh || snapshotFlagCount > 0 ? "watch" : "good";
  const snapshotTitle =
    snapshotTone === "good"
      ? "Snapshot is current and fully scored"
      : snapshotTone === "watch"
        ? "Snapshot is usable with visible caveats"
        : "Read this snapshot with caution";
  const snapshotBody =
    snapshotTone === "good"
      ? "All listed tranches have computed RoycoPharos scores from fresh Royco and Pharos inputs."
      : !allFresh && snapshotFlagCount === 0
        ? "Scores are complete, but at least one input feed is aging. Check health before treating the ranking as current."
        : "Use the flags below before comparing yield: missing ratings, stale scores, or mapping issues change how much confidence the table deserves.";

  return (
    <main className={`page-shell ${styles.homeShell}`}>
      <section className={styles.hero} aria-label="Portfolio overview">
        <div className={styles.lead}>
          <div className={styles.thesis}>
            <h1 className={styles.leadHead}>
              {trancheCount} tranches across {marketCount} markets, rated risk-first.
            </h1>
            <p className={styles.leadSub}>Safety combines base asset, exposure, and tranche structure into one score.</p>
          </div>

          <div className={styles.gradeBook}>
            <div className={styles.gradeBookHead}>
              <h2>Grade book</h2>
              <span className={styles.gradeBookCount}>{ratedCount} rated</span>
            </div>
            <DistributionStrip
              grades={snapshot.tranches.map((t) => t.safetyGrade)}
              label={`Safety grade distribution across ${trancheCount} tranches`}
              showLegend
            />
          </div>

          <div className={styles.snapshotRead} data-tone={snapshotTone} aria-label="Snapshot read">
            <div className={styles.snapshotVerdict}>
              <span>{snapshotTitle}</span>
              <p>{snapshotBody}</p>
            </div>
            <div className={styles.snapshotFacts}>
              <span>
                <b className="num">
                  {ratedCount}/{trancheCount}
                </b>
                rated
              </span>
              <span data-flag={!allFresh ? "watch" : undefined}>
                <b>{allFresh ? "Fresh" : "Aging"}</b>
                feeds
              </span>
              <span data-flag={nrCount > 0 ? "bad" : undefined}>
                <b className="num">{nrCount}</b>
                NR
              </span>
              <span data-flag={lowConfidenceCount > 0 ? "watch" : undefined}>
                <b className="num">{lowConfidenceCount}</b>
                low confidence
              </span>
              <span data-flag={!allFresh ? "watch" : undefined}>
                <b className="num">{formatAge(oldestFeedAge)}</b>
                oldest feed
              </span>
              <span data-flag={unmappedCount + conflictCount > 0 ? "bad" : undefined}>
                <b className="num">{unmappedCount + conflictCount}</b>
                mapping issues
              </span>
            </div>
            <Link className={styles.snapshotLink} href="/health">
              Data health
            </Link>
          </div>

          {safest ? (
            <div className={styles.signals}>
              <SignalCard
                kicker="Safest seat"
                tranche={safest}
                reason="Highest Safety score in the book, the protected seat with the most cushion."
              />
              {divergent && showDivergent && divergentReason ? (
                <SignalCard kicker="Largest score gap" tranche={divergent.tranche} reason={divergentReason} />
              ) : null}
            </div>
          ) : null}

          <p className={styles.freshness}>
            Data {freshnessWord}. Royco <span className="num">{formatAge(royco.ageSeconds)}</span> ago · Pharos{" "}
            <span className="num">{formatAge(pharos.ageSeconds)}</span> ago.
          </p>
        </div>

        <div className={`panel ${styles.scatterPanel}`}>
          <div className={styles.scatterHead}>
            <h2>Safety vs Opportunity</h2>
            <p>Higher is better on both axes. Highlighted markers match the homepage signal seats.</p>
          </div>
          <OpportunityScatter tranches={snapshot.tranches} highlightTrancheIds={highlightTrancheIds} />
          {topGaps.length > 0 ? (
            <div className={styles.mobileDivergences} aria-label="Largest Opportunity to Safety gaps">
              <span>Largest gaps</span>
              {topGaps.map(({ tranche, gap }) => (
                <Link href={`/markets/${encodeURIComponent(tranche.marketKey)}`} key={tranche.trancheId}>
                  <strong>{tranche.depositTokenSymbol ?? tranche.marketName}</strong>
                  <span>
                    {titleCase(tranche.side)} · +{gap} gap · {formatPct(tranche.apyCurrentPct)} APY
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="book-title">
        <div className="section-heading-row">
          <div>
            <h2 id="book-title" className="section-title">
              Every tranche, ranked
            </h2>
            <p className="subtle">
              Ordered risk-first and grouped by market, Senior above Junior. A fixed ranking, not a sortable table.
            </p>
          </div>
        </div>
        <OverviewTable tranches={snapshot.tranches} />
      </section>

      <section className={styles.changes} aria-labelledby="changes-title">
        <div className="section-heading-row">
          <div>
            <h2 id="changes-title" className="section-title">
              What changed recently
            </h2>
            <p className="subtle">Movement between the two most recent observations.</p>
          </div>
        </div>
        {changes.length === 0 ? (
          <p className="subtle">No material changes between the last two observations, or history is still accumulating.</p>
        ) : (
          <div className="pressure-list">
            {changes.map((change) => (
              <Link href={`/markets/${encodeURIComponent(change.marketKey)}`} key={`${change.marketKey}-${change.label}`}>
                <strong>{change.marketName}</strong>
                <span>
                  {change.label}: {change.detail}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="baseline-disclaimer">
        Senior can still lose value if losses exceed the Junior buffer, market mechanics fail, data is stale, or the
        underlying asset deteriorates. Coverage is a snapshot metric, not insurance or a guarantee of principal,
        liquidity, APY, or redemption.
      </p>
    </main>
  );
}
