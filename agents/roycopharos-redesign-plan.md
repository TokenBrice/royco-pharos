# RoycoPharos — Visual Redesign Plan

**Goal:** take RoycoPharos from a bare prototype (black text on cream, no charts, no color-coding, clunky structure) to a Pharos-grade product surface: clear, well-structured, compelling, cohesive, self-explanatory. This is the artifact we show to win the contract, so the UI carries the argument.

**Status:** design plan, ready to build. No code shipped yet. Stack stays as-is (Next.js 16 / React 19, plain CSS in `globals.css`, `lucide-react`, hand-built SVG for charts: no new chart dependency).

**Confirmed direction (from review):**
- **Base canvas: dual theme.** Light editorial is the default; dark risk-terminal is a toggle. Both are generated from one semantic-token layer, so every component is authored once and re-skinned by CSS variables.
- **Color level: committed spectrum.** A single engineered A→F grade ramp is the organizing visual system. One hue means exactly one thing; the canvas stays neutral so the grades carry the signal.

---

## 0. The one-paragraph thesis the UI must sell

RoycoPharos rates Royco Dawn stablecoin yield tranches *risk-first*. Pharos scores the underlying stablecoin (0–100, A–F). Royco wraps it into a Senior (protected) and a Junior (first-loss) tranche. RoycoPharos overlays two independent grades per tranche: **Safety** (capital downside, A–F) and **Opportunity** (risk-adjusted yield, A–F), plus the raw APY. The product's single most important idea is the **divergence** between those two grades: a Junior that is Safety-E but Opportunity-A means the yield richly pays for real first-loss risk. Every screen should make that divergence visible, color-coded, and self-explanatory. The redesign turns that idea into the spine of the visual system.

---

## 1. Diagnosis: why the current build reads as a prototype

The current UI is not just plain, it triggers several of the specific failure patterns a design reviewer flags on sight. Naming them keeps the redesign honest.

| Current tell | Where | Why it reads as unfinished |
|---|---|---|
| Warm cream/paper background (`#f7f8f3` / `#fffefa`) | global | The 2026 AI-default body background. Reads as "generated," and warm-neutral fights a cool, precise, financial product. |
| Grade badges are solid black squares regardless of grade | everywhere `ScoreBadge` is used | The product's entire point is the grade, and the grade carries **no color**. An A and an F look identical. This is the single biggest miss. |
| Hero = title + paragraph + 3-cell freshness strip + 3 identical icon-cards | homepage | The freshness strip and "data/mapping warnings" count are footer-grade telemetry promoted to the hero. The three icon+label+number cards are the textbook identical-card-grid + hero-metric template. |
| Almost no data visualization | all pages | A risk product with 30 days of coverage/utilization/APY/TVL history renders four thin monochrome sparklines and otherwise pure text. |
| Card-in-card, full-width text blocks | vault page | Poor use of vertical space: long single-column prose panels where dense, modular viz belongs. |
| A full semantic palette defined but unused | `globals.css` | `--blue`, `--gold`, `--danger` exist but barely appear. Color is declared, not deployed. |
| Methodology is prose + two tiny tables | `/methodology` | An important explainer with no diagram, no infographic, no visual model of the three layers or the waterfall. |

The good news: the data model is rich (every field below is real and already computed), the information architecture (two grades, three layers) is sound, and the React structure is clean. This is a **visual and structural** redesign on a solid data spine, not a rebuild.

---

## 2. What the data lets us show (the raw material for color and charts)

This drives every chart and color decision. All of this is already in the snapshot.

