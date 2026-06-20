---
name: RoycoPharos
description: Risk-first Royco Dawn tranche scoring, rendered as a calibrated research dossier.
colors:
  brand: "oklch(0.52 0.15 258)"
  brand-ink: "oklch(0.46 0.16 258)"
  bg: "oklch(0.975 0.005 255)"
  surface-1: "oklch(0.995 0.0015 255)"
  surface-2: "oklch(0.955 0.007 255)"
  surface-3: "oklch(0.93 0.009 255)"
  ink: "oklch(0.24 0.02 258)"
  ink-soft: "oklch(0.34 0.02 258)"
  muted: "oklch(0.475 0.02 258)"
  hairline: "oklch(0.9 0.008 255)"
  hairline-strong: "oklch(0.83 0.012 255)"
  grade-a: "oklch(0.6 0.13 165)"
  grade-b: "oklch(0.62 0.14 145)"
  grade-c: "oklch(0.8 0.15 110)"
  grade-d: "oklch(0.77 0.15 75)"
  grade-e: "oklch(0.64 0.18 45)"
  grade-f: "oklch(0.56 0.2 25)"
  grade-nr: "oklch(0.72 0.012 255)"
  good: "oklch(0.55 0.13 150)"
  warn: "oklch(0.7 0.15 72)"
  bad: "oklch(0.55 0.2 25)"
  info: "oklch(0.52 0.15 258)"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(2.125rem, 5vw, 3.25rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0"
    fontFeature: "tabular-nums"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "72px"
components:
  grade-badge:
    backgroundColor: "{colors.grade-c}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    size: "28px"
  badge-pill:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  segmented-active:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface-1}"
    padding: "7px 14px"
  theme-toggle:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    size: "36px"
  panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px"
  input-select:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
---

# Design System: RoycoPharos

## 1. Overview: The Risk Desk Dossier

**Creative North Star: "The Risk Desk Dossier"**

RoycoPharos reads like an analyst's research desk, not a yield-farming dashboard. The surface is a cool slate-blue canvas (hue 258) that stays deliberately quiet so the only saturated color on screen carries meaning. Serif display type lends the credibility of a printed risk memo; monospaced numerics make every figure feel measured and audited. The system exists to make one idea legible at a glance: the divergence between a tranche's **Safety** grade (capital downside) and its **Opportunity** grade (risk-adjusted yield). Color is the messenger, never the decoration.

Density is earned, not performed. Data rows pack tight with tabular figures and inline microviz; page sections breathe with generous margins between them. Two themes ship from one semantic-token layer: a light editorial default and a dark risk-terminal toggle, authored once and re-skinned by CSS variables. The instruments inside the dossier (grade chips, divergence pairs, the distribution strip, the loss waterfall) are calibrated and precise; the prose around them is sober and direct.

This system explicitly rejects the 2026 AI-default warm cream background, crypto-hype neon and glow, all-black grade badges where an A and an F look identical, the hero-metric template (big number, small label, supporting stats), identical icon-and-text card grids, per-section uppercase eyebrows, side-stripe accent borders, gradient text, and decorative glassmorphism. Sobriety is how the product earns trust.

**Key Characteristics:**
- Cool slate-blue neutral canvas (hue 255–258), never warm-by-reflex.
- Saturated color rationed to exactly two jobs: grades and status.
- An engineered A→F grade ramp (teal-green to red-orange) as the organizing visual system.
- Three type families on a real contrast axis: serif display, sans UI, mono numerics.
- Dual light/dark theme from one semantic-token layer.
- Color is never the only channel: grade letter + fixed position + uncertainty hatch always travel with it.

## 2. Colors: The Calibrated Spectrum

A neutral cool canvas holds a single engineered grade ramp and a small status family. One hue means exactly one thing, so a lone chip reads instantly and a column of them becomes a legible heat field.

