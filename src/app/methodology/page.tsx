import { getMethodology } from "@/lib/roycopharos/repository";
import { structureFactorRows } from "@/lib/roycopharos/scoring";
import { GradeBadge } from "@/components/roycopharos/grade";
import { TwoGradeFlow } from "@/components/roycopharos/diagrams/two-grade-flow";
import { GradeRuler } from "@/components/roycopharos/diagrams/grade-ruler";
import { ThreeLayer } from "@/components/roycopharos/diagrams/three-layer";
import { WaterfallExplainer } from "@/components/roycopharos/diagrams/waterfall-explainer";
import { PenaltyTaxonomy } from "@/components/roycopharos/diagrams/penalty-taxonomy";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function SectionHead({ n, title, id }: { n: number; title: string; id: string }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionNum} aria-hidden="true">
        {n}
      </span>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
    </div>
  );
}

export default async function MethodologyPage() {
  const methodology = await getMethodology();
  const factorRows = structureFactorRows();

  return (
    <main className="page-shell">
      <section className="page-heading">
        <div>
          <h1>Methodology</h1>
          <p>
            This Royco risk view rates Dawn yield tranches risk-first. It models each tranche in three layers, then
            leads with two independent numbers: a Safety score for capital downside and an Opportunity score for
            risk-adjusted yield.
          </p>
        </div>
        <div className="quiet-panel method-version">
          <span className="metric-label">Methodology version</span>
          <span className="metric-value">{methodology.version}</span>
          <span className="metric-note">
            Higher Royco scores are better. Pharos base-asset grades remain visible as source inputs.
          </span>
        </div>
      </section>

      {/* Intro: how to read a score */}
      <section className={styles.lede}>
        <div className={styles.ledeProse}>
          <p>
            Every tranche carries two Royco scores. Read them as a pair. The <strong>Safety score</strong>{" "}
            answers how protected the tranche seat is after base-asset, exposure, and tranche-structure risk. The{" "}
            <strong>Opportunity score</strong> answers whether the yield pays fairly for that risk. Pharos&apos; own letter
            grade stays attached to the base asset only.
          </p>
          <p>
            The gap between the two numbers is the signal. A Junior with low Safety but high Opportunity is telling you
            the yield may be paying for real first-loss risk. The sections below build up each score from the data, with a
            visual model for every step.
          </p>
        </div>
      </section>

      {/* 1. The two scores */}
      <section className={styles.section}>
        <SectionHead n={1} id="two-scores" title="The two scores" />
        <div className={styles.split}>
          <div className={styles.prose}>
            <p>
              <strong>{methodology.safetyScoreName}</strong> measures tranche capital risk. It uses the Pharos base
              Safety Score as Layer 1, subtracts a bounded curated exposure haircut in Layer 2, then applies Layer 3
              tranche mechanics: Senior cushion credit and bounded structure penalties. Pharos rates the base asset;
              this Royco view rates the seat.
            </p>
            <div className={styles.formula}>
              <span className={styles.formulaLabel}>Safety formula</span>
              <pre className="method-formula">{methodology.safetyFormula}</pre>
            </div>
            <p>
              <strong>{methodology.opportunityScoreName}</strong> measures reward per unit of risk. It haircuts APY by
              the safety fraction, then normalizes the result to 0..100. A high-yield Junior can earn a strong
              Opportunity score while its Safety score honestly stays low. It is a transparent heuristic, not a Sharpe
              ratio.
            </p>
            <div className={styles.formula}>
              <span className={styles.formulaLabel}>Opportunity formula</span>
              <pre className="method-formula">{methodology.opportunityFormula}</pre>
            </div>
          </div>
          <div className={styles.diagramPanel}>
            <p className={styles.diagramCaption}>Each score as a flow from inputs to a Royco number</p>
            <TwoGradeFlow />
          </div>
        </div>
      </section>

      {/* 2. Score bands */}
      <section className={styles.section}>
        <SectionHead n={2} id="rulers" title="Score bands" />
        <p className={styles.prose} style={{ marginBottom: 18 }}>
          These bands are the color system behind the numeric badges. A Safety score is calibrated 0 to 100. Opportunity
          starts from risk-adjusted net yield and is normalized to 0 to 100 for display, while the yield bands remain
          available for calibration and API compatibility.
        </p>
        <div className={styles.rulerPanel}>
          <GradeRuler safetyBands={methodology.safetyBands} opportunityBands={methodology.opportunityBands} />
        </div>
      </section>

      {/* 3. Three-layer model */}
      <section className={styles.section}>
        <SectionHead n={3} id="three-layer" title="The three-layer model" />
        <div className={styles.split}>
          <div className={styles.prose}>
            <p>
              Each tranche is built from three layers. Layer 1 is the vault input and its Pharos score. Layer 2 is the
              exposure: the strategy, the yield source, services and protocols used, and what breaks them. Layer 3 is
              the tranche structure: your seat in the waterfall, the buffer beneath you, and utilization.
            </p>
            <ul>
              {methodology.layerFactors.map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
            </ul>
            <p>
              The Pharos score is not a ceiling. A well-buffered Senior can score above the whole vault because Junior
              capital absorbs losses first. A Junior can score below the vault because it is the first-loss seat.
            </p>
          </div>
          <div className={styles.diagramPanel}>
            <p className={styles.diagramCaption}>Vertical cross-section, vault input to tranche seat</p>
            <ThreeLayer />
          </div>
        </div>
      </section>

      {/* 4. Senior vs Junior + waterfall */}
      <section className={styles.section}>
        <SectionHead n={4} id="senior-junior" title="How Senior and Junior differ" />
        <div className={styles.split}>
          <div className={styles.prose}>
            <p>
              Senior tranche: junior-buffered exposure. Senior can still lose value if losses exceed the Junior buffer,
              market mechanics fail, data is stale, or the underlying asset deteriorates.
            </p>
            <p>
              Junior tranche: first-loss exposure. The first-loss term is buffer-scaled, so the thinner the buffer
              beneath it, the heavier the term, and utilization bites earlier and harder. Junior&apos;s compensation for
              first loss is its yield, which is rewarded in the Opportunity score, not double-penalized in Safety.
            </p>
          </div>
          <div className={styles.diagramPanel}>
            <p className={styles.diagramCaption}>Worked example: which seat absorbs losses first</p>
            <WaterfallExplainer />
          </div>
        </div>
      </section>

      {/* 5. Tranche-structure factors + structure weights + penalty taxonomy */}
      <section className={styles.section}>
        <SectionHead n={5} id="structure" title="Tranche-structure factors" />
        <div className={styles.prose} style={{ marginBottom: 22 }}>
          <p>
            The haircut is built from these factors. The total is bounded by a per-side cap and combined with diminishing
            returns, so penalties saturate rather than stack linearly.
          </p>
          <ul>
            {methodology.structureFactors.map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
          </ul>
        </div>

        <h3 className="section-title">Structure weights</h3>
        <p className={styles.prose} style={{ marginBottom: 14 }}>
          These weights are rendered directly from the scoring constants the engine uses, so this table cannot drift from
          the computed scores. Utilization and the Junior first-loss term are curve-based and shown as ranges.
        </p>
        <div className={styles.factorScroll}>
          <table className="method-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Senior</th>
                <th>Junior</th>
              </tr>
            </thead>
            <tbody>
              {factorRows.map((row) => (
                <tr key={row.factor}>
                  <td>{row.factor}</td>
                  <td className="mono">{row.senior}</td>
                  <td className="mono">{row.junior}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="section-title" style={{ marginTop: 32 }}>
          Penalty taxonomy
        </h3>
        <p className={styles.prose} style={{ marginBottom: 18 }}>
          Every factor belongs to one of four risk categories and carries a severity tier. Severity orders the factors
          from a quiet note to a critical deduction, and it is the color you see on a tranche&apos;s breakdown.
        </p>
        <div className={styles.diagramPanel}>
          <PenaltyTaxonomy />
        </div>
      </section>

      {/* 6. Bands tables */}
      <section className={styles.section}>
        <SectionHead n={6} id="bands" title="Band tables" />
        <p className={styles.prose} style={{ marginBottom: 18 }}>
          A given score maps to the same internal band every snapshot. These bands drive color and compatibility fields;
          the product-facing Royco outputs are the numeric scores.
        </p>
        <div className="band-grid">
          <div>
            <h3>Safety bands</h3>
            <table className="method-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Score ≥</th>
                </tr>
              </thead>
              <tbody>
                {methodology.safetyBands.map((band) => (
                  <tr key={band.grade} className={styles.bandRow}>
                    <td>
                      <span className={styles.bandBadgeCell}>
                        <GradeBadge grade={band.grade} size="sm" />
                      </span>
                    </td>
                    <td className="mono">{band.min}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Opportunity bands (net yield %)</h3>
            <table className="method-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Net yield ≥</th>
                </tr>
              </thead>
              <tbody>
                {methodology.opportunityBands.map((band) => (
                  <tr key={band.grade} className={styles.bandRow}>
                    <td>
                      <span className={styles.bandBadgeCell}>
                        <GradeBadge grade={band.grade} size="sm" />
                      </span>
                    </td>
                    <td className="mono">{band.min}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. Missing data + freshness */}
      <section className={styles.section}>
        <SectionHead n={7} id="limitations" title="Missing data, freshness, and limitations" />
        <div className={styles.prose}>
          <p>
            Missing market status, coverage, utilization, or tranche TVL adds an uncertainty term and sets the row to low
            confidence. Missing Pharos vault Safety Score, or an invalid tranche side, produces NR rather than a
            silent F.
          </p>
          <p>{methodology.disclaimer}</p>
        </div>
      </section>
    </main>
  );
}
