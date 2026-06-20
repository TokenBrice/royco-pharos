# Product

## Register

product

## Users

Primary: **depositors / yield seekers** deciding where to place capital across Royco Dawn's tranches. They need to understand the Safety versus Opportunity tradeoff of a Senior (protected) versus Junior (first-loss) seat *before* committing their own money. They arrive wanting yield; the product's job is to make the risk behind that yield legible at a glance so the choice is informed, not blind. Their context is evaluation, not entertainment: they need to know the numbers in front of them are current and complete before they act on them.

Secondary: allocators and risk analysts sizing positions across the book, the operator running the prototype, and the Royco / Pharos stakeholders the prototype is built to win over. It wins them precisely *by* serving depositors well, so depositor clarity is the through-line, not a separate mode.

## Product Purpose

RoycoPharos scores all 18 direct Royco Dawn tranches risk-first, using Pharos as the vault/base-asset risk source while independently grading Senior and Junior tranche seats. Higher Safety scores are safer; missing underlying Pharos scores are NR. The product exists to make tranche risk legible at a glance and honest about what it doesn't know. Success is a reader who can tell, in seconds, both how a tranche is graded and whether the data behind that grade can be trusted.

## Brand Personality

Analytical, restrained, trustworthy. The voice is a risk desk, not a yield-farming dashboard: it states what it measured, shows its work, and flags uncertainty instead of hiding it. Three words: precise, honest, calm. Emotionally, a healthy state should read as quiet confidence; a degraded state should read as a clear, unalarmed heads-up.

## Anti-references

- **Crypto-hype dashboards.** Neon gradients, glowing "all good" badges, casino-green numbers going up. The product earns trust by being sober.
- **Bare JSON dumps.** A key-value restyling of the API response with no verdict and no hierarchy. Data without a conclusion is not a page.
- **Over-built ops consoles.** Grafana-style walls of gauges and sparklines for an 18-row prototype. Density must be earned by the information, not performed.

## Design Principles

- **Honest about uncertainty.** NR, low-confidence, stale, and degraded states are first-class. Never launder missing data into a confident-looking number.
- **Lead with the verdict.** Every surface answers the reader's actual question first (is it safe / is it fresh), then lets them drill into the evidence.
- **Calm when healthy, clear when not.** A clean state is quiet; a problem state raises exactly one unambiguous flag, colored only where it matters.
- **Show the work.** Grades, freshness, and coverage trace back to visible inputs and formulas, so the reader can audit the conclusion.

## Accessibility & Inclusion

Dual light/dark theme with semantic OKLCH tokens; body text targets WCAG AA contrast against its surface. Color is never the only signal: status carries a label and shape alongside its hue, so the grade and freshness systems remain legible under color blindness. Reduced-motion is honored globally; the ticking "age" and any reveals collapse to a static state under `prefers-reduced-motion: reduce`.