### Primary
- **Lighthouse Slate-Blue** (`oklch(0.52 0.15 258)`): the brand hue. Used for links, focus rings, text selection, the chart line, the active segmented control, and the `protected` status. The "beam" that orients the reader, used sparingly so it never competes with a grade.
- **Slate-Blue Ink** (`oklch(0.46 0.16 258)`): the darker brand shade for link text and key figures on light surfaces, where the raw brand would not clear 4.5:1.

### Secondary (the grade ramp)
One diverging scale, A (safe) to F (worst), anchored teal-green to red-orange so adjacent grades stay distinct under deuteranopia and protanopia. Light-theme fills shown; dark-theme fills are lifted in lightness so chips glow on the dark canvas.
- **Grade A, Deep Teal-Green** (`oklch(0.6 0.13 165)`): safest. White letter.
- **Grade B, Green** (`oklch(0.62 0.14 145)`): white letter.
- **Grade C, Chartreuse** (`oklch(0.8 0.15 110)`): ink letter (light fill).
- **Grade D, Amber** (`oklch(0.77 0.15 75)`): ink letter (light fill).
- **Grade E, Orange** (`oklch(0.64 0.18 45)`): ink letter (light fill), so the letter clears AA at body size; the dark theme keeps a dark letter on a lifted fill.
- **Grade F, Red-Orange** (`oklch(0.56 0.2 25)`): worst. White letter; the dark theme uses a deeper red (`L 0.56`) so the white letter clears AA.
- **Grade NR, Quiet Neutral** (`oklch(0.72 0.012 255)`): not rated. Dashed border, italic, never a colored fill (absence of a score is not a grade).

### Tertiary (status & severity)
- **Healthy Green** (`oklch(0.55 0.13 150)`): `normal` status; a quiet dot, never a full green wash.
- **Caution Amber** (`oklch(0.7 0.15 72)`): `unhealthy` status and `watch` severity.
- **Critical Red** (`oklch(0.55 0.2 25)`): `critical` status and `critical` severity; reuses the F hue.
- **Info Blue** (`oklch(0.52 0.15 258)`): neutral informational accents; shares the brand hue.

### Neutral
- **Cool Canvas** (`oklch(0.975 0.005 255)`): the page background. Cool, not cream.
- **Surface 1 / 2 / 3** (`oklch(0.995 0.0015 255)` / `oklch(0.955 0.007 255)` / `oklch(0.93 0.009 255)`): panels, raised modules, and (in dark theme) the depth ladder that replaces shadow.
- **Ink** (`oklch(0.24 0.02 258)`, ~13:1 on canvas): primary text.
- **Ink-Soft** (`oklch(0.34 0.02 258)`): prose body and secondary figures.
- **Muted** (`oklch(0.475 0.02 258)`, ~6:1 on canvas): labels, captions, axis text. Held above 4.5:1, never lighter.
- **Hairline / Hairline-Strong** (`oklch(0.9 0.008 255)` / `oklch(0.83 0.012 255)`): 1px borders and dividers; the only separation device (no shadows in light borders, no stripes).

### Named Rules
**The One Hue, One Meaning Rule.** A hue is assigned exactly one job. Teal-green is grade A; the brand blue is "protected"; amber is caution. Never reuse a grade hue for decoration, and never tint the canvas toward a grade color.

**The Cool Canvas Rule.** The background sits at hue 255 chroma 0.005, cool and near-neutral. The warm cream/sand/paper band (hue 40–100) is forbidden; if the cool cast ever reads tinted, fall back to true `oklch(0.99 0 0)`, never toward warmth.

**The Redundant Channel Rule.** Color never carries meaning alone. Every grade ships its letter, its fixed A–F slot, and (when low-confidence or stale) a diagonal hatch. The design must survive grayscale.

## 3. Typography: Serif Verdict, Mono Evidence

**Display Font:** Source Serif 4 (with Georgia, serif)
**Body Font:** Inter (with system-ui, sans-serif)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, monospace)

**Character:** A real three-axis contrast set. The serif is the editorial "research memo" voice, reserved for the verdict; Inter handles all UI and prose with quiet neutrality; IBM Plex Mono makes every number, grade letter, and axis tick read as an instrument reading. The pairing is deliberate contrast, not three competing sans-serifs.