- **Per tranche:** `safetyScore` (0–100), `safetyGrade` (A–F/NR), `opportunityYield` (%), `opportunityGrade`, `apyCurrentPct` + `apy7dPct`, `trancheHaircut` (points), `tvlUsd`, `coverageRatio` / `requiredCoverageRatio` / `coverageHeadroomPct`, `utilizationRatio` / `utilizationLimitRatio`, `drawdownRatio`, `scoreStatus` (computed / low_confidence / nr / stale), `mappingStatus` (mapped / unmapped / conflict), `statusNormalized` (normal / protected / unhealthy / critical), `nrReason`, and a **`penaltyBreakdown[]`** (per-factor `label`, `riskCategory` ∈ {loss-risk, liquidity-friction, data-confidence, access-friction}, `appliedPenalty` points, `severity` ∈ {info, watch, warning, critical}, `explanation`).
- **Per market/vault:** `tvlUsd`, `coverageRatio`, `requiredCoverageRatio`, `drawdownRatio`, `utilizationRatio` / `utilizationLimitRatio`, `statusNormalized`, plus the two tranches and the underlyings.
- **Per underlying:** Pharos `underlyingSafetyScore` / `underlyingSafetyGrade`, `price` (peg), `supplyUsd`, `summary`, exposure profile (`strategyClass`, `yieldSource`, `primaryRisk`, `liquidityProfile`, `pegBehavior`).
- **History (30 days, per sync):** market `coverage`, `utilization`, `tvl`; tranche `apy`, `tvl`.
- **Bands (stable, render from code):** Safety A≥70, B≥60, C≥50, D≥40, E≥30, F≥0. Opportunity (net yield %) A≥12, B≥8, C≥5, D≥3, E≥1.5, F≥0.
- **Scale:** 9 markets, 18 tranches, 9 underlyings. Current distribution: 1A / 3B / 4C / 3D / 2E / 5F.

---

## 3. The design system

Everything below is authored against **semantic tokens**. Components never reference a raw color or a theme name; they reference `--bg`, `--ink`, `--grade-d`, `--status-critical`, etc. Switching `data-theme` on `<html>` re-skins the whole app.

### 3.1 Color — dual-theme tokens + the spectrum grade ramp

**Strategy:** Committed. Neutrals are tinted toward the brand hue (cool slate-blue, hue ≈ 250, the "lighthouse beam," not warm-by-reflex). Saturated color is rationed to exactly two jobs: **grades** and **status**. Because the canvas is otherwise neutral, a single grade chip reads instantly and a column of them becomes a legible heat field.

**The grade ramp** is one engineered diverging scale, A (safe) → F (worst), anchored **teal-green → red-orange** rather than pure green → red. The teal anchor plus a strong lightness path keeps adjacent grades distinguishable under deuteranopia/protanopia. Color is never the only channel: the grade **letter**, its **fixed slot/position**, and (for the chip) a small **position tick** always travel with it.

Hues are constant across themes; lightness and chroma are tuned per theme so chips glow on dark and stay legible on light.

| Grade | Hue | Light fill | Light letter | Dark fill | Dark letter |
|---|---|---|---|---|---|
| A | 165 | `oklch(0.60 0.13 165)` | white | `oklch(0.80 0.15 165)` | near-black |
| B | 145 | `oklch(0.62 0.14 145)` | white | `oklch(0.83 0.16 145)` | near-black |
| C | 110 | `oklch(0.80 0.15 110)` | ink | `oklch(0.86 0.16 110)` | near-black |
| D | 75  | `oklch(0.78 0.15 75)`  | ink | `oklch(0.81 0.16 75)`  | near-black |
| E | 45  | `oklch(0.65 0.18 45)`  | white | `oklch(0.73 0.18 45)`  | near-black |
| F | 25  | `oklch(0.56 0.20 25)`  | white | `oklch(0.65 0.20 25)`  | near-black |
| NR | 250 | `oklch(0.72 0.012 250)` | ink (dashed border) | `oklch(0.50 0.012 250)` | ink (dashed) |

Text rule is simple per theme: **light** chips use white letters except the two lightest (C, D) which use ink; **dark** chips use near-black letters throughout (fills are bright). The bold chip letter is large-text for WCAG, so the ≥3:1 bar applies; every pair above clears it, but exact values get contrast-verified in-browser during build.

Each grade also exposes a **wash** (subtle background tint, same hue) for large fills and flagged-row backgrounds:
- Light wash: `oklch(0.95 0.04 <hue>)`
- Dark wash: `oklch(0.30 0.05 <hue>)`

**Status** reuses the ramp family so the app has one color language (one hue, one meaning):
- `normal` → quiet neutral-green dot (do not paint the whole portfolio green; normal is the absence of alarm)
- `protected` → brand blue (hue 250) = "shielded," not "bad"
- `unhealthy` → amber (≈ D/E)
- `critical` → red (= F)

**Neutrals (the canvas):**

