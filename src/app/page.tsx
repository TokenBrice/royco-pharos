import Link from "next/link";
import { OverviewTable } from "@/components/roycopharos/overview-table";
import { DistributionStrip } from "@/components/roycopharos/distribution-strip";
import { OpportunityScatter } from "@/components/roycopharos/opportunity-scatter";
import { AssetLogo } from "@/components/roycopharos/asset-logo";
import { ScorePair } from "@/components/roycopharos/grade";
import { DewsPill } from "@/components/roycopharos/pharos-signals";
import { formatAge, formatPct, formatRatio, titleCase } from "@/components/roycopharos/format";
import { exposureFor } from "@/lib/roycopharos/exposure";
import { getRoycoPharosSnapshotOrNull } from "@/lib/roycopharos/repository";
import { buildChangeFeed } from "@/lib/roycopharos/snapshot";
import { deriveSnapshotHealth } from "@/lib/roycopharos/snapshot-health";
import type { RoycoTrancheView, UnderlyingSummary } from "@/lib/roycopharos/types";
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
function SignalCard({
  kicker,
  tranche,
  underlying,
  reason,
}: {
  kicker: string;
  tranche: RoycoTrancheView;
  underlying: UnderlyingSummary | null;
  reason: string;
}) {
  const apy = formatPct(
    tranche.apyCurrentPct != null && tranche.apyCurrentPct > 0 ? tranche.apyCurrentPct : tranche.apy7dPct,
  );
  const dependency = underlying?.upstreamDependencies[0] ?? null;
  const exposure = exposureFor(tranche.pharosStablecoinId);
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
      <div className={styles.signalEvidence} aria-label={`${kicker} risk stack evidence`}>
        <span>
          <small>Base asset</small>
          <strong>
            Pharos {underlying?.underlyingSafetyScore ?? tranche.underlyingSafetyScore ?? "NR"}
            {underlying?.underlyingSafetyGrade ?? tranche.underlyingSafetyGrade ? ` ${underlying?.underlyingSafetyGrade ?? tranche.underlyingSafetyGrade}` : ""}
          </strong>
          <DewsPill dews={underlying?.dews} compact />
        </span>
        <span>
          <small>Exposure</small>
          <strong>{dependency?.symbol ?? dependency?.name ?? exposure?.strategyClass ?? "Dependency not reported"}</strong>
          <em>{dependency?.weightPct != null ? `${dependency.weightPct.toFixed(0)}% upstream weight` : exposure?.primaryRisk ?? "Pharos dependency detail pending"}</em>
        </span>
        <span>
          <small>Seat structure</small>
          <strong>{tranche.side === "senior" ? "Junior-buffered" : "First-loss"}</strong>
          <em>Buffer {formatRatio(tranche.coverageRatio)}</em>
        </span>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const snapshot = await getRoycoPharosSnapshotOrNull();

  if (!snapshot || snapshot.tranches.length === 0) {
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
  const health = deriveSnapshotHealth(snapshot);
  const ratedCount = trancheCount - health.nrCount;

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
  const underlyingById = new Map(snapshot.underlyings.map((underlying) => [underlying.pharosStablecoinId, underlying]));
  const underlyingFor = (tranche: RoycoTrancheView) =>
    tranche.pharosStablecoinId ? (underlyingById.get(tranche.pharosStablecoinId) ?? null) : null;

  const changes = buildChangeFeed(snapshot.markets);

  const royco = snapshot.meta.royco;
  const pharos = snapshot.meta.pharos;
  const score = snapshot.meta.score;
  const bothFresh = royco.status === "fresh" && pharos.status === "fresh";
  const eitherFresh = royco.status === "fresh" || pharos.status === "fresh" || score.status === "fresh";
  const freshnessWord = bothFresh ? "fresh" : eitherFresh ? "partly aging" : "aging";

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

          {safest ? (
            <div className={styles.signals}>
              <SignalCard
                kicker="Safest seat"
                tranche={safest}
                underlying={underlyingFor(safest)}
                reason="Highest Safety score in the book, the protected seat with the most cushion."
              />
              {divergent && showDivergent && divergentReason ? (
                <SignalCard
                  kicker="Largest score gap"
                  tranche={divergent.tranche}
                  underlying={underlyingFor(divergent.tranche)}
                  reason={divergentReason}
                />
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
              Royco markets, ranked
            </h2>
            <p className="subtle">
              Ordered risk-first and grouped by Royco market, Senior above Junior. Each row keeps Pharos base-asset evidence beside Royco seat mechanics.
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
