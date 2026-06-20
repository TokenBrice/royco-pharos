import { DataBadge } from "./badges";
import { formatPct } from "./format";
import { GradeBadge } from "./grade";

type PenaltyRow = {
  key: string;
  label: string;
  explanation: string;
  rawPenalty: number;
  appliedPenalty: number;
  severity: "info" | "watch" | "warning" | "critical";
};

const SEVERITY_VAR: Record<PenaltyRow["severity"], string> = {
  info: "var(--sev-info)",
  watch: "var(--sev-watch)",
  warning: "var(--sev-warning)",
  critical: "var(--sev-critical)",
};

type RiskPanelTranche = {
  side: "senior" | "junior";
  depositTokenSymbol: string | null;
  underlyingSafetyScore: number | null;
  underlyingSafetyGrade: string | null;
  trancheHaircut: number | null;
  safetyScore: number | null;
  safetyGrade: string | null;
  apyUsedPct: number | null;
  opportunityYield: number | null;
  opportunityGrade: string | null;
  scoreStatus: string;
  nrReason: string | null;
  penaltyBreakdown: PenaltyRow[];
  coverageHeadroomPct: number | null;
  utilizationRatio: number | null;
};

export function RiskPanel({ tranche }: { tranche: RiskPanelTranche }) {
  return (
    <section className="risk-panel" aria-labelledby={`risk-${tranche.side}`}>
      <div className="risk-panel-heading">
        <div>
          <h3 id={`risk-${tranche.side}`}>
            {tranche.side === "senior" ? "Senior tranche" : "Junior tranche"} risk panel
          </h3>
          <p className="subtle">
            {tranche.side === "senior" ? "Senior tranche: junior-buffered exposure" : "Junior tranche: first-loss exposure"}
          </p>
        </div>
        <div className="grade-pair">
          <span className="grade-pair-item">
            <span className="metric-label">Safety</span>
            <GradeBadge grade={tranche.safetyGrade} status={tranche.scoreStatus} />
          </span>
          <span className="grade-pair-item">
            <span className="metric-label">Opportunity</span>
            <GradeBadge grade={tranche.opportunityGrade} status={tranche.scoreStatus} />
          </span>
        </div>
      </div>

      <div className="score-stack">
        <div className="score-line">
          <span>Base asset (Pharos Safety Score)</span>
          <strong>
            {tranche.underlyingSafetyScore == null ? "NR" : `${tranche.underlyingSafetyScore} (${tranche.underlyingSafetyGrade})`}
          </strong>
        </div>
        <div className="score-line">
          <span>Tranche-structure haircut</span>
          <strong>{tranche.trancheHaircut == null ? "NR" : `-${tranche.trancheHaircut}`}</strong>
        </div>
        <div className="score-line emphasis">
          <span>Royco Safety Score</span>
          <strong>{tranche.safetyScore == null ? "NR" : `${tranche.safetyScore} (${tranche.safetyGrade})`}</strong>
        </div>
        <div className="score-line">
          <span>Risk-adjusted yield (APY {formatPct(tranche.apyUsedPct)})</span>
          <strong>{tranche.opportunityYield == null ? "NR" : `${tranche.opportunityYield.toFixed(1)}% net`}</strong>
        </div>
      </div>

      <div className="risk-flags">
        <DataBadge value={tranche.scoreStatus} />
        <span>{tranche.depositTokenSymbol ?? "Unmapped underlying"}</span>
        <span>Coverage headroom {formatPct(tranche.coverageHeadroomPct)}</span>
        <span>Utilization {formatPct(tranche.utilizationRatio)}</span>
      </div>

      {tranche.nrReason ? <p className="warning-copy">{tranche.nrReason}</p> : null}

      <div className="breakdown-list">
        {tranche.penaltyBreakdown
          .filter((row) => row.appliedPenalty > 0)
          .slice(0, 6)
          .map((row) => (
            <div className="breakdown-row" key={row.key}>
              <div>
                <strong>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 9,
                      marginRight: 8,
                      borderRadius: "50%",
                      verticalAlign: "middle",
                      background: SEVERITY_VAR[row.severity],
                    }}
                  />
                  {row.label}
                </strong>
                <span>{row.explanation}</span>
              </div>
              <strong>-{row.appliedPenalty.toFixed(1)}</strong>
            </div>
          ))}
      </div>
    </section>
  );
}
