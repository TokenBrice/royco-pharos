---
target: vault page (market detail)
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-06-14T11-23-12Z
slug: src-app-markets-marketkey-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Status dot shows market health, but the page never states data freshness ("as of ...") — the product's core promise |
| 2 | Match System / Real World | 3 | Domain language is correct; heavy for a first-time yield seeker (haircut, coverage ratio, first-loss) |
| 3 | User Control and Freedom | 3 | Read-only page; "Back to overview" + theme toggle. Little to escape from |
| 4 | Consistency and Standards | 3 | Strong token system; but penalty story is told two different ways (PenaltyBar vs risk-rail score-stack) |
| 5 | Error Prevention | 3 | NR/low-confidence guards are solid; the 456.9% vs 0.11x juxtaposition invites misreading |
| 6 | Recognition Rather Than Recall | 3 | Labels/legends everywhere; redundancy forces "didn't I just see this grade?" |
| 7 | Flexibility and Efficiency | 2 | No in-page nav/TOC on a 19-heading page, no shortcuts, no cross-market compare from here |
| 8 | Aesthetic and Minimalist Design | 2 | Same grades shown ~6×; penalty data duplicated; density not fully earned |
| 9 | Error Recovery | 3 | notFound() + NR copy explain gaps clearly |
| 10 | Help and Documentation | 3 | Section subtitles teach, methodology linked, charts carry aria summaries |
| **Total** | | **27/40** | **Acceptable (top of band, bordering Good) — high craft, held back by redundancy, missing freshness, two render/contrast bugs** |

## Anti-Patterns Verdict

**Does this look AI-generated? No.** This is a committed, identity-driven system, not a template.

**LLM assessment:** The page passes the product slop test. Cool slate canvas (not the AI-default cream), serif-verdict + mono-evidence pairing, rationed grade color, redundant color+letter+position channels, honest NR states. None of the absolute bans are present: no gradient text, no side-stripe borders, no decorative glass, no per-section eyebrows, no hero-metric template. The failure mode here is the opposite of generic: it is *over-thorough*. The same facts recur in 3-5 framings, which reads as an ops console rather than a risk verdict.

**Deterministic scan:** `detect.mjs --json` over the page returned `[]` — zero slop patterns. Clean.

**Visual overlays:** Not available this run. Both browser paths were blocked (Playwright profile locked by a running instance; Chrome extension disconnected), so no detector overlay was injected into a live tab. Evidence was gathered instead from the server-rendered DOM, computed WCAG contrast on the OKLCH tokens, and the provided screenshot. (Note: the screenshot is from an earlier build — it shows a "Today's Signal: Most Divergent" panel that no longer exists in the current page. Findings below are against the current rendered DOM.)

## Overall Impression

This is a genuinely well-made risk surface. The design system is real, the honesty principles are implemented (NR, hatching, ceilings), and the contrast discipline holds up under measurement. The biggest opportunity is subtraction, not addition: the dossier restates the same six numbers across many sections, so the "tell me in seconds" promise gets buried under scroll. Two concrete bugs (loss-waterfall label collision at thin buffers; a reassuring 456.9% sitting beside an alarming 0.11x) undercut the honesty the rest of the page works hard to earn.

## What's Working

1. **Measured contrast, not assumed.** `muted` clears 4.5:1 on every surface in both themes (6.21:1 on bg light, 7.43:1 on bg dark); ink-soft hits 11:1. The "hold muted above 4.5:1, never lighter" rule is actually enforced. This is the rule most AI designs fail, and it passes here.
2. **Honest uncertainty is first-class.** The loss waterfall, penalty bar, and grade badge all have real NR branches with plain-language explanations, plus the 45° hatch for low-confidence/stale. Missing data is never laundered into a confident number.
3. **The grade system survives grayscale.** Letter + fixed A-F slot + color travel together. The divergence pair encodes the Safety/Opportunity gap as slope, which is a strong, legible signature object.

## Priority Issues

**[P1] Loss-waterfall labels collide when the buffer is thin**
- **Why it matters:** For this market the Junior buffer is 0.11x and the required threshold 0.02x. The buffer band renders ~21px tall, so "Junior buffer", "0.11x · first-loss", the dashed "required 0.02x" line+label, and the "total loss" baseline all stack into ~25px and overprint each other (visible in the screenshot). The chart becomes unreadable precisely when the cushion is thinnest — the highest-stakes moment for a depositor.
- **Fix:** Below a minimum band height, move the buffer/required labels out of the bar to right-side callouts with leader lines, or enforce a minimum visual band height with an explicit "not to scale" note, or relocate the numeric labels into a side legend keyed to the bands. Keep the proportions honest; only move the text.
- **Suggested command:** `/impeccable layout`

