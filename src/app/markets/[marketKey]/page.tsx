import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetLogo } from "@/components/roycopharos/asset-logo";
import { LossWaterfall } from "@/components/roycopharos/charts/loss-waterfall";
import { PenaltyBar } from "@/components/roycopharos/charts/penalty-bar";
import { NumericScoreBadge, ScorePair, gradeColorVar } from "@/components/roycopharos/grade";
import { MicroBar, StatusDot, headroomLevel, utilizationLevel } from "@/components/roycopharos/indicators";
import { MiniChart } from "@/components/roycopharos/mini-chart";
import {
  DependencyList,
  DimensionBars,
  PegPill,
  PegStabilityReadout,
  PharosProfileLink,
  PharosSourceBadge,
} from "@/components/roycopharos/pharos-signals";
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
import { exposureFor } from "@/lib/roycopharos/exposure";
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
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Risk-stack spine: the running number that flows Pharos base -> after exposure -> each seat.
  const spineBase = baseUnderlying?.underlyingSafetyScore ?? null;
  const spineExposureHaircut = senior?.exposureHaircut ?? junior?.exposureHaircut ?? null;
  const spineAfterExposure =
    spineBase != null && spineExposureHaircut != null ? Math.round(spineBase - spineExposureHaircut) : null;

  const utilLevel = utilizationLevel(market.utilizationRatio, market.utilizationLimitRatio);
  // Buffer bar is scaled against the Senior exposure unit (1.0x), so a thin
  // first-loss buffer reads as a short fill, not a maxed-out "safe" bar.
  const bufferScaleMax = market.coverageRatio != null ? Math.max(1, market.coverageRatio * 1.15) : 1;

  // Data freshness for the masthead: when the underlying numbers were last
  // observed upstream, surfaced so a reader can tell live data from a stale snapshot.
  const asOfTs = market.sourceObservedAt ?? market.publishedAt ?? market.collectedAt ?? null;
  const dataAgeSeconds = asOfTs != null ? Math.max(0, nowSeconds - asOfTs) : null;
  const isStaleSnapshot = market.tranches.some((tranche) => tranche.scoreStatus === "stale");

  return (
    <main className="page-shell">
      <Link className="text-link" href="/">
        Back to Royco overview
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
                {baseUnderlying?.peg ? (
                  <>
                    <span className={styles.sep} aria-hidden="true">
                      ·
                    </span>
                    <PegPill peg={baseUnderlying.peg} compact />
                  </>
                ) : null}
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
              Pharos rates the base asset; this Royco view scores the exposure and the seat structure on top of it.
              Each layer feeds the next, down to the Safety score for your seat.
            </p>
            <div className={styles.spine} aria-label="How the seat Safety is derived">
              <span className={styles.spineStep}>
                <span className={styles.spineLabel}>Pharos base</span>
                <strong>{spineBase ?? "NR"}</strong>
              </span>
              <span className={styles.spineArrow} aria-hidden="true">
                exposure{spineExposureHaircut != null ? ` −${spineExposureHaircut.toFixed(1)}` : ""}
              </span>
              <span className={styles.spineStep}>
                <span className={styles.spineLabel}>after exposure</span>
                <strong>{spineAfterExposure ?? "NR"}</strong>
              </span>
              <span className={styles.spineArrow} aria-hidden="true">seat</span>
              <span className={styles.spineStep}>
                {senior ? (
                  <span className={styles.spineSeat}>
                    Senior <strong>{senior.safetyScore ?? "NR"}</strong>
                  </span>
                ) : null}
                {junior ? (
                  <span className={styles.spineSeat}>
                    Junior <strong>{junior.safetyScore ?? "NR"}</strong>
                  </span>
                ) : null}
              </span>
            </div>
            <div className={styles.layerStack}>
              {/* Layer 1 — base asset (Pharos dossier, shown verbatim) */}
              <div className={styles.layer}>
                <div className={styles.layerHead}>
                  <span className={styles.layerTag}>Layer 1</span>
                  <h3>Base asset</h3>
                  <span className={styles.layerSource}>Pharos, shown verbatim</span>
                </div>
                <div className={styles.baseRow}>
                  {market.underlyings.map((underlying) => {
                    const pharosAge =
                      underlying.sourceUpdatedAt != null ? Math.max(0, nowSeconds - underlying.sourceUpdatedAt) : null;
                    const context = [
                      underlying.variantKind ? titleCase(underlying.variantKind) : null,
                      underlying.navToken ? "NAV token" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <article className={styles.baseCard} key={`base-${underlying.pharosStablecoinId ?? underlying.symbol}`}>
                        <div className={styles.baseDossierHead}>
                          <div className={styles.baseIdent}>
                            <AssetLogo symbol={underlying.symbol} size={26} />
                            <div className={styles.baseIdentText}>
                              <span className={styles.baseSymbol}>{underlying.symbol}</span>
                              <span className={styles.baseName}>{underlying.name}</span>
                            </div>
                          </div>
                          <PharosSourceBadge ageSeconds={pharosAge} freshness={underlying.freshness} />
                        </div>

                        <div className={styles.basePanels}>
                          <div className={styles.pharosSafety}>
                            <span className={styles.factLabel}>Pharos Safety</span>
                            <div className={styles.pharosSafetyScore}>
                              <NumericScoreBadge
                                score={underlying.underlyingSafetyScore}
                                grade={underlying.underlyingSafetyGrade}
                                size="lg"
                                label="Pharos Safety score"
                              />
                              {underlying.overallBaseScore != null ? (
                                <span className={styles.baseSub}>base {Math.round(underlying.overallBaseScore)}</span>
                              ) : null}
                            </div>
                          </div>
                          <div className={styles.pegPanel}>
                            <PegStabilityReadout peg={underlying.peg} />
                          </div>
                        </div>

                        <div className={styles.dossierBlock}>
                          <span className={styles.factLabel}>Pharos dimensions</span>
                          <DimensionBars dimensions={underlying.dimensions} />
                        </div>

                        <div className={styles.dossierBlock}>
                          <span className={styles.factLabel}>Backed by</span>
                          <DependencyList
                            dependencies={underlying.upstreamDependencies}
                            empty="Pharos reports no upstream dependencies for this asset."
                          />
                        </div>

                        <div className={styles.baseFooter}>
                          <span className={styles.baseFooterFacts}>
                            <span>
                              <span className={styles.factLabel}>Supply</span>{" "}
                              <span className="mono">{formatUsd(underlying.supplyUsd)}</span>
                            </span>
                            {underlying.bridgeRoute?.label ? (
                              <span>
                                <span className={styles.factLabel}>Bridge route</span> {underlying.bridgeRoute.label}
                                {underlying.bridgeRoute.score != null ? ` (${underlying.bridgeRoute.score})` : ""}
                              </span>
                            ) : null}
                            {context ? <span className={styles.baseVariant}>{context}</span> : null}
                          </span>
                          <PharosProfileLink href={underlying.pharosUrl} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Layer 2 — exposure (Royco wrapper) */}
              <div className={styles.layer}>
                <div className={styles.layerHead}>
                  <span className={styles.layerTag}>Layer 2</span>
                  <h3>Exposure</h3>
                  <span className={styles.layerSource}>curated reference data</span>
                </div>
                <div className={styles.baseRow}>
                  {market.underlyings.map((underlying) => {
                    const profile = exposureFor(underlying.pharosStablecoinId);
                    const tranche = market.tranches.find((entry) => entry.pharosStablecoinId === underlying.pharosStablecoinId);
                    const haircut = tranche?.exposureHaircut ?? null;
                    return (
                      <article className={styles.baseCard} key={`exp-${underlying.pharosStablecoinId ?? underlying.symbol}`}>
                        <div className={styles.exposureHead}>
                          <span className={styles.exposureClass}>{profile?.strategyClass ?? "Exposure unknown"}</span>
                          <span className={styles.exposureTransition}>
                            exposure score {tranche?.exposureScore ?? "NR"}
                            {haircut != null ? <span className={styles.exposureHaircut}> → base −{haircut.toFixed(1)} pts</span> : null}
                          </span>
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
              Where this Royco seat sits in the loss order, and how much cushion stands between a loss and the Senior seat.
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