```css
:root {                              /* LIGHT (default) */
  color-scheme: light;
  --bg:            oklch(0.99  0.004 250);
  --surface-1:     oklch(0.975 0.006 250);
  --surface-2:     oklch(0.95  0.008 250);
  --ink:           oklch(0.24  0.02  255);   /* ~13:1 on --bg */
  --muted:         oklch(0.48  0.02  255);   /* ~6:1  on --bg */
  --hairline:      oklch(0.89  0.008 250);
  --hairline-strong: oklch(0.82 0.01 250);
  --brand:         oklch(0.52  0.15  250);   /* links, focus, selection, "protected" */
  --shadow-1: 0 1px 2px oklch(0.24 0.02 255 / 6%), 0 8px 24px oklch(0.24 0.02 255 / 6%);
}
html[data-theme="dark"] {            /* DARK (toggle) */
  color-scheme: dark;
  --bg:            oklch(0.17  0.012 250);
  --surface-1:     oklch(0.21  0.013 250);
  --surface-2:     oklch(0.25  0.014 250);
  --surface-3:     oklch(0.29  0.015 250);   /* overlays/popovers */
  --ink:           oklch(0.96  0.004 250);   /* ~15:1 on --bg */
  --muted:         oklch(0.72  0.012 250);   /* ~6.3:1 on --bg */
  --hairline:      oklch(0.32  0.014 250);
  --hairline-strong: oklch(0.40 0.014 250);
  --brand:         oklch(0.70  0.13  250);
  --shadow-1: none;                          /* dark depth = surface lightness, not shadow */
}
```

The full grade/status token block lives in the Appendix as copy-paste CSS.

**Cream-ban compliance:** the light background sits at hue 250 (cool), chroma 0.004, not the warm 40–100 band. If the cool cast reads tinted on a poor panel, fall back to true `oklch(0.99 0 0)`. We never tint a neutral toward warm "for friendliness."

### 3.2 Typography — three families, clear roles

Product UI wants a disciplined, mostly-fixed type system. We use three families on a real contrast axis, each with one job:

- **Serif display — `"Source Serif 4", Georgia, serif`:** the hero lead sentence and major section titles only. This is the editorial "research dossier" signal and the main thing separating us from generic dark SaaS dashboards. Used sparingly.
- **Sans UI/body — `"Inter", system-ui, sans-serif`:** all labels, controls, prose, table text.
- **Mono numerics — `"IBM Plex Mono", ui-monospace`:** every number, every grade letter, all chart axes. `font-variant-numeric: tabular-nums` so columns align to the pixel and chips feel instrument-grade.

**Scale (fixed rem, product-grade):** 0.75 / 0.8125 / 0.875 / **1 (16px body)** / 1.125 / 1.25 / 1.5 / 1.875 / 2.5 / 3.25. Only the hero lead may use a single modest `clamp()` (max ≈ 3.25rem, well under the 6rem ceiling). **Weights:** 400 body, 500 labels/active, 600 headings + key figures + grade letters. No 700+, no thin display weights. Prose measure capped at 68ch; tables run dense.

### 3.3 Spacing, radius, elevation

- **Spacing scale (4px base):** 4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96. Vary the rhythm: tight inside data rows, generous between page sections.
- **Radius:** `--r-sm 6px` (chips, inputs), `--r-md 10px` (panels), `--r-lg 14px` (hero/feature modules), `--r-pill 999px` (status dots, toggles).
- **Elevation:** light theme uses two soft shadow tokens for raised modules. Dark theme sets shadows to `none` and uses the `surface-1/2/3` lightness ladder for depth (per dark-mode best practice). Borders are always hairline 1px. **No side-stripe accent borders** anywhere: state is shown by full hairline + wash + glyph.

### 3.4 Motion

Product motion: 150–250ms, state-conveying, never decorative choreography.
- Chip/row hover, focus rings, control toggles: 150ms ease-out.
- Table sub-line disclosure (if collapsible) and theme crossfade: 200ms.
- Charts and the hero scatter animate **in from an already-rendered default** (so they never ship blank on a headless render). Dots/segments may stagger subtly on first paint.
- Every animation has a `@media (prefers-reduced-motion: reduce)` path (instant or crossfade). No page-load sequence; the app loads into a task.

### 3.5 Iconography

Stay on `lucide-react` (already in the project). One set, consistent stroke. Icons support labels; they never carry meaning alone.

---

## 4. Signature components (the visual vocabulary)

These are the reusable objects that make the product feel designed and cohesive. Build them once; they appear across all pages.

1. **Grade chip** — the atom. Filled rounded-rect, mono bold letter (color per the table in 3.1), a small **position tick** (A at top … F at bottom) so it survives grayscale and colorblindness, and the numeric score adjacent in mono. Variants: `sm` (table), `md` (cards), `lg` (dossier masthead). NR = dashed neutral chip, italic. **low_confidence / stale** = a diagonal hatch overlay on the chip (encodes uncertainty without inventing a color), plus a small flag.

