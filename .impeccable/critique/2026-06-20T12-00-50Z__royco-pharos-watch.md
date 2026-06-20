---
target: "https://royco.pharos.watch/"
total_score: 26
p0_count: 0
p1_count: 4
timestamp: 2026-06-20T12-00-50Z
slug: royco-pharos-watch
---
**Design Health Score**

| # | Heuristic | Score | Key Issue |
|---|---:|---:|---|
| 1 | Visibility of System Status | 3 | Freshness exists, but there is no single snapshot-confidence verdict. |
| 2 | Match System / Real World | 3 | Risk-desk tone is strong; “Best-paid risk” reads a little promotional. |
| 3 | User Control and Freedom | 2 | The ranked book is fixed with no filters/search/seat controls. |
| 4 | Consistency and Standards | 3 | Design system is coherent; mobile table behavior feels like desktop compression. |
| 5 | Error Prevention | 2 | NR, stale, low-confidence, and mapping issues do not roll up into a clear caution summary. |
| 6 | Recognition Rather Than Recall | 3 | Labels help, but scatter rings, score pairs, and seat language require learning. |
| 7 | Flexibility and Efficiency | 2 | Analysts cannot quickly slice by seat, grade, flag, APY, or asset. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, credible visual language; hero and ledger compete for attention. |
| 9 | Error Recovery | 2 | Degraded states need stronger in-context paths to Health/methodology evidence. |
| 10 | Help and Documentation | 3 | Methodology exists, but explanations are not connected to confusing score moments. |
| **Total** | | **26/40** | **Solid prototype, not yet a polished risk product.** |

**Anti-Patterns Verdict**

LLM assessment: The site does not look generically AI-made. It has a coherent risk-desk identity: cool neutral canvas, serif verdict type, monospaced data, semantic grades, tight radii, and restrained motion. The trust leak is operational legibility, not taste. On desktop it feels credible; on mobile and in the ledger it starts to feel like an analyst artifact squeezed into a public product.

Deterministic scan: URL target skipped direct CLI scan. Secondary local scan of `src/app src/components` reported 12 findings: one `layout-transition` warning on `transition: width`, and eleven `design-system-radius` advisories at small radii outside the documented 6/10/14px scale. Most radius findings are low-risk chart/micro-mark cases, but they point to a detail-pass opportunity.

Visual overlays: Mutable script injection preflight succeeded, but browser overlay injection failed because the live site blocked loopback `detect.js` by CORS/private-network policy. No reliable user-visible overlay is available.

**Overall Impression**

RoycoPharos already looks sober and credible. The biggest opportunity is to turn the homepage from “all useful signals at once” into a cleaner decision path: snapshot confidence, top risk verdicts, controlled evidence exploration, then the dense ledger.

**What's Working**

- The visual register is right for a risk product: cool neutrals, serious serif headlines, mono figures, and semantic color instead of crypto gloss.
- The first viewport contains meaningful evidence: grade distribution, two lead tranches, freshness, and Safety/Opportunity context.
- The design system has strong atoms already: grade badges, score pairs, distribution strips, status pills, and table primitives are reusable enough for focused improvements.

**Priority Issues**

**[P1] No single snapshot-confidence verdict**

Why it matters: Users see grades and freshness, but not an explicit read on whether the current snapshot is complete, fresh, degraded, or cautionary. A risk desk should establish confidence before it asks users to parse charts.

Fix: Add a compact “Snapshot read” band near the hero: Fresh/aging, rated coverage, NR count, low-confidence count, mapping conflicts/unmapped count, and a Health link. Keep it calm, not alarmist.

Suggested command: `$impeccable layout`

**[P1] Mobile ranked ledger is not decision-ready**

Why it matters: The mobile table becomes a long compressed ledger with important columns offscreen. That weakens the product promise: risk should be legible at a glance.

Fix: Keep the desktop ledger, but introduce mobile tranche cards or market accordions with inline Safety, Opportunity, APY, headroom, utilization, flags, and a “View evidence” link.

Suggested command: `$impeccable adapt`

**[P1] Ranked book needs controlled exploration**

Why it matters: “Fixed ranking, not sortable” is honest but too rigid. Depositors need “Senior only” and analysts need “flagged / NR / high APY-low Safety / asset search.”

Fix: Add restrained controls above the ledger: seat segmented control, search by market/asset, status/flag chips, and reset. Preserve the default risk-first order.

Suggested command: `$impeccable polish`

**[P2] Scatter is impressive but overplotted and too interactive on mobile**

Why it matters: The scatter adds sophistication, but dense overlapping markers and long accessible names make it harder to use than it looks.

Fix: Clarify one takeaway before the chart, highlight the two hero signal tranches, dim non-highlighted points, add Senior/Junior toggles, and give every chart point a concise aria-label. On mobile, add a short “top divergences” list below the chart.

Suggested command: `$impeccable clarify`

**[P1] Production/detail polish has trust leaks**

Why it matters: The live page ships `http://localhost:8400/live.js`, causing a console error on the public site. Fast mobile screenshots also showed blank hero-card logo circles until lazy images loaded. Small defects hurt a risk product more than a marketing page.

Fix: Remove the live script from `src/app/layout.tsx`, make above-fold signal-card logos eager or provide stable initials until loaded, sweep copy for compressed phrases, and normalize minor token/radius/motion outliers.

Suggested command: `$impeccable harden`

**Persona Red Flags**

Depositor first-timer: The hero cards are understandable, then the ledger introduces junior-buffered, first-loss, headroom, utilization, score pairs, and thin liquidity all at once. Needs a clearer “start here” path.

Power risk analyst: The evidence is strong, but there is no filtering, sorting, export, or fast comparison workflow. Repeated use will feel slow.

Mobile skimmer: The first viewport works, then chart and table density make the page feel smaller and less decisive. Needs a mobile-native evidence surface.

**Minor Observations**

- The Health page’s clear “current/degraded” framing should inform the homepage verdict.
- Grade B uses blue, which can compete with brand blue. It is usable, but worth watching in selected/info contexts.
- The table’s warning washes accumulate visually and can make the lower ledger feel more amber than calm.
- Header/nav is tidy, but mobile vertical space is expensive before the verdict.

**Questions to Consider**

- Should the homepage default to a depositor path first, with analyst controls progressively available?
- Is the scatter a primary decision tool, or should it become supporting evidence after a simpler ranked short list?
- What one sentence should the product say about the snapshot without sounding like financial advice?
