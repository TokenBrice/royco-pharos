# RoycoPharos

Local-first prototype for the Royco Dawn tranche scoring plan.

RoycoPharos keeps all 18 direct Dawn tranches visible, uses Pharos as the vault/base-asset risk source, and computes two tranche-level views:

- `Royco Safety Score`: capital-risk score derived from the Pharos vault score, curated exposure risk, Senior buffer credit, and tranche-specific penalties. Higher is safer.
- `Royco Opportunity Score`: risk-adjusted yield derived from APY and Safety. Higher means the yield pays better for the measured risk.

Missing underlying Pharos scores are `NR`.

## Local Commands

```bash
npm install
npm run sync
npm run status
npm run dev
```

The prototype uses Node's built-in SQLite driver and defaults to `data/roycopharos.db`. Fixture mode is available by default. Add `PHAROS_API_KEY` to `.env.local` only when testing live Pharos API reads.

`npm run sync` publishes a candidate snapshot into SQLite, validates that at least 18 direct tranches are present, and leaves the prior published snapshot in place if the candidate is undersized. The Next.js UI and API routes read from the published SQLite rows, not from in-memory fixtures.

Live mode is opt-in:

```bash
ROYCO_DAWN_LIVE=1 PHAROS_API_KEY=ph_live_... npm run sync
```

You can also point Royco ingestion at a local Dawn response or normalized fixture with `ROYCO_DAWN_FIXTURE_PATH`.

## Routes

- `/` overview of all 18 tranches
- `/markets/[marketKey]` Senior/Junior market comparison
- `/methodology` scoring explanation
- `/api/health`
- `/api/tranches`
- `/api/markets`
- `/api/markets/[marketKey]`
- `/api/history/tranche/[trancheId]?days=30`
- `/api/methodology`

## Documentation

The base docs live in [`docs/`](./docs/README.md):

- [`docs/architecture.md`](./docs/architecture.md) explains the sync, SQLite publish, and read paths.
- [`docs/operations.md`](./docs/operations.md) covers local commands, env vars, sync behavior, and troubleshooting.
- [`docs/scoring.md`](./docs/scoring.md) documents the current scoring model and change-control expectations.
- [`docs/api.md`](./docs/api.md) lists the JSON routes and response conventions.

## Prototype Boundaries

This repo is local-first. Cloudflare Pages, Worker cron, D1 deployment, Access-gated admin endpoints, public integration API keys, and allocator look-through are deferred.