2. **Divergence pair** — the product's signature object (all three explored directions converged on it). Safety chip on the left, Opportunity chip on the right, joined by a short connector whose **slope encodes the gap**: rising-to-the-right means Opportunity outranks Safety (yield richly pays for the risk, the money shot), flat means aligned, falling means underpaid. When the gap is ≥2 grades, the connector gains an arrow + delta label and a faint brand highlight. This token appears in the table, the dossier masthead, and the hero.

3. **Safety × Opportunity scatter** — the hero centerpiece. All 18 tranches as dots: x = Safety grade, y = Opportunity grade, dot size = TVL, dot color = Safety grade. The diagonal is "fairly priced"; the upper-left region ("richly paid for risk") is softly outlined. The single most divergent tranche is annotated. This is the entire thesis as one chart. Accessible fallback: an adjacent data table (`role="img"` + label on the SVG).

4. **Portfolio distribution strip** — a single horizontal bar segmented A–F by count (today 1·3·4·3·2·5), each segment in its grade color, count labels in mono. The book's risk shape at a glance. Recurs as a small "portfolio EKG" in the header and on methodology.

5. **Loss waterfall** — vault dossier signature. A vertical stacked bar: Junior buffer (first-loss) at the bottom, Senior above, the **required-coverage threshold** as a dashed line, the **current drawdown** eating up from the bottom in red. You literally see your seat in the waterfall and how much cushion stands between a loss and the Senior. Replaces the current three-cell "loss order" text grid.

6. **Penalty breakdown bar** — vault dossier signature, and the answer to "why is the grade the grade." A horizontal stacked deduction from the base-asset score down to the final Safety score; each segment is one penalty factor, colored by **severity** (info/watch/warning/critical from the status family), grouped and labeled by **risk category**. Hover reveals the factor's explanation. Replaces the current plain `breakdown-row` list.

7. **Three-layer stack** — base asset → exposure → tranche structure as three labeled bands, drawn to show the "soft ceiling" logic (the base-asset score caps everything below it; the wrapper only ever subtracts). Each band carries its real data: Layer 1 peg price + deviation + supply + Pharos score; Layer 2 strategy class + yield source + what breaks it + exit mechanics; Layer 3 the waterfall seat + buffer + utilization.

8. **History small-multiples** — coverage, utilization, APY (Senior + Junior), TVL as compact line charts sharing an x-axis, 30 days, with **threshold markers** (utilization limit line, required-coverage line) and a current-value callout. Replaces the four bare sparklines. Single point in the series renders a "collecting history" state, never a fake trend.

9. **Dual-line ledger row** — the homepage table unit (detailed in 5.1).

10. **Micro-bars & gauges** — inline coverage-headroom and utilization bars (fill vs limit, color shifts to amber/red past threshold) used in table cells and dossier metrics.

11. **Status dot** — pill dot + label for `normal / protected / unhealthy / critical`, in the status colors, with text label always present.

**Grade chip, concrete sketch:**

```jsx
// data-grade drives the color via CSS var; letter + tick + score are the redundant channels
<span className="grade-chip" data-grade={grade} data-status={scoreStatus}>
  <span className="grade-chip__letter">{grade ?? "NR"}</span>
  <span className="grade-chip__tick" aria-hidden />   {/* position A..F */}
  <span className="grade-chip__score">{score ?? "—"}</span>
</span>
```
```css
.grade-chip { background: var(--grade-fill); color: var(--grade-letter); border-radius: var(--r-sm); }
.grade-chip[data-grade="A"] { --grade-fill: var(--grade-a); --grade-letter: var(--grade-a-on); }
/* … B–F, NR … */
.grade-chip[data-status="low_confidence"],
.grade-chip[data-status="stale"] { background-image: repeating-linear-gradient(45deg,
  transparent 0 4px, oklch(0 0 0 / 12%) 4px 6px); }   /* hatch = uncertainty */
```

---

## 5. Page redesigns

### 5.1 Homepage — hero rework (#2) + dual-line table (#1)

**Hero (replaces title + paragraph + freshness strip + 3 icon-cards).** The new hero leads with the argument, not telemetry:

