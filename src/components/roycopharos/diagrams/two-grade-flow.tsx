import { NumericScoreBadge } from "../grade";
import styles from "./two-grade-flow.module.css";

/**
 * A small horizontal flow per score: input boxes joined by operator glyphs,
 * ending in a number. Mono for the math; tokens only. Pure, server-renderable.
 */
function Flow({
  label,
  steps,
  score,
  ariaLabel,
}: {
  label: string;
  steps: { text: string; op?: string; tone?: "input" | "haircut" | "factor" }[];
  score: number;
  ariaLabel: string;
}) {
  return (
    <figure className={styles.flow} role="img" aria-label={ariaLabel}>
      <figcaption className={styles.flowLabel}>{label}</figcaption>
      <div className={styles.track}>
        {steps.map((step, i) => (
          <span key={step.text} className={styles.node}>
            {step.op ? (
              <span className={styles.op} aria-hidden="true">
                {step.op}
              </span>
            ) : null}
            <span className={styles.box} data-tone={step.tone ?? "input"}>
              {step.text}
            </span>
            {i === steps.length - 1 ? (
              <span className={styles.op} aria-hidden="true">
                →
              </span>
            ) : null}
          </span>
        ))}
        <span className={styles.result}>
          <NumericScoreBadge score={score} size="lg" label={`${label} example`} />
        </span>
      </div>
    </figure>
  );
}

export function TwoGradeFlow() {
  return (
    <div className={styles.wrap}>
      <Flow
        label="Royco Safety Score"
        ariaLabel="Safety score flow: Pharos base score minus exposure haircut plus senior cushion credit minus bounded tranche penalties yields the Safety score."
        score={74}
        steps={[
          { text: "Pharos vault\nscore", tone: "input" },
          { text: "exposure\nhaircut", op: "−", tone: "haircut" },
          { text: "Senior cushion\ncredit", op: "+", tone: "factor" },
          { text: "bounded\ntranche penalties", op: "−", tone: "haircut" },
        ]}
      />
      <Flow
        label="Royco Opportunity Score"
        ariaLabel="Opportunity score flow: APY times Safety over 100, normalized to 100, yields the Opportunity score."
        score={91}
        steps={[
          { text: "APY", tone: "input" },
          { text: "Safety / 100", op: "×", tone: "factor" },
        ]}
      />
    </div>
  );
}
