import styles from "./three-layer.module.css";

/**
 * Vertical cross-section: Layer 1 vault/base asset -> Layer 2 exposure ->
 * Layer 3 tranche seat. Pharos rates the vault; RoycoPharos rates each seat.
 * Bespoke CSS, tokens only.
 */
const LAYERS = [
  {
    n: "3",
    title: "Tranche structure",
    body: "Senior or Junior seat, buffer, utilization. Senior can receive cushion credit; Junior absorbs first loss.",
    tone: "wrapper",
  },
  {
    n: "2",
    title: "Exposure",
    body: "Strategy class, yield source, what breaks it, exit mechanics. These define the vault risk both seats share.",
    tone: "wrapper",
  },
  {
    n: "1",
    title: "Vault input",
    body: "The underlying stablecoin or vault and its Pharos Safety Score, shown verbatim.",
    tone: "base",
  },
] as const;

export function ThreeLayer() {
  return (
    <figure
      className={styles.fig}
      role="img"
      aria-label="Three-layer cross-section. Pharos rates the vault input. Exposure describes shared vault risk. Tranche structure then separates Senior cushion from Junior first-loss risk."
    >
      <div className={styles.stack}>
        {LAYERS.map((layer) => (
          <div key={layer.n} className={styles.layer} data-tone={layer.tone}>
            <span className={`mono ${styles.num}`}>{layer.n}</span>
            <div className={styles.text}>
              <strong className={styles.title}>{layer.title}</strong>
              <span className={styles.body}>{layer.body}</span>
            </div>
            {layer.tone === "wrapper" ? (
              <span className={styles.subtract} aria-hidden="true">
                risk layer
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <p className={styles.ceiling}>
        Pharos is the vault input. RoycoPharos then grades each tranche seat independently.
      </p>
    </figure>
  );
}
