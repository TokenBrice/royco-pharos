"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AssetLogo } from "./asset-logo";
import { DataBadge } from "./badges";
import { GradeBadge, ScorePair, SeatRing } from "./grade";
import { StatusDot, MicroBar, utilizationLevel, headroomLevel } from "./indicators";
import { MiniChart } from "./mini-chart";
import { formatPct, formatRatio, formatUsd } from "./format";
import { exposureFor } from "@/lib/roycopharos/exposure";
import styles from "./overview-table.module.css";

type HistoryPoint = { observedAt: number; value: number | null };

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
  return (
    t.scoreStatus !== "computed" ||
    t.mappingStatus !== "mapped" ||
    (t.statusNormalized != null && t.statusNormalized !== "normal") ||
    (t.coverageHeadroomPct != null && t.coverageHeadroomPct < 10) ||
    (t.utilizationRatio != null && t.utilizationRatio >= 85)
  );
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
  // Group tranches by market while preserving the server's risk-first order.
  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>();
    tranches.forEach((t, i) => {
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
  }, [tranches]);

  return (
    <div className="overview">
      <div className="data-table-wrap">
        <div className={styles.ledger} role="table" aria-label="Vault ledger">
          <div className={styles.headRow} role="row">
            <span role="columnheader">Asset / tranche</span>
            <span role="columnheader">APY</span>
            <span role="columnheader">Coverage headroom</span>
            <span role="columnheader">Utilization</span>
            <span role="columnheader">Royco scores</span>
          </div>

          {groups.map((g) => (
            <div key={g.marketKey} className={styles.group} role="rowgroup">
              <div className={styles.summaryRow} role="row">
                <span className={styles.summaryInner} role="cell">
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
              </div>

              {g.tranches.map((t, i) => {
                const lowLiquidity = t.tvlUsd != null && t.tvlUsd < 100_000;
                const flagged = isFlagged(t);
                const isLast = i === g.tranches.length - 1;
                const cls = [styles.subRow, lowLiquidity ? styles.lowLiquidity : "", flagged ? styles.flagged : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div key={t.trancheId} className={cls} role="row">
                    <span className={styles.identityCell} role="cell">
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

                    <span className={styles.apyCell} role="cell">
                      <span className={styles.apyValue}>{formatPct(t.apyCurrentPct)}</span>
                      <span className={styles.apy7d}>7d {formatPct(t.apy7dPct)}</span>
                      {(t.history?.apy ?? []).filter((p) => p.value != null).length >= 2 ? (
                        <MiniChart points={t.history!.apy} label={`${t.side} APY history`} className="spark-mini apySpark" />
                      ) : null}
                    </span>

                    <span className={styles.barCell} role="cell">
                      <span className={styles.barFigure}>{formatPct(t.coverageHeadroomPct)}</span>
                      <MicroBar
                        value={t.coverageHeadroomPct}
                        max={100}
                        level={headroomLevel(t.coverageHeadroomPct)}
                        label={`Coverage headroom ${formatPct(t.coverageHeadroomPct)}`}
                      />
                    </span>

                    <span className={styles.barCell} role="cell">
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

                    <span className={styles.divCell} role="cell">
                      <ScorePair
                        safetyScore={t.safetyScore}
                        opportunityScore={t.opportunityScore}
                        safetyGrade={t.safetyGrade}
                        opportunityGrade={t.opportunityGrade}
                        status={t.scoreStatus}
                        showLabels={false}
                      />
                      {t.scoreStatus !== "computed" ? <DataBadge value={t.scoreStatus} /> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          {groups.length === 0 ? (
            <div className="overview-empty" role="row">
              <span role="cell">No tranches available.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
