"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { AssetLogo } from "./asset-logo";
import { DataBadge } from "./badges";
import { GradeBadge, ScorePair, SeatRing } from "./grade";
import { StatusDot, MicroBar, utilizationLevel, headroomLevel } from "./indicators";
import { MiniChart } from "./mini-chart";
import { formatPct, formatRatio, formatUsd } from "./format";
import { exposureFor } from "@/lib/roycopharos/exposure";
import { classifyTrancheFlags } from "@/lib/roycopharos/snapshot-health";
import styles from "./overview-table.module.css";

type HistoryPoint = { observedAt: number; value: number | null };
type SeatFilter = "all" | "senior" | "junior";
type FocusFilter = "all" | "attention" | "nr" | "gap";

type TrancheRow = {
  trancheId: string;
  marketKey: string;
  marketName: string;
  chainSlug: string;
  side: "senior" | "junior";
  depositTokenSymbol: string | null;
  pharosStablecoinId: string | null;
  mappingStatus: string;
  apyCurrentPct: number | null;
  apy7dPct: number | null;
  tvlUsd: number | null;
  coverageRatio: number | null;
  requiredCoverageRatio: number | null;
  coverageHeadroomPct: number | null;
  utilizationRatio: number | null;
  utilizationLimitRatio: number | null;
  statusNormalized: string | null;
  underlyingSafetyScore: number | null;
  underlyingSafetyGrade: string | null;
  scoreStatus: string;
  baseAssetScore: number | null;
  exposureScore: number | null;
  exposureHaircut: number | null;
  trancheStructureScore: number | null;
  safetyGrade: string | null;
  safetyScore: number | null;
  opportunityGrade: string | null;
  opportunityYield: number | null;
  opportunityScore: number | null;
  history?: { apy: HistoryPoint[] };
};

// A row needs attention if its score isn't clean, its mapping is degraded, or it is under
// coverage / utilization pressure.
function isFlagged(t: TrancheRow) {
  return classifyTrancheFlags(t).attention;
}

function hasMissingOrLowConfidence(t: TrancheRow) {
  return classifyTrancheFlags(t).missingOrLowConfidence;
}

function hasOpportunityGap(t: TrancheRow) {
  return t.safetyScore != null && t.opportunityScore != null && t.opportunityScore - t.safetyScore >= 20;
}

function flagReason(reasons: string[]) {
  const priority = [
    "nr",
    "stale",
    "conflict",
    "low_confidence",
    "unmapped",
    "coverage_pressure",
    "utilization_pressure",
    "market_status",
  ];
  const reason = priority.find((item) => reasons.includes(item)) ?? reasons[0];
  switch (reason) {
    case "nr":
      return "Underlying score missing";
    case "stale":
      return "Source data is stale";
    case "conflict":
      return "Token mapping conflict";
    case "low_confidence":
      return "Uncertainty penalties applied";
    case "unmapped":
      return "Base asset unmapped";
    case "coverage_pressure":
      return "Junior buffer is thin";
    case "utilization_pressure":
      return "Utilization near limit";
    case "market_status":
      return "Market status affects score";
    default:
      return null;
  }
}

function matchesQuery(t: TrancheRow, query: string) {
  if (!query) return true;
  const terms = [
    t.marketName,
    t.depositTokenSymbol,
    t.chainSlug,
    t.side,
    t.pharosStablecoinId,
    strategyClassOf(t),
    t.mappingStatus,
    t.scoreStatus,
  ];
  return terms.some((term) => term?.toLowerCase().includes(query));
}

function strategyClassOf(t: TrancheRow) {
  return exposureFor(t.pharosStablecoinId)?.strategyClass ?? null;
}

