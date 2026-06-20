---
target: RoycoPharos live site (homepage + market/methodology/health)
total_score: 35
p0_count: 0
p1_count: 2
timestamp: 2026-06-15T10-50-10Z
slug: src-app-page-tsx
---
# Critique — RoycoPharos (live site, `src/app/page.tsx` + market/methodology/health)

Critiqued the running app at `http://localhost:3002/` across Overview, a market detail (Maple syrupUSDC), Methodology, and Health, in both themes at 1440px and 390px. This is the redesigned state (methodology `v0.5`, numeric 0–100 Royco scores, safest-seat-first hero) — several issues from the prior `v0.2` homepage critique are now resolved.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Freshness ages, NR / low-confidence / stale all surfaced; dedicated /health page |
| 2 | Match System / Real World | 4 | "first-loss", "junior-buffered", "yield trails the risk" speak desk language |
| 3 | User Control and Freedom | 3 | Read-only research surface; "Back to overview" exists, but no way to reorder the book |
| 4 | Consistency and Standards | 4 | Grade/score tokens, seat rings (solid=Senior, dashed=Junior), mono numerics reused verbatim |
| 5 | Error Prevention | 3 | Strong disclaimers; little to err on; mobile horizontal-scroll defect is the blemish |
| 6 | Recognition Rather Than Recall | 4 | Verdict cards + scatter legend + methodology mean little must be memorized |
| 7 | Flexibility and Efficiency | 2 | No sort / filter / search / keyboard path; scatter is mouse-only |
| 8 | Aesthetic and Minimalist Design | 4 | Calm, dense-but-ordered, verdict-first; one control on the homepage |
| 9 | Error Recovery | 3 | NR reasons + teaching empty state; no degraded/partial-stale presentation beyond words |
| 10 | Help and Documentation | 4 | /methodology is thorough — formulas, diagrams, live constants |
| **Total** | | **35/40** | **Good / strong — trustworthy, with power-user + a11y gaps** |

Prior homepage run scored 32; the numeric-score rework and safest-seat framing earn the lift.

## Anti-Patterns Verdict

**LLM assessment:** Not AI slop, and not close. A Linear/Stripe/Notion-fluent user trusts this and doesn't pause at subtly-off components. The tells are conspicuously absent: no hero-metric template, no `01/02/03` scaffolding, no gradient text, no identical icon-card grid, no decorative glass. It commits to one real idea — Safety vs Opportunity, base-asset-up — and builds coordinated bespoke views of it (divergence connector, opportunity scatter with seat rings, penalty bar, loss waterfall, three-layer risk stack). The copy is load-bearing and specific ("trading above $1 is by design, not a depeg"), not generated filler.

**Deterministic scan:** `detect.mjs` returned **0 findings** on every page `.tsx` and the entire `components/roycopharos/` tree. `globals.css`: **1 finding** — `layout-transition` warning at `globals.css:532` (`transition: width` on `.microbar__fill`). That's a near-false-positive: it's an 8px state-conveying fill bar, not decorative layout animation. Ban checks all clean: 0 gradient-text, 0 side-stripe borders >1px (every `border-left/right` is exactly 1px hairline), and the single `backdrop-filter: blur(16px)` is the project's one sanctioned sticky-header blur.

**Visual overlays:** No rendered-URL overlay — Puppeteer isn't installed, so the detector's URL mode was skipped. Browser evidence came instead from live Playwright inspection (both themes, mobile + desktop, scatter hover, ARIA reads, contrast math, mobile-overflow measurement).

## Overall Impression
This is a confident, sober risk desk that earns trust by sobriety — exactly what PRODUCT.md asks for. The craft is real, the anti-slop discipline is intact, and the design system is genuinely systematic. Two things hold it back from excellent, and neither is taste: a **WCAG AA contrast failure on the core grade/score badge** (the primary data primitive, visible on the hero), and a **mobile horizontal-scroll defect** on the main page. Both undercut the precise-and-trustworthy promise on the surfaces that matter most. The open product question is whether a read-only book of 18 tranches with zero sort/filter serves the depositor who arrives asking "where do I start?"

