import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetLogo } from "@/components/roycopharos/asset-logo";
import { LossWaterfall } from "@/components/roycopharos/charts/loss-waterfall";
import { PenaltyBar } from "@/components/roycopharos/charts/penalty-bar";
import { GradeBadge, NumericScoreBadge, ScorePair, gradeColorVar } from "@/components/roycopharos/grade";
import { MicroBar, StatusDot, headroomLevel, utilizationLevel } from "@/components/roycopharos/indicators";
import { MiniChart } from "@/components/roycopharos/mini-chart";
import {
  formatAge,
  formatDelta,
  formatDurationShort,
  formatPct,
  formatRatio,
  formatRatioPct,
  formatTimestampUtc,
  formatUsd,
  titleCase,
} from "@/components/roycopharos/format";
import { exposureFor, pegReading } from "@/lib/roycopharos/exposure";
import { getMarketByKey } from "@/lib/roycopharos/repository";
import type { RoycoTrancheView } from "@/lib/roycopharos/types";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/**
 * Plain-language reading of the seat. The badges already show the numbers, so the
 * sentence interprets the gap instead of restating it. No em dashes, no buzzwords.
 */
function verdict(tranche: RoycoTrancheView): string {
  const isSenior = tranche.side === "senior";
  const loss = isSenior ? "Losses reach this seat only after the Junior buffer is gone" : "This seat takes the first loss";
  if (tranche.safetyScore == null || tranche.opportunityScore == null) return `${loss}. Not rated yet.`;
  const gap = tranche.opportunityScore - tranche.safetyScore;
  const pay = gap >= 20 ? "the yield richly pays for it" : gap >= 0 ? "the yield broadly pays for it" : "the yield trails the risk";
  return `${loss}, and ${pay}.`;
}