### Hierarchy
- **Display** (Source Serif 4, 600, `clamp(2.125rem, 5vw, 3.25rem)`, line-height 1.02, letter-spacing -0.02em): the page-heading and hero lead sentence only. The thesis, stated once.
- **Headline** (Source Serif 4, 600, 1.625rem / 26px, line-height 1.15): major prose section titles (methodology, dossier sections).
- **Title** (Inter, 600, 1.25rem / 20px, letter-spacing -0.01em): panel and section titles inside the app shell.
- **Body** (Inter, 400, 1rem / 16px, line-height 1.5): all prose and table text. Prose measure capped at 68ch.
- **Label** (Inter, 700, 0.6875rem / 11px, letter-spacing 0.04em, UPPERCASE): metric labels and small captions only. Reserved for ≤4-word labels, never sentences.
- **Numeric/Mono** (IBM Plex Mono, 600, tabular-nums): every figure, grade letter, APY, score, and chart axis.

### Named Rules
**The Tabular Numerics Rule.** Every number renders in IBM Plex Mono with `font-variant-numeric: tabular-nums`, so columns align to the pixel and chips feel instrument-grade. A proportional figure in a data cell is a defect.

**The Serif-for-Verdict Rule.** Source Serif 4 appears only at display and headline sizes (the thesis, section titles). It never drops into body, labels, or controls; its rarity is what signals "this is the conclusion."

## 4. Elevation: Theme-Split Depth

Depth is conveyed differently per theme, by design. The **light** theme uses two soft, low-contrast ambient shadow tokens to lift panels and interactive callouts off the cool canvas. The **dark** theme sets shadows to `none` and conveys depth purely through the `surface-1 / 2 / 3` lightness ladder (tonal layering), the dark-mode best practice. Borders are always a 1px hairline in both themes; elevation is additive, never a substitute for the border.

### Shadow Vocabulary (light theme)
- **Resting lift** (`box-shadow: 0 1px 2px oklch(0.24 0.02 258 / 7%), 0 10px 28px oklch(0.24 0.02 258 / 6%)`): default panels, signal callouts, the data-table wrap.
- **Raised module** (`box-shadow: 0 2px 6px oklch(0.24 0.02 258 / 9%), 0 24px 56px oklch(0.24 0.02 258 / 9%)`): hero/feature modules and overlays that need to read as floating.

### Named Rules
**The Theme-Split Depth Rule.** Shadows belong to light only. In dark, raise a surface by stepping it up the `surface-1 → surface-2 → surface-3` ladder, never by adding a drop shadow. Both themes share the same 1px hairline border.

**The No-Stripe Rule.** State is shown by a full hairline plus a wash tint plus a glyph, never by a thick colored `border-left`. Side-stripe accent borders are forbidden everywhere.

## 5. Components

The component feel is **instrument-grade and precise**: tight radii, hairline borders, tabular-mono figures, and restrained 150–220ms state transitions. Nothing is decorative; every element is calibrated to read a value.

### Buttons
- **Shape:** small radius (`6px`) for the icon button; the segmented control is a single `6px` rounded group with hairline dividers.
- **Theme toggle:** 36px square, `surface-1` background, hairline-strong border, muted icon. Hover shifts the icon to `ink` and the border to `brand`.
- **Segmented control:** muted inactive segments on `surface-1`; the active segment fills with `brand` and switches its text to `surface-1`. Used for Senior/Junior and side toggles.
- **Hover / Focus:** 150ms `ease-out` on color and border-color. Focus is a 2px `brand` outline at 2px offset (global `:focus-visible`).

### Chips (the signature atom)
- **Grade badge:** a filled rounded square (`6px`), sized `sm 23px / md 28px / lg 46px / xl 60px`, with the grade letter in mono 600. Fill and on-color are driven by `data-grade` (A–F); NR renders transparent with a dashed hairline-strong border and italic text.
- **Grade chip:** the badge plus its numeric score in mono adjacent. The product's core unit.
- **State:** `data-confidence="low_confidence"` or `"stale"` overlays a 45° diagonal hatch on the badge, encoding uncertainty without inventing a color.
- **Badge pill:** a separate pill (`999px`) for data/status labels, with `.good / .watch / .bad / .neutral` tints drawn from the status family (washed background + same-hue ink + same-hue border).

