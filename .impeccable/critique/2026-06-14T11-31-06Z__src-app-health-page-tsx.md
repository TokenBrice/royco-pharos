---
target: /health page design
total_score: 34
p0_count: 0
p1_count: 1
timestamp: 2026-06-14T11-31-06Z
slug: src-app-health-page-tsx
---
# Critique — Data health page (`/health`)

Target: `src/app/health/page.tsx` (+ `page.module.css`, `globals.css`). Inspected live at localhost:3000/health, light + dark at 1440 and light at 390, via Playwright. Contrast measured from computed styles; deterministic scan via detect.mjs + manual CSS grep.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Verdict + per-feed badges + live-counting ages; exemplary. |
| 2 | Match System / Real World | 4 | "Behind / Fresh / Stale", plain risk language, no jargon. |
| 3 | User Control and Freedom | 3 | Read-only; no cadence/"as of" context for an anxious reader. |
| 4 | Consistency and Standards | 4 | Tokens, badges, mono numerals all reused from globals. |
| 5 | Error Prevention | 3 | Degraded/bad states exist in code; not exercised in happy state. |
| 6 | Recognition Rather Than Recall | 3 | "Behind" stated 3x but never says behind *what threshold*. |
| 7 | Flexibility and Efficiency | 3 | Raw JSON + methodology escapes good; no per-feed exact time. |
| 8 | Aesthetic and Minimalist | 3 | Status duplicated; 7-cell stat grid is the most template-ish block. |
| 9 | Error Recovery | 3 | `sourceWarn` slot exists but no remediation guidance shown. |
| 10 | Help and Documentation | 4 | Intro + "How grades are built" cover the model well. |
| **Total** | | **34/40** | **Good** |

## Anti-Patterns Verdict

**Not AI slop. Trustworthy and mostly bespoke.** The verdict band with its left-divided feed roll-up is a genuine signature component. Serif is correctly rationed to H1 / verdict title / section titles; mono carries every number including the `run fe4f6075` hash; saturated color is held to the two sanctioned jobs (status + seal wash). The amber "watch" tone is calm, not alarmist.

**Deterministic scan:** `detect.mjs --json src/app/health/page.tsx` → exit 0, `[]` (zero findings). Limitation: the detector scans markup only and does not scan the CSS module where this project's visual patterns live. Manual CSS grep is therefore the real check: no >1px accent side-stripes (only 1px hairline dividers at page.module.css:98 and the segmented control), no `background-clip: text` / gradient text, no decorative glass (the one `backdrop-filter` is the sanctioned sticky-header blur). Clean. No user-visible overlay was injected; evidence came from direct computed-style measurement + screenshots.

**Contrast (measured):** all body/label/badge text passes WCAG AA in both themes. Light minimums: "Behind" badge 5.25, muted body 6.2, badges/origin/labels 6.55, coverageLede 11.6. Dark: 6.98–8.04 throughout. Color never travels alone — every status carries a text label.

## Overall Impression
This is a strong, on-brand trust page that leads with the verdict and stays calm under a degraded state. It does the hard part right. What's left is mostly about making "behind" *interpretable* and cleaning up two rendering/IA rough edges — the mobile orphan cell and the duplicated status — that slightly undercut a page whose entire promise is "everything is complete."

## What's Working
1. **The watch tone is genuinely calm** (page.module.css:45-49). Amber is a thin border tint + pale seal wash; the headline leads with "Current" and the body immediately reassures "all 18 tranches are still scored." Nails "calm when healthy, honest when not."
2. **Dark mode is first-class.** Cool slate canvas holds hue 258, washes stay legible, shadows correctly drop to `none`, and badge contrast actually rises (Behind 5.25 → 8.04).
3. **Accessibility by construction.** Every measured element clears AA; status is label + color + position, never color alone.

## Priority Issues

