# RoycoPharos Runbook

Operating guide for the local-first prototype. (Cloudflare Pages/Worker/D1 deployment is still deferred — see `wave-2-plan.md` §8.)

## Commands

```bash
npm install          # one-time
npm run sync         # ingest Royco + Pharos, score, publish a snapshot into SQLite
npm run status       # health + freshness + last-run telemetry
npm run calibrate    # score the full pull and print a ranking + sanity checks (no DB write)
npm run dev          # Next.js UI on http://localhost:3000
npm run typecheck && npm run test   # gates
```

`npm run sync:royco` / `npm run sync:pharos` refresh only one upstream (the other is reused from the DB / cache).

## Data modes (env)

Default mode is **fixture** — recorded real Dawn markets + recorded Pharos underlyings, no network, no key. Set in `.env.local` (gitignored):

| Variable | Effect |
| --- | --- |
| `ROYCO_DAWN_LIVE=1` | Fetch the live Royco Dawn `market/explore` API instead of the recorded fixture. Falls back to the recorded fixture on any error. |
| `ROYCO_DAWN_FIXTURE_PATH=path` | Ingest a recorded Dawn response (`{data:[…]}`) or a normalized `RoycoMarketFixture[]` from disk. Takes precedence over live. |
| `PHAROS_API_KEY=ph_live_…` | Fetch live Pharos `/api/stablecoins` + `/api/report-cards`. Without it (or the placeholder), Pharos uses fixtures. |
| `PHAROS_API_BASE` | Override the Pharos host (default `https://api.pharos.watch`). |
| `ROYCOPHAROS_DB_PATH` | Override the SQLite file (default `data/roycopharos.db`). |

A full live run: `ROYCO_DAWN_LIVE=1 PHAROS_API_KEY=ph_live_… npm run sync`.

> After changing `src/lib/roycopharos/schema.ts`, delete `data/roycopharos.db` and re-sync — `CREATE TABLE IF NOT EXISTS` does not alter an existing table.

## How a sync behaves

1. Acquires a lockfile (`<db-dir>/.sync.lock`); a second concurrent sync exits with `status: "skipped"`. A lock older than 10 min is treated as abandoned and stolen.
2. Loads Royco (paginated, all listing types — Yield-Intelligence filters are intentionally **not** applied) and Pharos (with timeouts, abort, and 429 `Retry-After` backoff).
3. Builds + scores a candidate snapshot, then **validates before publishing**:
   - `< 18` tranches with a prior snapshot present → **not published**, prior kept, run marked `degraded` (`candidate_tranche_count_below_floor`).
   - every tranche `NR` with a prior present → **not published** (`candidate_all_nr`).
   - first boot (no prior) publishes whatever exists so the UI has something.
4. On publish: replaces the latest rows, appends **one** real history observation per market/tranche (bucketed to the minute, idempotent within a minute), and prunes history older than 30 days.

## Reading `npm run status`

- `ok` — ≥ 18 published tranches.
- `degraded` — last run degraded, or Royco/Pharos/score freshness is not all `fresh`.
- `lastRun.status` + `lastRun.errorCode` — why the most recent run did or didn't publish.
- `freshness` — `royco` fresh ≤ 15 min, `pharos` fresh ≤ 60 min; beyond → `degraded`/`stale`.
- `conflictCount` — deposit tokens whose address didn't match the mapping table but whose symbol did (possible spoof / new wrapper); these resolve to `NR`.

## Trust gate before any external display

Run `npm run calibrate` on a live pull and review the ranking + inversion checks, then confirm against `agents/calibration-v0.1.md`. Penalty weights live in `PENALTY_TABLES` in `scoring.ts`; any change must bump `METHODOLOGY_VERSION` and update the pinned scoring tests. The `/methodology` page renders its weight table from the same constant.

## Known live-mode caveats (pending a real pull + Royco sign-off)

- Deposit-token **decimals** come from the local mapping table (Dawn omits them); the signed Royco mapping table will replace it.
- `apy7d` and the report-card summary field names are unverified upstream and degrade to null/fallback rather than mislabel.
- `venue-tier` is a coarse chain-based placeholder until Royco supplies real venue data.
