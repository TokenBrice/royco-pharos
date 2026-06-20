# Royco Opportunity Score — v0.1 Calibration Note

Date: 2026-06-14
Methodology version: `royco-opportunity-v0.1`
Data: recorded Dawn fixture (9 real markets, 18 tranches) + recorded Pharos underlyings. Re-run on live data with `ROYCO_DAWN_LIVE=1 PHAROS_API_KEY=… npm run calibrate` before any external display.

## How to reproduce

```bash
npm run calibrate
```

Prints a ranking table (every tranche: underlying score, raw/applied penalty, opportunity score + grade, top penalty drivers), per-factor raw-penalty contributions, and inversion/sanity checks.

## Findings (fixture run)

- **No internal inversions.** No market has its Junior tranche outranking its Senior tranche — the first-loss baseline + higher utilization sensitivity correctly keep Junior ≤ Senior everywhere.
- **Dominant factors match design intent.** Penalty mass concentrates in `utilization` (~164) and `junior-first-loss` (~162), then `venue-tier` (~74). The score is opportunity = underlying Pharos safety − tranche risk, so the underlying score is the primary driver and tranche penalties differentiate sides.
- **"Stressed outranks normal" is by-design, not a bug.** A `protected` apyUSD Senior (underlying 49) scores 37 while some `normal` Juniors with weak underlyings (e.g. savUSD 33) and heavy first-loss penalties score 0. This is correct: a healthier underlying with a Senior position beats a weak underlying taking first loss. Status is one factor, not an override.
- **No NR / low_confidence / conflict** in the clean fixture set (all mapped, all fields present). Those paths are covered by unit tests instead.

## Tuning observation (carry into live calibration)

`venue-tier` fires on 16/18 tranches because `venueTierForChain()` in `royco-dawn.ts` is a coarse chain-based placeholder (most chains → `unknown`/`medium`), so it behaves almost like a flat penalty rather than a discriminator — it shifts absolute scores but barely changes the *ranking*. Recommend Royco supply real venue classification before external display; until then it is near-constant and low-impact.

## Decision

**v0.1 weights validated — no change, no version bump.** The model is internally consistent and the factor contributions are defensible on the recorded real data. Weights remain pinned by the scoring unit tests. Re-run this calibration on a live pull and re-confirm before any external (Royco-facing) display, paying attention to venue-tier once real venue data exists.