**[P1] Mobile coverage grid leaves an empty orphan cell.** At 390px the `.metrics` grid (`repeat(auto-fit, minmax(116px,1fr))`, page.module.css:234-242) resolves to 2 columns × 7 cells → rows of 2/2/2/1, so the slot next to "Conflicts" is a bare grey block (the 1px `--hairline` gap background showing through). Confirmed visually. *Why it matters:* on a page whose one job is "everything is complete," a visible empty cell reads as missing data or a bug. *Fix:* span the trailing odd cell `grid-column: 1 / -1`, or deliberately group 3 scale + 4 exception metrics into fixed rows.

**[P2] "Behind" is never quantified against a threshold.** "Behind" appears on the verdict roll-up and on two source cards; cards show "Updated 40 min ago", but nothing says whether 40 min is normal or alarming. *Why it matters:* the depositor's literal question is "can I trust today's grades?" — an unquantified "Behind" is anxiety with no payload. *Fix:* surface the staleness threshold / expected sync cadence near the verdict or on each card ("Behind: feed older than its 15-min refresh"), so "Behind 40 min" becomes interpretable.

**[P2] Feed status is stated twice.** Royco/Pharos/Scores freshness appears in the verdict roll-up *and* again as a badge on each source card. *Why it matters:* the second statement adds reading cost without new information, and the cards' real value (what each feed is + when) gets crowded by a duplicate badge. *Fix:* keep one as the authority; let the source cards carry the differentiating evidence the roll-up can't (exact UTC timestamp + threshold).

**[P3] Exception metrics aren't separated from scale metrics.** Tranches/Markets/Mapped sit in the same flat 7-cell row as Unrated/Low-confidence/Stale/Conflicts; the `kind:"exception"` distinction only mutes the value color. *Why it matters:* the four exception counters are the ones that turn red and matter most in a bad state; flattening them makes "all clear" harder to read and a future "1 conflict" easier to miss. *Fix:* a divider/grouping between the two clusters, or collapse the all-zero exception block into one calm "0 exceptions across 18 tranches" line and reserve the grid for nonzero states.

**[P3] The verdict seal carries no semantic weight, and text-link targets are under the 24px floor.** The seal icon — the single most important visual — is `aria-hidden` (page.tsx:159); the section is announced by text only. Separately, footer and nav text-links render 21px tall, under the WCAG 2.2 (2.5.8) 24px target minimum (inline-text exception partly applies). *Fix:* give the seal an `aria-label` or `<title>`; add a little vertical padding to standalone text-links.

## Persona Red Flags
- **Depositor evaluating risk:** "Royco Behind / Scores Behind" with no threshold — can't tell if "behind" means 5 minutes or 5 hours, so can't decide whether to trust today's grades. The mobile orphan cell reads to this nervous user as broken coverage.
- **Accessibility-dependent (Sam):** Strong overall (labels + AA contrast), but the verdict seal is `aria-hidden`, so the most prominent visual conveys nothing to a screen reader. Confirm the live-counting `RelativeTime` isn't an over-chatty `aria-live` region.
- **Stress-tester (Riley):** This is the happy state. The grid orphan and duplicated status worsen as counts hit two digits or a card sprouts a `sourceWarn` row (page.tsx:209), which would make the 3 source cards uneven height. The `bad` tone + nonzero conflicts state is untested here.

## Minor Observations
- "Where the data comes from" heading + its note crowd together on mobile (the note sits tight against the wrapped two-line serif heading).
- Inline `style={{ marginTop: 18, fontSize: 12.5 }}` on the snapshot caption (page.tsx:280) breaks the otherwise-clean token discipline; move to the module.
- Four large mono "0" values in a row draw the eye toward emptiness rather than reassurance.

## Questions to Consider
1. Should "Behind" ever appear without telling me the threshold and the actual lag — or is an unquantified "Behind" just anxiety with no payload?
2. Do the three source-card status badges earn their pixels, or should those cards drop status and become pure "what + when" evidence?
3. When everything is genuinely fine, should the coverage grid of zeros render as a grid at all — or collapse into one calm "0 exceptions" line, reserving the grid for when something is actually nonzero?
