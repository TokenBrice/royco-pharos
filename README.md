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

The prototype uses Node's built-in SQLite driver and defaults to `data/roycopharos.db`. Fixture mode is available by default. Standalone CLI scripts such as `npm run sync` read exported or inline shell env vars; `.env.local` is for Next.js local app/runtime behavior, not automatic CLI loading.

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

## Runtime Boundaries

Local development remains SQLite-first. Production deployment is implemented through Cloudflare Workers, Cloudflare D1, a scheduled sync Worker, and the `royco.pharos.watch` custom domain. Request handlers still never fetch Royco or Pharos live; upstream reads belong to the local sync CLI or the Cloudflare sync Worker.

Access-gated admin routes, public integration API keys, wallet positions, alerts, and allocator look-through remain outside the current implementation boundary. See [`docs/deployment.md`](./docs/deployment.md) for the production runbook.
