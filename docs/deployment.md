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
  -> royco.pharos.watch
       reads Cloudflare D1 binding DB
Cloudflare Cron
  -> sync Worker
  -> Royco Dawn + Pharos reads
  -> D1 published snapshot
```

Local development still uses `node:sqlite` at `data/roycopharos.db`. Production reads use Cloudflare D1 when `ROYCOPHAROS_STORAGE=d1`.

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

The Cloudflare API token needs permission to deploy Workers and apply D1 migrations for the account.

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

If the workers.dev subdomain is disabled, use the Cloudflare dashboard to run the scheduled Worker once. Validate `/api/health` on the staging web Worker after the sync publishes.

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
curl "https://royco.pharos.watch/api/health"
```

## Build And Preview

```bash
npm run typecheck
npm run test
npm run build
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

Still required before public launch:

- Production-safe publish pointer or equivalent generation model.
- External smoke tests after a real D1 snapshot is published.

Do not publicly route traffic to `royco.pharos.watch` until D1 has a validated published snapshot and `/api/health` returns `ok: true`.