### Cards / Containers
- **Corner Style:** panels `10px`, hero/feature modules `14px`, chips/inputs `6px`.
- **Background:** `surface-1` on the `bg` canvas; nested data grids use a 1px-gap `hairline` background so cells read as a seamed sheet, not stacked cards.
- **Shadow Strategy:** resting-lift in light, tonal ladder in dark (see Elevation).
- **Border:** always 1px `hairline`. **Nested cards are forbidden;** group with seams and washes instead.
- **Internal Padding:** `20px` for panels, `12–16px` for data cells.

### Inputs / Fields
- **Style:** `select` controls use `surface-1`, a `hairline-strong` 1px border, `6px` radius, `7px 10px` padding, inheriting the body font.
- **Focus:** the global 2px `brand` `:focus-visible` ring.
- **Disabled / low-data:** rows surface NR/low-confidence via hatch and flag, never a silent fallback to 0 or F.

### Navigation
- **Style:** a sticky 64px header, hairline bottom border, with a translucent `surface-1` background and a purposeful 16px `backdrop-filter` blur (the one sanctioned blur). Nav links are muted 600-weight sans; hover and `aria-current` shift them to `ink`. On ≤680px the header goes static and the nav wraps full-width.

### Divergence Pair (signature)
Two grade badges (Safety left, Opportunity right) joined by a short SVG connector whose slope encodes the gap. Rising to the right means Opportunity outranks Safety (yield richly pays for first-loss risk): the connector thickens to 2.5px, turns `brand`, and gains a `▲n` delta label when the gap is ≥2 grades. Flat means aligned; falling means underpaid. This is the thesis as one object.

### Distribution Strip (signature)
A single horizontal bar segmented A–F by tranche count, each segment in its grade fill with the count in mono, segment width proportional to count. Carries `role="img"` with a labelled summary. The whole book's risk shape in one line.

## 6. Do's and Don'ts

### Do:
- **Do** keep the canvas cool and near-neutral (hue 255, chroma ≤0.005); fall back to true `oklch(0.99 0 0)` if it ever reads tinted.
- **Do** render every number in IBM Plex Mono with `tabular-nums`.
- **Do** ship the grade letter, its fixed A–F position, and an uncertainty hatch alongside every grade color, so meaning survives grayscale and colorblindness.
- **Do** reserve Source Serif 4 for the hero lead and section titles only.
- **Do** separate and group with 1px hairlines, washes, and seams; raise with soft shadow in light and the surface ladder in dark.
- **Do** verify body text ≥4.5:1 and large/UI text ≥3:1 in both themes; keep `muted` above 4.5:1.
- **Do** show NR, low-confidence, and stale states plainly; render a single history point as "collecting history."

### Don't:
- **Don't** use a warm cream / sand / paper background, or token names like `--paper` / `--cream`; the 2026 AI-default warm-neutral band (hue 40–100) is forbidden.
- **Don't** render grades as all-black (or single-color) badges where an A and an F look identical; color must carry the grade.
- **Don't** build the hero-metric template (big number, small label, supporting stats); freshness and telemetry are sized like telemetry, never promoted to the hero.
- **Don't** repeat identical icon + heading + text card grids, and never nest a card inside a card.
- **Don't** add per-section uppercase tracked eyebrows or `01 / 02 / 03` numbered scaffolding.
- **Don't** use a `border-left`/`border-right` colored stripe greater than 1px; show state with full hairline + wash + glyph.
- **Don't** use gradient text (`background-clip: text`) or decorative glassmorphism; the one sanctioned blur is the sticky header.
- **Don't** fabricate trends, launder missing data into a confident number, or paint a healthy book entirely green.