**[P1] A reassuring percentage sits next to an alarming ratio for the same fact**
- **Why it matters:** The masthead shows "Junior buffer 0.11x" (a thin absolute cushion) while the metric strip shows "Coverage headroom 456.9%" with its micro-bar pegged full (maximally safe-looking). Same underlying fact, opposite emotional valence, on the same screen. The 456.9% is large only because the requirement (0.02x) is tiny. The honesty principle says don't let a percentage launder a thin absolute buffer.
- **Fix:** Contextualize headroom against the absolute buffer and label the requirement as low; lead with the absolute buffer, treat headroom as secondary; and stop the micro-bar from reading "full/safe" at any value over the floor (it currently caps at max=100, so 456.9% and 100% look identical).
- **Suggested command:** `/impeccable clarify`

**[P2] The dossier restates the same data many times — density isn't fully earned**
- **Why it matters:** The Safety/Opportunity pair renders ~6 times; the penalty breakdown appears in both "Why this grade" (PenaltyBar) and the sticky risk rail (score-stack + breakdown-list); coverage, utilization, and APY each recur across 4-5 sections. With 9 sections / 13 cards / 19 headings and no in-page nav, the reader scrolls a long way re-encountering facts. This is the "over-built ops console" your own anti-references warn against.
- **Fix:** Collapse "Why this grade" and the risk rail into one canonical per-tranche breakdown; cut divergence-pair restatement to the masthead + one drill-in; add per-tranche tabs or an anchor nav so an allocator can jump.
- **Suggested command:** `/impeccable distill`

**[P2] The grade letter — the most meaningful glyph — is under AA on E and F-dark badges**
- **Why it matters:** White letter on grade-E fill is 3.51:1 (light) and white on grade-F is 3.60:1 (dark). At the default 15px / small 13px bold badge sizes that need 4.5:1, both fail; they only clear the 3:1 large-text bar at lg/xl. Grade E badges are prominent here (both Opportunity grades are E).
- **Fix:** Darken the on-color for E (and F in dark), or lift the fill lightness slightly, or force the larger badge wherever the letter must carry meaning at body size. Color+letter+position redundancy softens the impact, but the letter itself should clear AA.
- **Suggested command:** `/impeccable colorize`

**[P3] No data-freshness on the detail page**
- **Why it matters:** The product's stated job is letting a reader "know the numbers in front of them are current and complete before they act." This page shows market Status (Normal) but never says how fresh the snapshot is. A stale snapshot would look identical to a live one.
- **Fix:** Surface an "as of <relative time>" in the masthead and mark a stale snapshot explicitly (the system already has a stale state — wire it in here).
- **Suggested command:** `/impeccable harden`

## Persona Red Flags

**Mara — yield-seeking depositor (project persona):** Lands wanting to know "is this safe and am I paid for it." Hits "456.9% coverage headroom" (sounds great) two inches from "0.11x junior buffer" (sounds scary) and cannot reconcile them. Both verdict cards read "thinly paid", so the actual takeaway — you are *under*paid for a first-loss seat — never lands as a single clear sentence. No freshness stamp, so she can't tell if she's acting on live data.

**Alex — allocator / power user:** Sizing positions across the book. On a 19-heading page there is no TOC, no per-tranche tab, no jump-to-risk-panel; he scrolls past the same grade pair four times. No way to compare against another market without going back to overview. The sticky risk rail helps, but it duplicates "Why this grade" rather than adding new information.

**Sam — accessibility-dependent:** Mostly well served — SVGs carry aria summaries, focus-visible ring is global, color is never the only channel. Two snags: the E/F grade letters fall under AA at default size, and the divergence "SAFETY"/"OPP" labels render at 9px, near the floor of comfortable reading.

## Minor Observations

- The divergence labels are 9px; bump toward 10-11px or lean on section context instead.
- The loss-waterfall SVG (320-wide viewBox, `xMidYMid meet`) letterboxes inside a half-width panel, floating in side whitespace; widen the plot or left-align it to its axis.
- Both masthead verdicts resolve to "thinly paid" (Opportunity = E for both), so the two cards look near-identical; differentiate the senior vs junior verdict beyond the seat noun.
- Semiotic risk: the large blue "Senior seat" box can read as "lots of safety" at a glance, when it is actually the *exposed* senior capital and the thin sliver is the only protection. The annotation mitigates but the size encoding inverts intuition.

## Questions to Consider

- Should "Why this grade" and the sticky risk rail be a single object? Right now they narrate the same base → haircut → final story twice.
- What is the one sentence a depositor should leave with for this market — and is it stated once, prominently, before the evidence?
- Does a thin-buffer market deserve a different waterfall treatment (or an explicit "buffer is thin" callout) rather than a chart that breaks at exactly that case?