## What's Working
- **The badge/seat-ring system is a real design language.** Numeric Royco scores (0–100) vs Pharos letter grades is a clean, consistent split that resolves the prior two-A–F-scale confusion; the seat ring (solid Senior / dashed Junior, grade-colored) reads identically on the scatter, the ledger, and the masthead. This is system thinking, not stitching.
- **Uncertainty is first-class.** NR dashed badges, the low-confidence diagonal hatch, "thin liquidity," per-source freshness ages, and a dedicated /health page with a 0-stale coverage grid make doubt visible — the risk-desk voice kept honest.
- **The verdict-first market masthead is the emotional peak.** Two seat cards each answer "is my seat protected, and does the yield pay?" in one plain sentence, and the loss waterfall makes the loss order literal. The end (baseline disclaimer) lands honest, not scary.

## Priority Issues

- **[P1] Grade/score badge text fails WCAG AA — including the hero's green "safest" badge.** White badge text clears 4.5:1 on **none** of the six grade fills (verified): A `#10b981` 2.54:1, B 3.87, C-white 2.14, D 2.95, E 3.36, F 3.65. Grades **A (green) and D (orange) fail even the 3:1 large-text floor the project sets for itself**, so the big market-masthead and the homepage "SAFEST SEAT 97/100" badges are non-compliant. Only C is correct (dark ink, 8.30:1). **Why it matters:** the badge is the single most-repeated data element and the literal headline of every verdict; failing legibility there contradicts the product's explicit AA commitment and Sam (low-vision) can't read the most important number. **Fix (proven):** switch badge text to the dark ink already used on C — it clears 4.5:1 on all six fills (A 7.00, B 4.59, C 8.30, D 6.02, E 5.28, F 4.87). If you want white-on-red for F's "alarm" feel, darken the E/F fills (~oklch 0.5) instead. *Command: `/impeccable colorize` (or `/impeccable audit`)*

- **[P1] Mobile homepage scrolls horizontally (~981px document at 390px).** Verified live. The ledger is correctly wrapped in `.data-table-wrap { overflow-x:auto }`, so it is **not** the cause; the culprit is the opportunity-scatter's visually-hidden `<table class="sr-only">` (`opportunity-scatter.tsx:203`). A `<table>`'s intrinsic min-width (18 `nowrap` rows ≈ 900px) overrides `width:1px`, and as a `position:absolute` element it contributes to document scroll overflow even though `clip` + `overflow:hidden` hide its paint — the generic `.sr-only` pattern doesn't constrain tables. **Why it matters:** every mobile visitor lands on a page that wobbles sideways; on a trust-first risk desk a "feels-broken" main page materially erodes credibility. **Fix:** wrap the hidden fallback in a clipping container (`<div style="position:absolute;width:1px;height:1px;overflow:hidden">`) or render the fallback as non-table markup; don't rely on `.sr-only` on the table itself. *Command: `/impeccable adapt`*

- **[P2] The 18-row book has zero sort / filter / search.** The redesign swung from the prior six-control filter bar all the way to one control (the theme toggle). **Why it matters:** Alex (allocator) and the depositor can't reorder by Safety / APY / utilization / coverage; the only "ranking" surfaces are the two pre-picked signal cards (2 of 18) and the mouse-only scatter. To compare seat #7 vs seat #14 you scan linearly or open each market. **Fix:** add a lightweight sort affordance above the ledger (Safety / APY / Coverage headroom), and optionally a "needs attention" filter — without rebuilding the old ops-console bar. *Command: `/impeccable layout` (or `/impeccable craft` for the sort control)*