function sum(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

const SEAT_LABEL: Record<TrancheRow["side"], string> = {
  senior: "junior-buffered",
  junior: "first-loss",
};

// A vault group after filtering: its visible tranches sorted Senior then Junior, plus
// cached aggregates the group summary row and group sort key both read from.
type Group = {
  marketKey: string;
  marketName: string;
  chainSlug: string;
  statusNormalized: string | null;
  tranches: TrancheRow[];
  tvlUsd: number | null;
  coverageRatio: number | null;
  baseSymbol: string | null;
  underlyingSafetyScore: number | null;
  underlyingSafetyGrade: string | null;
  // server (risk-first) position of the group's first tranche, to keep the default order stable
  serverIndex: number;
};

export function OverviewTable({ tranches }: { tranches: TrancheRow[] }) {
  const [seatFilter, setSeatFilter] = useState<SeatFilter>("all");
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const ledgerCaptionId = useId();
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredTranches = useMemo(() => {
    return tranches.filter((t) => {
      if (seatFilter !== "all" && t.side !== seatFilter) return false;
      if (focusFilter === "attention" && !isFlagged(t)) return false;
      if (focusFilter === "nr" && !hasMissingOrLowConfidence(t)) return false;
      if (focusFilter === "gap" && !hasOpportunityGap(t)) return false;
      return matchesQuery(t, deferredQuery);
    });
  }, [tranches, seatFilter, focusFilter, deferredQuery]);

  // Group tranches by market while preserving the server's risk-first order.
  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>();
    filteredTranches.forEach((t, i) => {
      let g = byKey.get(t.marketKey);
      if (!g) {
        g = {
          marketKey: t.marketKey,
          marketName: t.marketName,
          chainSlug: t.chainSlug,
          statusNormalized: t.statusNormalized,
          tranches: [],
          tvlUsd: null,
          coverageRatio: null,
          baseSymbol: t.depositTokenSymbol,
          underlyingSafetyScore: t.underlyingSafetyScore,
          underlyingSafetyGrade: t.underlyingSafetyGrade,
          serverIndex: i,
        };
        byKey.set(t.marketKey, g);
      }
      g.tranches.push(t);
    });

    const list = [...byKey.values()];
    for (const g of list) {
      // Senior first, then Junior; stable for any same-side rows.
      g.tranches.sort((a, b) => (a.side === b.side ? 0 : a.side === "senior" ? -1 : 1));
      g.tvlUsd = sum(g.tranches.map((t) => t.tvlUsd));
      // Junior buffer = the group's coverageRatio (same per market); take the first present.
      g.coverageRatio = g.tranches.find((t) => t.coverageRatio != null)?.coverageRatio ?? null;
    }

    return list.sort((a, b) => a.serverIndex - b.serverIndex);
  }, [filteredTranches]);

  const counts = useMemo(
    () => ({
      attention: tranches.filter(isFlagged).length,
      nr: tranches.filter(hasMissingOrLowConfidence).length,
      gap: tranches.filter(hasOpportunityGap).length,
    }),
    [tranches],
  );

  const hasFilters = seatFilter !== "all" || focusFilter !== "all" || query.trim() !== "";
  const resetFilters = () => {
    setSeatFilter("all");
    setFocusFilter("all");
    setQuery("");
  };

  return (
    <div className="overview">
      <div className={styles.controls} aria-label="Ranked book controls">
        <div className={styles.controlTop}>
          <div className={styles.segmented} role="group" aria-label="Filter by tranche seat">
            {(["all", "senior", "junior"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={seatFilter === value} onClick={() => setSeatFilter(value)}>
                {value === "all" ? "All seats" : titleSeat(value)}
              </button>
            ))}
          </div>
          <label className={styles.searchField} htmlFor={searchId}>
            <span>Search</span>
            <input
              id={searchId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Market, asset, chain"
            />
          </label>
        </div>
        <div className={styles.focusFilters} role="group" aria-label="Filter by risk focus">
          <button type="button" aria-pressed={focusFilter === "all"} onClick={() => setFocusFilter("all")}>
            All
          </button>
          <button type="button" aria-pressed={focusFilter === "attention"} onClick={() => setFocusFilter("attention")}>
            Attention <span className="num">{counts.attention}</span>
          </button>
          <button type="button" aria-pressed={focusFilter === "nr"} onClick={() => setFocusFilter("nr")}>
            NR / low confidence <span className="num">{counts.nr}</span>
          </button>
          <button type="button" aria-pressed={focusFilter === "gap"} onClick={() => setFocusFilter("gap")}>
            Opportunity gap <span className="num">{counts.gap}</span>
          </button>
          {hasFilters ? (
            <button type="button" className={styles.resetButton} onClick={resetFilters}>
              Reset
            </button>
          ) : null}
        </div>
        <p className={styles.resultLine}>
          Showing <span className="num">{filteredTranches.length}</span> of <span className="num">{tranches.length}</span>{" "}
          tranches in default risk-first order.
        </p>
      </div>

      <div className={`data-table-wrap ${styles.desktopWrap}`}>
        <table className={styles.ledger} aria-describedby={ledgerCaptionId}>
          <caption id={ledgerCaptionId} className="sr-only">
            Vault ledger grouped by market. Each market summary row is followed by tranche rows with APY, coverage
            headroom, utilization, and Royco scores.
          </caption>
          <colgroup>
            <col className={styles.assetColumn} />
            <col className={styles.apyColumn} />
            <col className={styles.coverageColumn} />
            <col className={styles.utilizationColumn} />
            <col className={styles.scoreColumn} />
          </colgroup>
          <thead>
            <tr className={styles.headRow}>
              <th scope="col">Asset / tranche</th>
              <th scope="col">APY</th>
              <th scope="col">Coverage headroom</th>
              <th scope="col">Utilization</th>
              <th scope="col">Royco scores</th>
            </tr>
          </thead>

          {groups.map((g) => (
            <tbody key={g.marketKey} className={styles.group}>
              <tr className={styles.summaryRow}>
                <th scope="rowgroup" colSpan={5}>
                  <span className={styles.summaryInner}>
                    <span className={styles.identity}>
                      <Link href={`/markets/${encodeURIComponent(g.marketKey)}`} className={styles.marketName}>
                        <strong>{g.marketName}</strong>
                      </Link>
                      <span className={styles.identityMeta}>{g.chainSlug}</span>
                      <StatusDot status={g.statusNormalized} />
                      <span className={styles.baseAsset}>
                        <span className={styles.cellLabel}>Pharos safety</span>
                        <GradeBadge grade={g.underlyingSafetyGrade} size="sm" />
                        <span className={styles.baseAssetScore}>
                          {g.underlyingSafetyScore == null ? "NR" : g.underlyingSafetyScore}
                        </span>
                        <span className={styles.baseAssetSym}>{g.baseSymbol ?? "Vault"}</span>
                      </span>
                    </span>

                    <span className={styles.vitals}>
                      <span className={styles.vital}>
                        <span className={styles.cellLabel}>Market TVL</span>
                        <span className={styles.cellNum}>{formatUsd(g.tvlUsd)}</span>
                      </span>
                      <span className={styles.vital}>
                        <span className={styles.cellLabel}>Junior buffer</span>
                        <span className={styles.cellNum}>{formatRatio(g.coverageRatio)}</span>
                      </span>
                    </span>
                  </span>
                </th>
              </tr>

              {g.tranches.map((t, i) => {
                const lowLiquidity = t.tvlUsd != null && t.tvlUsd < 100_000;
                const flags = classifyTrancheFlags(t);
                const flagged = flags.attention;
                const reason = flagReason(flags.reasons);
                const isLast = i === g.tranches.length - 1;
                const cls = [styles.subRow, lowLiquidity ? styles.lowLiquidity : "", flagged ? styles.flagged : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr key={t.trancheId} className={cls}>
                    <th scope="row" className={styles.identityCell}>
                      <span className={styles.identityCellInner}>
                        <span className={styles.tree} aria-hidden="true">
                          {isLast ? "└" : "├"}
                        </span>
                        <span
                          className={styles.marker}
                          title={`Safety ${t.safetyGrade ?? "NR"} · ${t.side === "senior" ? "Senior, protected" : "Junior, first-loss"}`}
                        >
                          <SeatRing seat={t.side} grade={t.safetyGrade} className={styles.markerRing} />
                          <span className={styles.markerLogo}>
                            <AssetLogo symbol={t.depositTokenSymbol} size={24} />
                          </span>
                        </span>
                        <span className={styles.identityText}>
                          <span className={styles.assetSymbol}>{t.depositTokenSymbol ?? "Unmapped"}</span>
                          <span className={styles.assetClass}>{strategyClassOf(t) ?? "Exposure unknown"}</span>
                          <span className={styles.trancheLine}>
                            <strong>{t.side === "senior" ? "Senior" : "Junior"}</strong>
                            <span className={styles.trancheSeat}>{SEAT_LABEL[t.side]}</span>
                            {t.mappingStatus !== "mapped" ? <DataBadge value={t.mappingStatus} /> : null}
                            {lowLiquidity ? <span className={styles.thin}>Thin liquidity</span> : null}
                          </span>
                        </span>
                      </span>
                    </th>

                    <td>
                      <span className={styles.apyCell}>
                        <span className={styles.apyValue}>{formatPct(t.apyCurrentPct)}</span>
                        <span className={styles.apy7d}>7d {formatPct(t.apy7dPct)}</span>
                        {(t.history?.apy ?? []).filter((p) => p.value != null).length >= 2 ? (
                          <MiniChart points={t.history!.apy} label={`${t.side} APY history`} className="spark-mini apySpark" />
                        ) : null}
                      </span>
                    </td>

                    <td>
                      <span className={styles.barCell}>
                        <span className={styles.barFigure}>{formatPct(t.coverageHeadroomPct)}</span>
                        <MicroBar
                          value={t.coverageHeadroomPct}
                          max={100}
                          level={headroomLevel(t.coverageHeadroomPct)}
                          label={`Coverage headroom ${formatPct(t.coverageHeadroomPct)}`}
                        />
                      </span>
                    </td>

                    <td>
                      <span className={styles.barCell}>
                        <span className={styles.barFigure}>
                          {formatPct(t.utilizationRatio)}
                          <span className={styles.barLimit}>limit {formatPct(t.utilizationLimitRatio)}</span>
                        </span>
                        <MicroBar
                          value={t.utilizationRatio}
                          max={100}
                          limit={t.utilizationLimitRatio}
                          level={utilizationLevel(t.utilizationRatio, t.utilizationLimitRatio)}
                          label={`Utilization ${formatPct(t.utilizationRatio)}`}
                        />
                      </span>
                    </td>

                    <td>
                      <span className={styles.divCell}>
                        <ScorePair
                          safetyScore={t.safetyScore}
                          opportunityScore={t.opportunityScore}
                          safetyGrade={t.safetyGrade}
                          opportunityGrade={t.opportunityGrade}
                          status={t.scoreStatus}
                          showLabels={false}
                        />
                        {t.scoreStatus !== "computed" ? (
                          <span className={styles.scoreFlag}>
                            <DataBadge value={t.scoreStatus} />
                            {reason ? <span>{reason}</span> : null}
                          </span>
                        ) : null}
                        <Link className={styles.scoreProof} href="/methodology#two-scores">
                          Why?
                        </Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}

          {groups.length === 0 ? (
            <tbody>
              <tr className="overview-empty">
                <td colSpan={5}>No tranches match these filters.</td>
              </tr>
            </tbody>
          ) : null}
        </table>
      </div>

      <div className={styles.mobileBook} aria-label="Mobile ranked tranche evidence">
        {groups.map((g, groupIndex) => {
          const flaggedCount = g.tranches.filter(isFlagged).length;
          const hasHardFlag = g.tranches.some((tranche) => classifyTrancheFlags(tranche).hard);
          const openByDefault = hasFilters || groupIndex < 2 || hasHardFlag;
          return (
          <details key={g.marketKey} className={styles.mobileGroup} open={openByDefault}>
            <summary className={styles.mobileMarket}>
              <div className={styles.mobileMarketTitle}>
                <strong>{g.marketName}</strong>
                <span className={styles.mobileChain}>{g.chainSlug}</span>
                <StatusDot status={g.statusNormalized} />
                <span className={styles.mobileFold}>
                  {g.tranches.length} seats{flaggedCount ? ` · ${flaggedCount} flagged` : ""}
                </span>
              </div>
              <div className={styles.mobileMarketVitals}>
                <span>
                  <span className={styles.cellLabel}>Pharos safety</span>
                  <GradeBadge grade={g.underlyingSafetyGrade} size="sm" />
                  <b className="num">{g.underlyingSafetyScore ?? "NR"}</b>
                </span>
                <span>
                  <span className={styles.cellLabel}>Market TVL</span>
                  <b className="num">{formatUsd(g.tvlUsd)}</b>
                </span>
                <span>
                  <span className={styles.cellLabel}>Junior buffer</span>
                  <b className="num">{formatRatio(g.coverageRatio)}</b>
                </span>
              </div>
            </summary>

            <div className={styles.mobileTrancheList}>
            {g.tranches.map((t) => {
              const lowLiquidity = t.tvlUsd != null && t.tvlUsd < 100_000;
              const flags = classifyTrancheFlags(t);
              const flagged = flags.attention;
              const reason = flagReason(flags.reasons);
              return (
                <Link
                  href={`/markets/${encodeURIComponent(t.marketKey)}`}
                  key={t.trancheId}
                  className={styles.mobileTranche}
                  data-flagged={flagged ? "" : undefined}
                >
                  <span className={styles.mobileTrancheTop}>
                    <span className={styles.marker} aria-hidden="true">
                      <SeatRing seat={t.side} grade={t.safetyGrade} className={styles.markerRing} />
                      <span className={styles.markerLogo}>
                        <AssetLogo symbol={t.depositTokenSymbol} size={24} />
                      </span>
                    </span>
                    <span className={styles.mobileIdentity}>
                      <strong>
                        {t.depositTokenSymbol ?? "Unmapped"} {titleSeat(t.side)}
                      </strong>
                      <span>
                        {strategyClassOf(t) ?? "Exposure unknown"} · {SEAT_LABEL[t.side]}
                      </span>
                    </span>
                    <span className={styles.mobileApy}>
                      {formatPct(t.apyCurrentPct)}
                      <small>APY</small>
                    </span>
                  </span>

                  <span className={styles.mobileScoreLine}>
                    <ScorePair
                      safetyScore={t.safetyScore}
                      opportunityScore={t.opportunityScore}
                      safetyGrade={t.safetyGrade}
                      opportunityGrade={t.opportunityGrade}
                      status={t.scoreStatus}
                      showLabels
                      size="sm"
                    />
                    {t.scoreStatus !== "computed" ? <DataBadge value={t.scoreStatus} /> : null}
                    {t.mappingStatus !== "mapped" ? <DataBadge value={t.mappingStatus} /> : null}
                    {lowLiquidity ? <span className={styles.thin}>Thin liquidity</span> : null}
                    {reason ? <span className={styles.mobileReason}>Why: {reason}</span> : null}
                  </span>

                  <span className={styles.mobileEvidence}>
                    <span>
                      <span className={styles.cellLabel}>Headroom</span>
                      <b className="num">{formatPct(t.coverageHeadroomPct)}</b>
                      <MicroBar
                        value={t.coverageHeadroomPct}
                        max={100}
                        level={headroomLevel(t.coverageHeadroomPct)}
                        label={`Coverage headroom ${formatPct(t.coverageHeadroomPct)}`}
                      />
                    </span>
                    <span>
                      <span className={styles.cellLabel}>Utilization</span>
                      <b className="num">{formatPct(t.utilizationRatio)}</b>
                      <MicroBar
                        value={t.utilizationRatio}
                        max={100}
                        limit={t.utilizationLimitRatio}
                        level={utilizationLevel(t.utilizationRatio, t.utilizationLimitRatio)}
                        label={`Utilization ${formatPct(t.utilizationRatio)}`}
                      />
                    </span>
                  </span>
                </Link>
              );
            })}
            </div>
          </details>
          );
        })}
        {groups.length === 0 ? <p className={styles.mobileEmpty}>No tranches match these filters.</p> : null}
      </div>
    </div>
  );
}

function titleSeat(side: TrancheRow["side"]) {
  return side === "senior" ? "Senior" : "Junior";
}