```
RoycoPharos                                    [data fresh · updated 1m ago] [☾ theme]
─────────────────────────────────────────────────────────────────────────────────────
18 tranches across 9 markets, rated risk-first.            ← serif lead (the thesis)
The gap between Safety and Opportunity is the signal.

Grade book   A▓ B▓▓▓ C▓▓▓▓ D▓▓▓ E▓▓ F▓▓▓▓▓        ← distribution strip (color-coded)
             1   3    4    3   2   5   · 18 rated

┌───────────────────────────────┐   Today's signal
│  Safety × Opportunity          │   ┌──────────────────────────┐
│  Opp▲    ● ●   ◀ richly paid   │   │ Most divergent            │
│     │  ●     ●     for risk    │   │ apyUSD Junior  S·E → O·A  │
│     │     ●  ●                 │   │ 51.7% APY, first-loss seat│
│     └────────────────▶ Safety  │   └──────────────────────────┘
└───────────────────────────────┘   (links into that vault)
```

- The **serif lead** states the thesis in two short lines. No marketing language.
- The **distribution strip** and **scatter** put the whole portfolio's risk on screen in the first viewport.
- Freshness collapses from a 3-cell strip to **one quiet caption** (`data fresh · updated 1m ago`), with the detail (Royco vs Pharos ages, coverage count) available on hover/in a small popover. It is telemetry, so it is sized like telemetry.
- The three old icon-cards are dissolved into the page: "safest tranche" is the top-right dot in the scatter (and the table's default sort), "utilization pressure" becomes amber micro-bars + a sort, "data/mapping warnings" become inline row flags + the existing "Watchlist only" filter.

**The dual-line ledger table (hard ask #1).** Each vault consolidates into one **summary line** plus two **tranche sub-lines**, with a left-edge grade "heat-spine."

```
        MARKET / VAULT        BASE   TVL     STATUS   COVERAGE 30d   SAFETY  OPP
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ▸ Auto Finance · base autoUSD  C   $103k   ● normal   ▁▂▃▃▄ ↗     range B–C  A–B   │  ← summary (market-level)
│   ├ Senior · junior-buffered                APY 13.4% (7d ▴)  hc 9   util ▤▤▤░ 10%  [S·A]──[O·B]   │  ← tranche subline
│   └ Junior · first-loss                     APY 13.7% (7d ▾)  hc 18  util ▤▤▤░ 10%  [S·B]──[O·B]   │  ← tranche subline
├──────────────────────────────────────────────────────────────────────────────────┤
│ ▸ apyUSD market · base apyUSD  C   $2.1M  ◆ protected ▁▁▂▂▂ →     range E–B  A      │
│   ├ Senior …                                APY 9.1%   hc 11  util ▤▤▤▤▤▤ 78%  [S·B]──[O·B]        │
│   └ Junior …                                APY 51.7%  hc 28  util ▤▤▤▤▤▤ 78%  [S·E]══▶[O·A] ▲3   │  ← the money shot, highlighted
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Summary line (market):** market name + base stablecoin + base grade chip, market TVL, status dot, a 30-day coverage **sparkline** with trend arrow, and the **range** of Safety / Opportunity across its two tranches. Clicking the row (or its chevron) goes to the vault dossier.
- **Two sub-lines (Senior, Junior):** indented with a tree glyph (`├ / └`), each carrying APY (current + a tiny 7d delta caret), haircut points, a utilization **micro-bar** vs limit, a coverage-headroom **micro-bar**, the mapping/score-status flags, and the **divergence pair**. Junior rows naturally surface the hot grades and the money-shot connectors.
- **Heat-spine:** the Safety chips align in a left column so the eye reads the whole book's risk vertically as a field of color.
- **Controls preserved, restyled:** the existing side / chain / status / exposure / grade filters, the sort selector, and "Watchlist only" stay (they are genuinely useful for 18 rows) but adopt the new control styling. Default sort remains risk-first (Safety → coverage headroom → utilization → freshness). Flagged rows get a subtle wash background, not a side-stripe.
- **Low-liquidity / NR / unmapped rows stay visible** (a stated product constraint), marked with the hatch/flag treatment, never hidden.

**Below the table:** the "What changed recently" feed becomes a compact, scannable list (timestamped deltas linking to vaults), not a card. The principal-risk disclaimer stays as a quiet footnote.

### 5.2 Vault page — comprehensive modular research dossier (#3)

Fix the "wastes vertical space, pure text" problem by replacing full-width prose panels with a **responsive module grid** (single column on mobile, two columns where modules pair naturally on desktop) and making each module viz-rich.

**1. Verdict masthead (sticky).** The strong header the current page lacks:
- Market name (serif), base asset + exposure class + chain, market status dot, TVL, current Junior buffer.
- Both tranches' **divergence pairs at `lg` size**, side by side, so Senior vs Junior reads instantly.
- One plain-language **verdict line per tranche**, e.g. "Senior: protected seat, fairly paid." / "Junior: first-loss, richly paid." (No buzzwords, no em dashes.)

**2. Loss waterfall** (signature viz #5) — the centerpiece, with the required-coverage threshold and current drawdown drawn in. Annotation: "Senior is exposed only after the Junior buffer is gone."

**3. Penalty breakdown** (signature viz #6) — one per tranche: the deduction from base-asset score to final Safety, segmented and severity-colored, grouped by risk category. This is the transparency the product promises, made visual.

**4. Three-layer stack** (signature #7) — Layer 1 base asset (peg price + deviation callout when >2% off, supply, Pharos score shown verbatim), Layer 2 exposure (strategy class, yield source, what breaks it, exit mechanics), Layer 3 tranche structure (waterfall seat, buffer, utilization headroom). Drawn as a vertical cross-section so the "soft ceiling" logic is visible.

**5. History small-multiples** (signature #8) — coverage, utilization, Senior/Junior APY, TVL over 30 days, with threshold lines and current-value callouts.

**6. Senior vs Junior comparison** — the existing comparison, restyled into a clean two-column readout, including the "why Junior pays more" deltas (APY spread, extra structural haircut, Safety→Opportunity shift) rendered as labeled stat pairs, not bare cards.

**7. Key metrics** — required buffer, coverage headroom, utilization, drawdown integrated as a compact metric strip with the micro-bar/gauge treatment, not three empty `watch-item` boxes.

The right rail keeps a condensed risk panel per tranche (the existing `RiskPanel`, restyled with the grade chips and severity colors).

### 5.3 Methodology page — structure + infographics + diagrams (#4)

Keep the white-paper voice, add a visual model for every concept. Diagrams are **bespoke SVG/CSS first** (crisp, on-brand, zero new dependency, theme-aware via the same tokens). Mermaid is acceptable as a fast path for the flow/tree diagrams **only if themed** to match tokens; bespoke is preferred for the three hero diagrams so nothing reads as a default render. Diagram inventory:

1. **The two grades, as equations-made-diagram:** `Safety = base score − bounded haircut` and `Opportunity = APY × (Safety/100)`, each shown as a small visual flow (input → operation → grade), not just a `<pre>` formula.
2. **The three-layer model** as a flow / cross-section: base asset → exposure → tranche seat, annotated with the "soft ceiling" rule (the base score caps everything; the wrapper only subtracts). *(Mermaid `flowchart` acceptable here if themed; bespoke SVG preferred.)*
3. **The loss waterfall**, explained with a labeled worked example (reuses the dossier component with callouts).
4. **Score→grade rulers:** 0–100 mapped to A–F as a calibrated colored strip (the ramp as legend), and the Opportunity net-yield→grade ruler beside it. This is the Rosetta stone for the whole color system, so it belongs here prominently.
5. **Penalty taxonomy tree:** the four risk categories → factors → severity tiers. *(Mermaid `graph`/tree acceptable if themed; bespoke preferred.)*
6. **Bands tables** restyled with the ramp colors so each grade row carries its chip.

Structure the page as numbered sections with the serif headers, a 68ch measure for prose, generous margins, and a short "how to read a grade" intro up top. Keep the freshness/limitations disclaimer.

### 5.4 Global shell

- **Header:** brand mark + nav (Overview, Methodology) + a small **portfolio EKG** (the distribution strip in miniature) + the **theme toggle**. Sticky, hairline bottom border, `backdrop-filter` blur is acceptable here (purposeful, not decorative glass).
- **Theme toggle:** persists to `localStorage`; initial value respects `prefers-color-scheme`. Sets `data-theme` on `<html>` before paint (small inline script) to avoid a flash.
- **Footer:** the principal-risk disclaimer + methodology version + data-source note, quiet.

---

## 6. Accessibility & state coverage

- **Contrast:** body ≥4.5:1, large/UI ≥3:1, verified in-browser per theme (DevTools + manual checks). Muted text never drops below 4.5:1 on its surface.
- **Color is never the only channel:** grade letter + position tick + (for uncertainty) hatch; status dot + label; charts get a `role="img"` label and, where practical, an adjacent data table.
- **Colorblind safety:** the teal→red ramp plus the strong lightness path is checked against deuteranopia/protanopia emulation; the redundant letter/position guarantees legibility regardless.
- **Keyboard & focus:** the table, filters, disclosure, and theme toggle are fully keyboard operable; `:focus-visible` rings use `--brand`. Touch targets ≥44px on controls.
- **States to design, not just the happy path:** default, hover, focus, active, disabled, loading (skeleton rows, not spinners), empty (the existing "run sync" message, restyled to teach), **NR** (visible, dashed, with `nrReason`), **low_confidence / stale** (hatch + flag, never silently graded F), single-point history ("collecting history"), long market names / overflow, and the 0-APY fallback to 7d (flagged, never silently 0).

---

## 7. Implementation plan

Phased so each step is shippable and verifiable in-browser. Existing files in parentheses.

| Phase | Work | Key files | Verify |
|---|---|---|---|
| **0. Token foundation** | Replace the `:root` palette with the dual-theme semantic tokens; add grade/status/wash tokens; add `data-theme` + toggle + no-flash script; wire serif/sans/mono fonts. | `globals.css`, `layout.tsx` | Both themes render; toggle persists; fonts load; no FOUC. |
| **1. Grade chip + divergence pair** | Build the chip (color-coded at last), the divergence pair, status dot, micro-bar. Replace the all-black `ScoreBadge`/`StatusBadge`/`DataBadge`. | `badges.tsx` (new `grade-chip.tsx`, `divergence.tsx`) | A vs F now read by color + letter + tick; contrast verified. |
| **2. Homepage hero** | Distribution strip, Safety×Opportunity scatter, serif lead, freshness caption, "most divergent" callout. Remove icon-cards + freshness strip. | `page.tsx`, new `hero/*` SVG components | Hero leads with the thesis; first viewport carries the portfolio. |
| **3. Dual-line ledger table** | Summary row + two tranche sub-lines, heat-spine, inline micro-bars/sparkline/divergence, restyled controls. | `overview-table.tsx`, `globals.css` | Each vault = one summary + two sublines; filters/sort intact; flagged/NR rows visible. |
| **4. Vault dossier** | Verdict masthead, loss waterfall, penalty breakdown, three-layer stack, history small-multiples, restyled comparison + risk panel. | `markets/[marketKey]/page.tsx`, `mini-chart.tsx` → `charts/*`, `risk-panel.tsx` | Vertical space earns its keep; pure-text panels replaced by viz. |
| **5. Methodology** | The six diagrams (bespoke SVG, themed Mermaid where chosen), restyled bands, numbered structure. | `methodology/page.tsx`, new `diagrams/*` | Every concept has a visual; readable and self-explanatory. |
| **6. Polish pass** | Motion + reduced-motion, responsive checks (mobile/tablet/desktop), state coverage, dark-theme parity, contrast re-verify, `npm run build` clean. | all | Defensible in a studio review in both themes. |

**Charts: build with hand-authored SVG** (the viz here are simple: lines, stacked bars, a scatter, ramps). This keeps dependencies at zero per the project's simplicity rule and gives full token/theme control. Reconsider a library only if a future need (zoom, brushing) justifies it.

**Build discipline:** edit source, run `npm run build` and `npm run typecheck`; never write into `.next/`. Verify each phase in the browser (Playwright for reliable load + screenshots, both themes, three viewports) and read the screenshots back before calling a phase done.

---

## 8. Definition of done (acceptance, mapped to the hard asks)

- **#0 Color conveys information:** grades are color-coded by an engineered ramp (was all-black); status, severity, utilization, and coverage all use color semantically; the canvas stays neutral so color reads. ✔ when an A and an F are unmistakable at a glance and the page is no longer monochrome.
- **#1 Homepage table:** every vault is one summary line + two tranche sub-lines, with inline microviz and a grade heat-spine. ✔ when the table reads as 9 vaults, not 18 loose rows, and the money-shot Junior pops.
- **#2 Hero:** reworked completely; leads with the thesis (lead line + distribution strip + scatter), freshness demoted to a caption, icon-cards gone. ✔ when the first viewport sells the product, not the telemetry.
- **#3 Vault dossier:** modular, viz-rich, good vertical-space use; waterfall + penalty breakdown + three-layer + history replace the text walls. ✔ when a reader understands the tranche's risk without reading a paragraph.
- **#4 Methodology:** structured, with infographics/diagrams for the two grades, three layers, waterfall, ramp ruler, and penalty taxonomy. ✔ when a newcomer can explain the grading after one read.
- **Cross-cutting:** dual theme at parity, WCAG AA verified in both, reduced-motion honored, responsive at three viewports, `build` + `typecheck` clean, no console errors, and the page passes the AI-slop test (no cream, no gradient text, no glass-by-default, no hero-metric template, no identical card grids, no per-section eyebrows, no side-stripes).

---

## 9. Risks & open questions

- **Spectrum mid-tones:** C (yellow-green) and D (amber) sit closest in hue; verify they stay distinct on cheaper panels and under colorblind emulation. The letter + position tick are the safety net.
- **Dark/light parity cost:** dual theme roughly doubles the visual QA. Mitigated by the strict semantic-token layer (components authored once). If timeline tightens, ship light first and gate dark behind the toggle as a fast follow (the token layer already supports it).
- **Two serif/sans/mono families on a data UI:** justified by the editorial positioning, but if the serif ever fights legibility at small sizes, drop it to the hero lead only (it is already reserved for display).
- **History depth:** with only a few days of synced history, charts may show short series; the "collecting history" state must be honest, never a synthetic curve.
- **Mermaid vs bespoke:** recommendation is bespoke SVG for the three hero diagrams; confirm whether the team wants Mermaid retained anywhere for ease of future editing (tradeoff: a new dependency + theming work vs. editability).

---

## Appendix A — grade & status token block (copy-paste)

```css
:root {
  /* grade fills (light) + on-color */
  --grade-a: oklch(0.60 0.13 165); --grade-a-on: white;
  --grade-b: oklch(0.62 0.14 145); --grade-b-on: white;
  --grade-c: oklch(0.80 0.15 110); --grade-c-on: var(--ink);
  --grade-d: oklch(0.78 0.15 75);  --grade-d-on: var(--ink);
  --grade-e: oklch(0.65 0.18 45);  --grade-e-on: white;
  --grade-f: oklch(0.56 0.20 25);  --grade-f-on: white;
  --grade-nr: oklch(0.72 0.012 250); --grade-nr-on: var(--ink);
  /* washes (light): same hue, very light */
  --grade-a-wash: oklch(0.95 0.04 165); /* …b 145, c 110, d 75, e 45, f 25 */
  /* status (light) */
  --status-normal:   oklch(0.60 0.13 150);
  --status-protected:var(--brand);
  --status-unhealthy:oklch(0.72 0.16 60);
  --status-critical: oklch(0.56 0.20 25);
}
html[data-theme="dark"] {
  --grade-a: oklch(0.80 0.15 165); --grade-a-on: oklch(0.18 0 0);
  --grade-b: oklch(0.83 0.16 145); --grade-b-on: oklch(0.18 0 0);
  --grade-c: oklch(0.86 0.16 110); --grade-c-on: oklch(0.18 0 0);
  --grade-d: oklch(0.81 0.16 75);  --grade-d-on: oklch(0.18 0 0);
  --grade-e: oklch(0.73 0.18 45);  --grade-e-on: oklch(0.18 0 0);
  --grade-f: oklch(0.65 0.20 25);  --grade-f-on: oklch(0.18 0 0);
  --grade-nr: oklch(0.50 0.012 250); --grade-nr-on: var(--ink);
  --grade-a-wash: oklch(0.30 0.05 165); /* …per hue */
  --status-normal:   oklch(0.72 0.13 150);
  --status-protected:var(--brand);
  --status-unhealthy:oklch(0.78 0.16 60);
  --status-critical: oklch(0.65 0.20 25);
}
```
All values are strong starting points; contrast-verify per theme during Phase 0/1.

## Appendix B — copy deck (voice samples, no buzzwords, no em dashes)

- Hero lead: "18 tranches across 9 markets, rated risk-first. The gap between Safety and Opportunity is the signal."
- Scatter region label: "Richly paid for risk"
- Verdict (Senior): "Protected seat, fairly paid."
- Verdict (Junior, money shot): "First-loss seat, richly paid."
- Waterfall annotation: "Senior is exposed only after the Junior buffer is gone."
- Penalty bar heading: "Why this grade"
- NR flag: "Not rated: no Pharos score for the base asset."
- Low-confidence flag: "Low confidence: some inputs are missing."
- Freshness caption: "Data fresh, updated 1m ago." (detail on hover)
- Theme toggle label: "Switch to dark theme" / "Switch to light theme"
