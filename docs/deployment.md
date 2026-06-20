# Deployment

RoycoPharos targets Cloudflare Workers for the Next.js application and Cloudflare D1 for production persistence. GitHub Actions handles validation and deploys. The production hostname is:

```text
royco.pharos.watch
```

## Architecture

```text
GitHub Actions
  -> npm ci / typecheck / test / build
  -> OpenNext Cloudflare build
  -> D1 migrations
  -> web Worker deploy
  -> sync Worker deploy
  -> optional manual sync trigger
  -> /api/health smoke gate
  -> royco.pharos.watch
       reads Cloudflare D1 binding DB
Cloudflare Cron
  -> sync Worker
  -> Royco Dawn + Pharos reads
  -> D1 published snapshot
```

Local development still uses `node:sqlite` at `data/roycopharos.db`. Production reads use Cloudflare D1 when `ROYCOPHAROS_STORAGE=d1`.

The web Worker is read-only with respect to upstream services: it reads D1 through the `DB` binding and does not carry Royco Dawn or Pharos upstream variables. The sync Worker owns `ROYCO_DAWN_LIVE`, `PHAROS_API_BASE`, `PHAROS_API_KEY`, cron execution, manual sync, and D1 publishing.

## Required Cloudflare Resources

Create two D1 databases:

```bash
npx wrangler d1 create roycopharos
npx wrangler d1 create roycopharos-staging
```

Copy the returned database IDs into both `wrangler.jsonc` and `wrangler.sync.jsonc`:

- production: `d1_databases[0].database_id`
- staging: `env.staging.d1_databases[0].database_id`

Set the Pharos API key and manual sync token as sync Worker secrets in each environment:

```bash
npx wrangler secret put PHAROS_API_KEY --config wrangler.sync.jsonc --env=""
npx wrangler secret put SYNC_ADMIN_TOKEN --config wrangler.sync.jsonc --env=""
npx wrangler secret put PHAROS_API_KEY --config wrangler.sync.jsonc --env staging
npx wrangler secret put SYNC_ADMIN_TOKEN --config wrangler.sync.jsonc --env staging
```

Do not commit real API keys to `.env*` or source files. Keep Pharos credentials in Cloudflare Worker secrets unless a workflow explicitly needs a separate secret.

## Required GitHub Secrets

Set these repository or environment secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account target for Wrangler |
| `CLOUDFLARE_API_TOKEN` | Deploy and D1 migration access |
| `SYNC_ADMIN_TOKEN` | Optional GitHub environment secret used by the deploy workflow to trigger the sync Worker before the health gate |

The Cloudflare API token needs permission to deploy Workers and apply D1 migrations for the account.

Set these GitHub environment variables for staging and production, or provide them as workflow dispatch inputs:

| Variable | Purpose |
| --- | --- |
| `ROYCOPHAROS_HEALTH_URL` | Web host or full `/api/health` URL checked after deploy |
| `ROYCOPHAROS_SYNC_URL` | Sync Worker URL used for the optional initial sync trigger, including `?mode=all` if desired |

## First Staging Deploy

After replacing the staging D1 ID:

```bash
npm run db:migrate:staging
npm run deploy:worker:staging
npm run deploy:sync:staging
```

Then trigger an initial staging sync before sending traffic to the web Worker:

```bash
curl -X POST \
  -H "Authorization: Bearer <staging-sync-admin-token>" \
  "https://roycopharos-sync-staging.<your-workers-subdomain>.workers.dev/?mode=all"
```

If the workers.dev subdomain is disabled, use the Cloudflare dashboard to run the scheduled Worker once. Validate `/api/health` on the staging web Worker after the sync publishes:

```bash
npm run smoke:health -- https://<staging-web-host>
```

## First Production Deploy

After replacing the production D1 ID and validating staging:

```bash
npm run deploy:production
```

`deploy:production` applies D1 migrations and deploys the web and sync Workers. The Worker custom domain route is configured in `wrangler.jsonc`:

```jsonc
{
  "pattern": "royco.pharos.watch",
  "custom_domain": true
}
```

The `pharos.watch` zone must be active in the Cloudflare account. Cloudflare will create the needed DNS record and certificate for the Worker custom domain.

After deploy, trigger an initial production sync and verify health before treating the hostname as live:

```bash
curl -X POST \
  -H "Authorization: Bearer <production-sync-admin-token>" \
  "https://roycopharos-sync.<your-workers-subdomain>.workers.dev/?mode=all"
npm run smoke:health -- "https://royco.pharos.watch"
```

The manual GitHub deploy workflow can automate the same sequence. Set `ROYCOPHAROS_SYNC_URL`, `ROYCOPHAROS_HEALTH_URL`, and `SYNC_ADMIN_TOKEN` on the selected GitHub environment, or provide `sync_url` and `health_url` when dispatching. The final health step fails unless `/api/health` returns JSON with `ok: true`.

## Build And Preview

```bash
npm run typecheck
npm run test
npm run build
npm run audit:runtime
npm run build:worker
npx wrangler deploy --dry-run --env=""
npx wrangler deploy --config wrangler.sync.jsonc --dry-run --env=""
```

For local Worker preview after a successful OpenNext build:

```bash
npm run preview:worker
```

## Current Production Boundary

Implemented now:

- OpenNext Cloudflare build.
- Wrangler config for `royco.pharos.watch`.
- D1 migration for the current schema.
- D1 read adapter for UI/API routes when `ROYCOPHAROS_STORAGE=d1`.
- D1 write path for the Cloudflare sync Worker.
- Scheduled Worker config for periodic Royco Dawn and Pharos refreshes.
- GitHub CI and manual deployment workflows.
- Runtime dependency audit in CI.
- Post-deploy `/api/health` smoke gate.

Still required before public launch:

- Production-safe publish pointer or equivalent generation model.
- A real staging and production snapshot validated through the deploy health gate.

Do not publicly route traffic to `royco.pharos.watch` until D1 has a validated published snapshot and `/api/health` returns `ok: true`.