- **[P2] Touch targets below 44px on mobile.** Header nav links (~21px), the in-market jump nav (~20px), and the theme toggle (33×36px) are under the 44px touch minimum. **Why it matters:** Casey/mobile mis-taps on the primary nav; the jump-nav is the only way to reach Loss waterfall / History on a long market page. **Fix:** pad interactive targets to ≥44px touch height at narrow widths. *Command: `/impeccable adapt`*

- **[P3] The ledger's five numeric columns carry equal visual weight.** APY, 7d, coverage headroom, utilization, and the score pair all render at similar size with bars/sparklines, so no single "where's the risk" column wins the eye on first scan. **Why it matters:** for a risk-first desk, Safety should out-rank yield visually in the book, not tie it. **Fix:** promote the Royco score pair (or a risk cue) as the dominant column; demote APY/7d to secondary weight. *Command: `/impeccable layout`*

## Persona Red Flags

**Alex (allocator / power user):** No sort, filter, search, column-click, or keyboard ranking anywhere in the 18-row book; the scatter is the only ranking surface and it's mouse-only (dots are `tabindex=-1` / `aria-hidden`). To size positions across the book he must eyeball every row or open each market.

**Sam (screen-reader / keyboard / low-vision):** The headline grade/score badges fail 4.5:1 (A green 2.54, D orange 2.95 fail even 3:1) — the most important number is the least legible. Sub-44px nav targets. Scatter markers are keyboard-unreachable (mitigated by the sr-only table fallback, which is the right idea but is causing the mobile-overflow bug). Distribution strip `role="img"` and the scatter's tabular fallback are otherwise done correctly.

**Depositor (project-specific — arrives wanting yield, must judge risk before committing):** The redesigned hero now answers "where is it safe?" with the SAFEST SEAT card (a real improvement), but it only surfaces 2 of 18 seats; to weigh the other 16 the depositor opens each market one at a time. On mobile, the first impression is a page that scrolls sideways, and the green "safest" Safety score they're trying to read is the lowest-contrast text on the page.

## Minor Observations
- Health verdict says "3 feeds Behind/Stale" while the coverage grid shows 0 stale tranches — reconciled in body copy ("all 18 still scored") but momentarily contradictory at a glance; consider one phrase that distinguishes feed-freshness from score-completeness.
- `detect.mjs` flags `transition: width` on `.microbar__fill` (globals.css:532). Technically a layout-property animation, but it conveys fill state on an 8px bar — low impact; leave or swap to `transform: scaleX()` if you want it perfectly clean.
- "GRADE BOOK" and the signal-card kickers ("SAFEST SEAT", "BEST-PAID RISK") are uppercase tracked labels — defensible as deliberate section labels, but they edge toward the per-section-eyebrow pattern the project bans; keep them from proliferating.
- Both Maple seats read "the yield trails the risk" — correct but repetitive across the two cards.
- Loss-waterfall "Junior buffer" block is small relative to "Senior seat" (buffer-scaled, intentional) — a one-line caption confirming it's scaled to the actual buffer would prevent a "is this broken?" read.
- One benign dev-only console error (`localhost:8400/live.js` ERR_CONNECTION_REFUSED, livereload) — not app code.

## Questions to Consider
- Is the zero-controls ledger a deliberate stance ("we pre-rank risk-first; you don't re-sort") or an oversight? It currently reads as the former but frustrates both the allocator and the depositor. If it's a stance, say so on the page; if not, a single Sort control closes the gap.
- The grade fills are shared across light and dark themes for consistency — was the AA contrast cost of that consistency a conscious tradeoff? Dark ink on all grades keeps the same fills and passes; was white text on B/E/F a deliberate "alarm" choice worth its illegibility?
- Should the most-divergent ("best-paid risk") scatter star be the one keyboard-focusable exception, since it's the headline insight, even if the rest of the dots stay in the table fallback?
- The depositor compares seats by opening markets one at a time — should the homepage offer an inline compare (top-5 with "see all 18", or a pin-to-compare), rather than making the book a read-only ledger?