export default async function MarketPage({ params }: { params: Promise<{ marketKey: string }> }) {
  const { marketKey } = await params;
  const market = await getMarketByKey(decodeURIComponent(marketKey));
  if (!market) notFound();

  const senior = market.tranches.find((tranche) => tranche.side === "senior");
  const junior = market.tranches.find((tranche) => tranche.side === "junior");
  const baseUnderlying = market.underlyings[0];
  const baseProfile = baseUnderlying ? exposureFor(baseUnderlying.pharosStablecoinId) : null;

  const utilLevel = utilizationLevel(market.utilizationRatio, market.utilizationLimitRatio);
  // Buffer bar is scaled against the Senior exposure unit (1.0x), so a thin
  // first-loss buffer reads as a short fill, not a maxed-out "safe" bar.
  const bufferScaleMax = market.coverageRatio != null ? Math.max(1, market.coverageRatio * 1.15) : 1;

  // Data freshness for the masthead: when the underlying numbers were last
  // observed upstream, surfaced so a reader can tell live data from a stale snapshot.
  const asOfTs = market.sourceObservedAt ?? market.publishedAt ?? market.collectedAt ?? null;
  const dataAgeSeconds = asOfTs != null ? Math.max(0, Math.floor(Date.now() / 1000) - asOfTs) : null;
  const isStaleSnapshot = market.tranches.some((tranche) => tranche.scoreStatus === "stale");

  return (
    <main className="page-shell">
      <Link className="text-link" href="/">
        Back to overview
      </Link>

      {/* 1. VERDICT MASTHEAD */}
      <section className={`panel ${styles.masthead}`} aria-labelledby="vault-title">
        <div className={styles.mastheadTop}>
          <div className={styles.mastheadId}>
            {baseUnderlying ? <AssetLogo symbol={baseUnderlying.symbol} size={46} /> : null}
            <div>
              <h1 id="vault-title" className={styles.title}>
                {market.name}
              </h1>
              <p className={styles.subline}>
                {baseUnderlying ? <span>Base asset {baseUnderlying.symbol}</span> : null}
                {baseProfile ? (
                  <>
                    <span className={styles.sep} aria-hidden="true">
                      ·
                    </span>
                    <span>{baseProfile.strategyClass}</span>
                  </>
                ) : null}
                <span className={styles.sep} aria-hidden="true">
                  ·
                </span>
                <span>{titleCase(market.chainSlug)}</span>
              </p>
            </div>
          </div>
          <div className={styles.mastheadStats}>
            <div className={styles.stat}>
              <span className="metric-label">Status</span>
              <StatusDot status={market.statusNormalized ?? "unknown"} />
            </div>
            <div className={styles.stat}>
              <span className="metric-label">Market TVL</span>
              <span className={`${styles.statValue} mono`}>{formatUsd(market.tvlUsd)}</span>
            </div>
            <div className={styles.stat}>
              <span className="metric-label">Data freshness</span>
              <span
                className={styles.freshness}
                data-stale={isStaleSnapshot ? "" : undefined}
                title={asOfTs != null ? `Source observed ${formatTimestampUtc(asOfTs)}` : "Freshness unknown"}
              >
                <span className={styles.freshDot} aria-hidden="true" />
                {isStaleSnapshot ? "Stale, " : ""}
                {dataAgeSeconds != null ? `as of ${formatAge(dataAgeSeconds)} ago` : "unknown"}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.verdicts}>
          {market.tranches.map((tranche) => (
            <article className={styles.verdict} key={`verdict-${tranche.trancheId}`}>
              <ScorePair
                safetyScore={tranche.safetyScore}
                opportunityScore={tranche.opportunityScore}
                safetyGrade={tranche.safetyGrade}
                opportunityGrade={tranche.opportunityGrade}
                status={tranche.scoreStatus}
                size="lg"
                showLabels
              />
              <div className={styles.verdictBody}>
                <span className={styles.verdictSeat}>
                  {tranche.side === "senior" ? "Senior · junior-buffered" : "Junior · first-loss"}
                </span>
                <p className={styles.verdictLine}>{verdict(tranche)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* in-page jump nav */}
      <nav className={styles.sectionNav} aria-label="On this page">
        <a href="#layers-title">How the risk stacks</a>
        <a href="#waterfall-title">Loss waterfall</a>
        <a href="#history-title">History</a>
        {senior && junior ? <a href="#compare-title">Senior vs Junior</a> : null}
      </nav>

      {/* MAIN COLUMN — risk stack leads, the thing readers come for */}
      <div className={styles.mainColumn}>
          {/* 1. HOW THE RISK STACKS — the page's centerpiece */}
          <section className={`panel ${styles.module}`} aria-labelledby="layers-title">
            <h2 id="layers-title" className="section-title">
              How the risk stacks
            </h2>
            <p className={styles.moduleSub}>
              Pharos rates the base asset; RoycoPharos scores the exposure and the seat structure on top of it. Each
              layer feeds the next, down to the Safety score for your seat.
            </p>
            <div className={styles.layerStack}>
              {/* Layer 1 — base asset */}
              <div className={styles.layer}>
                <div className={styles.layerHead}>
                  <span className={styles.layerTag}>Layer 1</span>
                  <h3>Base asset</h3>
                </div>
                <div className={styles.baseRow}>
                  {market.underlyings.map((underlying) => {
                    const profile = exposureFor(underlying.pharosStablecoinId);
                    const peg = pegReading(underlying.price, profile);
                    const driftWatch = peg.deviationPct != null && peg.behavior === "stable" && Math.abs(peg.deviationPct) > 2;
                    return (
                      <article className={styles.baseCard} key={`base-${underlying.pharosStablecoinId ?? underlying.symbol}`}>
                        <div className={styles.baseCardHead}>
                          <GradeBadge grade={underlying.underlyingSafetyGrade} />
                          <AssetLogo symbol={underlying.symbol} size={22} />
                          <span className={styles.baseSymbol}>{underlying.symbol}</span>
                          <span className={styles.baseScore}>
                            {underlying.underlyingSafetyScore == null ? "No score" : underlying.underlyingSafetyScore}
                          </span>
                        </div>
                        <div className={styles.factGrid}>
                          <div className={styles.fact}>
                            <span className={styles.factLabel}>Price</span>
                            <span className={styles.factValue}>
                              <span className="mono">{peg.price == null ? "NR" : `$${peg.price.toFixed(4)}`}</span>
                              {peg.deviationPct != null ? (
                                <span className={styles.deviation} data-flag={driftWatch ? "watch" : undefined}>
                                  {peg.deviationPct >= 0 ? "+" : ""}
                                  {peg.deviationPct}% vs $1
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <div className={styles.fact}>
                            <span className={styles.factLabel}>Supply</span>
                            <span className={styles.factValue}>
                              <span className="mono">{formatUsd(underlying.supplyUsd)}</span>
                            </span>
                          </div>
                        </div>
                        <p className={styles.pegNote}>{peg.note}</p>
                        <p className={styles.baseSummary}>{underlying.summary}</p>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Layer 2 — exposure */}
              <div className={styles.layer}>
                <div className={styles.layerHead}>
                  <span className={styles.layerTag}>Layer 2</span>
                  <h3>Exposure</h3>
                </div>
                <div className={styles.baseRow}>
                  {market.underlyings.map((underlying) => {
                    const profile = exposureFor(underlying.pharosStablecoinId);
                    const tranche = market.tranches.find((entry) => entry.pharosStablecoinId === underlying.pharosStablecoinId);
                    return (
                      <article className={styles.baseCard} key={`exp-${underlying.pharosStablecoinId ?? underlying.symbol}`}>
                        <div className={styles.baseCardHead}>
                          <NumericScoreBadge score={tranche?.exposureScore ?? null} size="sm" label="Exposure score" />
                          <span className={styles.baseSymbol}>{underlying.symbol}</span>
                          <span className={styles.seatTag}>{profile?.strategyClass ?? "Exposure unknown"}</span>
                        </div>
                        {profile ? (
                          <dl className={`${styles.factGrid} ${styles.stacked}`}>
                            <div className={styles.fact}>
                              <span className={styles.factLabel}>Yield source</span>
                              <span className={styles.factValue}>{profile.yieldSource}</span>
                            </div>
                            <div className={styles.fact}>
                              <span className={styles.factLabel}>What breaks it</span>
                              <span className={styles.factValue}>{profile.primaryRisk}</span>
                            </div>
                            <div className={styles.fact}>
                              <span className={styles.factLabel}>Exit mechanics</span>
                              <span className={styles.factValue}>{profile.liquidityProfile}</span>
                            </div>
                          </dl>
                        ) : (
                          <p className={styles.baseSummary}>No curated exposure classification for this underlying yet.</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Layer 3 — tranche structure, carrying the grade math */}
              <div className={styles.layer}>
                <div className={styles.layerHead}>
                  <span className={styles.layerTag}>Layer 3</span>
                  <h3>Tranche structure</h3>
                </div>
                <p className={styles.layerLede}>
                  Each seat starts from the base score, then loses points for exposure and seat mechanics down to its
                  final Safety. Hover a segment for the factor behind it.
                </p>
                <div className={styles.penaltyStack}>
                  {market.tranches.map((tranche) => (
                    <div className={styles.penaltyBlock} key={`structure-${tranche.trancheId}`}>
                      <div className={styles.penaltyHead}>
                        <h3>{tranche.side === "senior" ? "Senior" : "Junior"}</h3>
                        <span className={styles.penaltySeat}>
                          {tranche.side === "senior"
                            ? "junior-buffered · immediate redemption"
                            : `first-loss · ${formatDurationShort(market.juniorRedemptionDelaySeconds).toLowerCase()} redemption`}
                        </span>
                      </div>
                      <PenaltyBar
                        baseScore={tranche.underlyingSafetyScore}
                        baseGrade={tranche.underlyingSafetyGrade}
                        finalScore={tranche.safetyScore}
                        finalGrade={tranche.safetyGrade}
                        penalties={tranche.penaltyBreakdown}
                        scoreStatus={tranche.scoreStatus}
                      />
                      {tranche.nrReason ? <p className="warning-copy">{tranche.nrReason}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className={styles.layerNote}>
              Composite Safety = Pharos base score minus exposure haircut plus the tranche-structure effect. Senior
              protection can lift the score; first-loss structure can pull it down.
            </p>
          </section>

          {/* 2. LOSS WATERFALL — where your capital sits */}
          <section className={`panel ${styles.module}`} aria-labelledby="waterfall-title">
            <h2 id="waterfall-title" className="section-title">
              Loss waterfall
            </h2>
            <p className={styles.moduleSub}>
              Where your capital sits in the loss order, and how much cushion stands between a loss and the Senior seat.
            </p>
            <LossWaterfall
              coverageRatio={market.coverageRatio}
              requiredCoverageRatio={market.requiredCoverageRatio}
              drawdownRatio={market.drawdownRatio}
            />
          </section>

          {/* 3. LIVE METRICS — telemetry strip, sized like telemetry */}
          <section className={styles.metrics} aria-label="Live market metrics">
            <div className={styles.metric}>
              <span className="metric-label">Junior buffer (first-loss)</span>
              <span className={styles.metricValue}>{formatRatio(market.coverageRatio)}</span>
              <div className={styles.metricBarRow}>
                <MicroBar
                  value={market.coverageRatio}
                  max={bufferScaleMax}
                  limit={market.requiredCoverageRatio}
                  level={headroomLevel(market.coverageHeadroomPct)}
                  label={`Junior buffer ${formatRatio(market.coverageRatio)} against a required floor of ${formatRatio(market.requiredCoverageRatio)} per unit of Senior exposure`}
                />
              </div>
              <span className={styles.metricNote}>
                {market.requiredCoverageRatio != null
                  ? `Required floor ${formatRatio(market.requiredCoverageRatio)}.`
                  : "No required floor reported."}
                {market.coverageHeadroomPct != null
                  ? ` Headroom ${market.coverageHeadroomPct >= 0 ? "+" : ""}${formatPct(market.coverageHeadroomPct)} over that floor.`
                  : ""}
              </span>
            </div>
            <div className={styles.metric}>
              <span className="metric-label">Utilization</span>
              <span className={styles.metricValue}>{formatPct(market.utilizationRatio)}</span>
              <div className={styles.metricBarRow}>
                <MicroBar
                  value={market.utilizationRatio}
                  max={100}
                  limit={market.utilizationLimitRatio}
                  level={utilLevel}
                  label={`Utilization ${formatPct(market.utilizationRatio)} versus limit ${formatPct(market.utilizationLimitRatio)}`}
                />
              </div>
              <span className={styles.metricNote}>Limit {formatPct(market.utilizationLimitRatio)}.</span>
            </div>
            <div className={styles.metric}>
              <span className="metric-label">Drawdown</span>
              <span className={styles.metricValue}>{formatRatioPct(market.drawdownRatio)}</span>
              <span className={styles.metricNote}>
                {market.totalDrawdowns ? `${market.totalDrawdowns} recorded.` : "No drawdowns recorded."}
              </span>
            </div>
          </section>

          {/* 4. HISTORY SMALL-MULTIPLES */}
          <section className={`panel ${styles.module}`} aria-labelledby="history-title">
            <h2 id="history-title" className="section-title">
              30-day history
            </h2>
            <p className={styles.moduleSub}>Read from the published snapshot. Short series show a collecting-history state.</p>
            <div className={styles.historyGrid}>
              <HistoryCard
                title="Coverage ratio"
                points={market.history.coverage}
                current={formatRatio(market.coverageRatio)}
                label="Coverage ratio history"
              />
              <HistoryCard
                title="Utilization"
                points={market.history.utilization}
                current={formatPct(market.utilizationRatio)}
                label="Utilization history"
              />
              <HistoryCard
                title="Senior APY"
                points={senior?.history.apy ?? []}
                current={formatPct(senior?.apyCurrentPct ?? null)}
                stroke={gradeColorVar(senior?.safetyGrade)}
                label="Senior APY history"
              />
              <HistoryCard
                title="Junior APY"
                points={junior?.history.apy ?? []}
                current={formatPct(junior?.apyCurrentPct ?? null)}
                stroke={gradeColorVar(junior?.safetyGrade)}
                label="Junior APY history"
              />
              <HistoryCard
                title="Market TVL"
                points={market.history.tvl}
                current={formatUsd(market.tvlUsd)}
                label="Market TVL history"
              />
            </div>
          </section>

          {/* 7. SENIOR vs JUNIOR + WHY JUNIOR PAYS MORE */}
          {senior && junior ? (
            <section className={`panel ${styles.module}`} aria-labelledby="compare-title">
              <h2 id="compare-title" className="section-title">
                Senior versus Junior
              </h2>
              <p className={styles.moduleSub}>
                Same exposure, two seats. Junior earns more because it stands in front of the loss; the spread below is
                what that extra risk pays.
              </p>
              <div className={styles.compareGrid}>
                {[senior, junior].map((tranche) => (
                  <article className={styles.compareCard} key={`cmp-${tranche.trancheId}`}>
                    <h3>{tranche.side === "senior" ? "Senior, junior-buffered" : "Junior, first-loss"}</h3>
                    <dl className={styles.compareFacts}>
                      <div>
                        <dt>APY</dt>
                        <dd>{formatPct(tranche.apyCurrentPct)}</dd>
                      </div>
                      <div>
                        <dt>Net (risk-adj.) yield</dt>
                        <dd>{tranche.opportunityYield == null ? "NR" : `${tranche.opportunityYield.toFixed(1)}%`}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              <div className={styles.spreadRow}>
                <div className={styles.spread}>
                  <span className={styles.spreadValue}>
                    {formatDelta(junior.apyCurrentPct, senior.apyCurrentPct, "%", 2)}
                  </span>
                  <span className="metric-label">APY spread</span>
                  <span className={styles.spreadNote}>Extra yield Junior earns over Senior.</span>
                </div>
                <div className={styles.spread}>
                  <span className={styles.spreadValue}>
                    {formatDelta(junior.trancheHaircut, senior.trancheHaircut, " pts", 1)}
                  </span>
                  <span className="metric-label">Extra haircut</span>
                  <span className={styles.spreadNote}>Junior&apos;s added first-loss structural cost.</span>
                </div>
                <div className={styles.spread}>
                  <span className={styles.spreadValue}>
                    {senior.safetyScore ?? "NR"}/{senior.opportunityScore ?? "NR"} → {junior.safetyScore ?? "NR"}/
                    {junior.opportunityScore ?? "NR"}
                  </span>
                  <span className="metric-label">Safety to Opportunity</span>
                  <span className={styles.spreadNote}>Senior versus Junior score pair.</span>
                </div>
              </div>
            </section>
          ) : null}
      </div>

      <p className="baseline-disclaimer">
        These grades describe principal risk, not a recommendation. A first-loss Junior tranche can lose capital before
        the Senior seat is touched. Yields are variable and the underlying exposures carry their own redemption and
        market risk. Read the methodology before acting on any grade.
      </p>
    </main>
  );
}

function HistoryCard({
  title,
  points,
  current,
  stroke = "var(--chart-line)",
  label,
}: {
  title: string;
  points: { observedAt: number; value: number | null }[];
  current: string;
  stroke?: string;
  label: string;
}) {
  return (
    <article className={styles.historyCard}>
      <div className={styles.historyHead}>
        <h3 className={styles.historyTitle}>{title}</h3>
        <span className={styles.historyCurrent}>{current}</span>
      </div>
      <MiniChart points={points} label={label} stroke={stroke} />
    </article>
  );
}
