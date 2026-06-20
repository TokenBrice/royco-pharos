---
target: our homepage design
total_score: 32
p0_count: 0
p1_count: 3
timestamp: 2026-06-14T11-28-23Z
slug: src-app-page-tsx
---
# Critique — RoycoPharos homepage (`src/app/page.tsx`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Freshness caption + per-row status dots + "Showing 18 of 18" |
| 2 | Match System / Real World | 3 | Two A–F letter scales (Safety + Opportunity) invite confusion |
| 3 | User Control and Freedom | 3 | Filters have no "Clear all" and no URL state to restore/share |
| 4 | Consistency and Standards | 4 | Grade badge, divergence pair, mono numerics reused verbatim |
| 5 | Error Prevention | 3 | Little to err on; empty-filter state teaches |
| 6 | Recognition Rather Than Recall | 3 | Scatter legend lives only in the caption |
| 7 | Flexibility and Efficiency | 3 | No keyboard sort, no saved views, no column-click sort |
| 8 | Aesthetic and Minimalist Design | 4 | Disciplined; verdict leads, evidence follows |
| 9 | Error Recovery | 2 | No degraded/stale-data error state on the homepage path |
| 10 | Help and Documentation | 3 | `/methodology` + inline captions; no inline term tooltips |
| **Total** | | **32/40** | **Good (top of the realistic band)** |

## Anti-Patterns Verdict

**LLM assessment:** Not AI slop. A Linear/Stripe-fluent user trusts this. The tells are conspicuously absent: no hero-metric template, no `01/02/03` numbering, no gradient text, no identical card grid, no decorative glass. It commits to a real idea — Safety-vs-Opportunity divergence — and builds three coordinated views of it. The divergence connector is a genuine custom artifact, not a library default.

**Deterministic scan:** `detect.mjs` returned **0 findings** across `page.tsx` and every homepage component (overview-table, opportunity-scatter, distribution-strip, grade, badges, indicators). Supplementary CSS checks: body `--bg` is `oklch(0.975 0.005 255)` — cool slate, not the banned warm-cream band; no `background-clip:text`; no side-stripe `border-left/right > 1px`; the single `backdrop-filter: blur(16px)` is the project's sanctioned sticky-header blur. The detector agrees with the LLM: this is not slop.

**Visual overlays:** Not injected — the deterministic markup scan returned zero findings, so there was nothing to overlay. Visual evidence was taken directly via screenshots at 1440/768/375 and in dark theme instead.

## Overall Impression
This is a confident, sober risk-desk surface that earns trust by sobriety, exactly as PRODUCT.md intends. The craft is real and the anti-slop discipline is intact. The biggest opportunity is not visual — it is cognitive and product framing: the page leads with "where is yield mispriced" (divergence) when a depositor arrives asking "where is it safe to put capital," and the table below the hero is an emotional valley of 18 near-equal rows with no directional cue.

## What's Working
- **The divergence connector is the product.** It encodes the whole thesis in one glyph and travels identically across hero and every table row. Color + vertical slope + ▲delta are three redundant channels, so it survives grayscale and colorblindness as the rules demand.
- **Uncertainty is first-class.** NR dashed badges, the low-confidence diagonal hatch, "thin liquidity," and the aging-data caption make doubt visible — the risk-desk voice, kept honest.
- **Dark mode is engineered, not inverted.** The grade ramp lightens via a separate token set so badges keep saturation without glowing; the canvas stays slate, never black.

## Priority Issues

- **[P1] Two A–F scales overload working memory.** Safety and Opportunity both render as letters, so the user must hold "which letter means what" while scanning. **Why:** at the high-stakes capital-placement moment, ambiguity erodes the trust the rest of the page builds. **Fix:** add a persistent micro-key near the scatter ("Safety ▸ how protected · Opportunity ▸ yield vs risk") and/or differentiate the Opportunity badge shape; don't leave the meaning in a caption. *Command: `/impeccable clarify`*
- **[P1] Six-control filter bar exceeds the cognitive budget.** Chain, Status, Exposure, Safety grade, Sort, Watchlist sit exposed at once (>4). **Why:** the one decision point on the page over the ≤4 guideline; it reads as an ops console, which the product explicitly disavows. **Fix:** collapse Chain/Status/Exposure behind one "Filters" disclosure; keep Sort + Watchlist visible by default. *Command: `/impeccable distill`*
- **[P1] The table is the emotional valley with no directional guidance.** 18 near-equal dense rows land right after an airy hero, with only sort order to orient a depositor. **Why:** the depositor's actual question ("where do I start?") goes unanswered between the signal card and the full ledger. **Fix:** lead the table with a curated cue (e.g. "safest seat with most cushion" callout or a top-5 with "see all 18"), tied back to the signal card. *Command: `/impeccable layout`*
- **[P2] Scatter and distribution strip are opaque to screen readers.** Both are a single `role="img"` with one summary label; the 18 individual dots are SVG `<title>` only. **Why:** Sam (screen-reader) gets a one-sentence summary instead of the data. **Fix:** expose per-dot data via an accessible table fallback or `aria` description list; verify grade C/D ink-on-light clears 4.5:1. *Command: `/impeccable audit`*
- **[P2] Filter state is neither shareable nor restorable.** A risk analyst who filters to "F-grade, watchlist" can't bookmark or send it. **Fix:** sync filters to URL query params and add a "Clear" reset. *Command: `/impeccable harden`*
- **[P3] Mobile tap targets below 44px.** The "Watchlist only" checkbox (~16px) and 36px selects are borderline on touch. **Fix:** bump control min-height to 44px on touch. *Command: `/impeccable adapt`*

## Persona Red Flags

**Alex (power user):** No URL-encoded filters, no keyboard or column-click sort (only the Sort dropdown). On tablet the table scrolls horizontally and hides Coverage headroom / Market TVL off the right edge with no sticky first column.

**Sam (accessibility):** The scatter is one `role="img"` summary; individual dots are invisible to a screen reader scanning data. The distribution strip is likewise a single `aria-label`. Grade C/D use dark ink on a light lime/amber fill — confirm ≥4.5:1.

**Riley (stress-tester):** No visible degraded/stale-data error state on the homepage — only a binary "no snapshot" empty state. A partial or one-source-stale snapshot has no dedicated presentation beyond the flattened "fresh/aging" word.

**Depositor (project-specific):** Arrives asking "where is it safe to put capital?" The hero answers "where is yield mispriced." The safest-seat view exists only as a fallback when no divergence is found, so a cautious depositor must infer it from sort order.

## Minor Observations
- The signal card's three-part flex row leaves a dead gap between the divergence pair and the APY at ~768px.
- "GRADE BOOK" is an uppercase label — defensible as one section label, but it edges toward the per-section-eyebrow pattern the project banned; keep it from proliferating.
- The freshness word is binary ("fresh"/"aging") even when one source is fine and one is stale; it flattens nuance the per-source ages then re-expose.

## Questions to Consider
- If divergence *is* the product, why does the safest-tranche view exist only as a fallback — shouldn't a risk desk lead with "safest seat" and offer "best-paid risk" second?
- Are two A–F scales doing different jobs earning their place, or would a single Safety grade + a "yield premium" magnitude be lower-load and more honest?
- The table is the real workspace yet it's the emotional valley — should the homepage show a curated top-5 with "see all 18," not the full ledger dumped below the fold?
