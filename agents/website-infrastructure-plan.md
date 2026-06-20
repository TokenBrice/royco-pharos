# RoycoPharos Website And Infrastructure Plan

Prepared 2026-06-20 for turning RoycoPharos from a local-first Next.js prototype into a public website/product on infrastructure similar to Pharos.

## Executive Summary

RoycoPharos should be productized as a Cloudflare-hosted, GitHub-driven application:

- **Primary host:** Cloudflare Workers running the Next.js app through the Cloudflare OpenNext adapter.
- **Database:** Cloudflare D1, replacing production use of local `node:sqlite`.
- **Sync job:** Cloudflare Worker Cron, writing validated snapshots into D1.
- **Source and CI:** GitHub repository, GitHub Actions, branch protection, preview deploys, and production deploys.
- **Domain:** a `pharos.watch` subdomain, preferably `roycopharos.pharos.watch` or `royco.pharos.watch`.
- **Fallback option:** Cloudflare Pages or GitHub Pages only if the product is deliberately flattened into a static site plus a separate API/data artifact path.

The main architectural constraint is that the current repo is not deployable as-is to static hosting. It has Next.js route handlers and server-rendered pages that read SQLite at request time. Static GitHub Pages cannot run those routes. Cloudflare Workers can run full-stack Next.js with the OpenNext adapter, but Workers do not support `node:sqlite`; production storage must move to D1.

## Current State

Current local architecture:

1. `npm run sync` loads Royco Dawn data and Pharos data.
2. It builds a candidate snapshot and scores tranches.
3. It publishes rows into local SQLite at `data/roycopharos.db`.
4. Next.js UI pages and `/api/*` routes read through `src/lib/roycopharos/repository.ts`.
5. Request handlers do not fetch Royco or Pharos directly, which is the right production boundary.

Important current files:

| Area | Files |
| --- | --- |
| App routes | `src/app/page.tsx`, `src/app/markets/[marketKey]/page.tsx`, `src/app/methodology/page.tsx`, `src/app/health/page.tsx` |
| API routes | `src/app/api/**/route.ts` |
| Read repository | `src/lib/roycopharos/repository.ts` |
| SQLite persistence | `src/lib/roycopharos/sqlite.ts`, `src/lib/roycopharos/schema.ts` |
| Sync path | `scripts/sync.ts`, `src/lib/roycopharos/sync-runner.ts` |
| Royco ingestion | `src/lib/roycopharos/royco-dawn.ts` |
| Pharos ingestion | `src/lib/roycopharos/pharos-client.ts` |
| Scoring | `src/lib/roycopharos/scoring.ts`, `docs/scoring.md` |
| Product voice | `PRODUCT.md` |

Current local caveats:

- The directory currently is not a Git worktree. GitHub-based hosting and CI require initializing or reconnecting a repository first.
- Production cannot depend on `data/roycopharos.db`.
- Production cannot depend on lockfiles such as `<db-dir>/.sync.lock`.
- Production cannot print or persist `PHAROS_API_KEY`.
- Production must preserve last-known-good behavior so incomplete or all-`NR` candidates do not replace a valid snapshot.

## Platform Constraints

These constraints should drive the architecture choice.

### Next.js Hosting

Cloudflare's current Next.js guidance splits deployment paths:

- Full-stack SSR Next.js belongs on **Cloudflare Workers** through the OpenNext adapter.
- Static Next.js export belongs on **Cloudflare Pages**.

RoycoPharos currently uses App Router, server-rendered pages, and route handlers, so the natural Cloudflare target is Workers plus OpenNext.

Relevant sources:

- Cloudflare Workers Next.js guide: <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>
- Cloudflare Pages Next.js guide: <https://developers.cloudflare.com/pages/framework-guides/nextjs/>
- Cloudflare Pages static Next.js guide: <https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/>

### SQLite And D1

The current app uses Node's built-in `node:sqlite`. Cloudflare Workers Node compatibility does not support SQLite. Cloudflare D1 is the Cloudflare-native SQLite-compatible managed database exposed through Worker bindings.

Implication: production code must use a storage abstraction where local development can keep `node:sqlite`, but Cloudflare runtime uses D1.

Relevant sources:

- Cloudflare Workers Node.js compatibility: <https://developers.cloudflare.com/workers/runtime-apis/nodejs/>
- Cloudflare D1 Worker API: <https://developers.cloudflare.com/d1/worker-api/d1-database/>
- Cloudflare D1 migrations: <https://developers.cloudflare.com/d1/reference/migrations/>
- Wrangler D1 commands: <https://developers.cloudflare.com/d1/wrangler-commands/>

### Scheduled Sync

Worker Cron is a good fit for periodic upstream fetches and snapshot publication. Cron runs on UTC time and is configured in Wrangler.

Relevant source:

- Cloudflare Cron Triggers: <https://developers.cloudflare.com/workers/configuration/cron-triggers/>

### Domain

For Workers, use a Worker Custom Domain on the `pharos.watch` Cloudflare zone. Cloudflare can create the DNS record and issue certificates for the Worker custom domain.

For a Pages static fallback, use the Pages custom domain flow. For a GitHub Pages fallback, configure the custom domain in GitHub first, then DNS, to reduce subdomain takeover risk.

Relevant sources:

- Cloudflare Workers custom domains: <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>
- Cloudflare Pages custom domains: <https://developers.cloudflare.com/pages/configuration/custom-domains/>
- GitHub Pages custom domains: <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>
- GitHub Pages HTTPS: <https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https>

## Recommended Architecture

```text
GitHub repository
  |
  | pull request
  v
GitHub Actions
  - npm ci
  - typecheck
  - tests
  - build
  - OpenNext preview build
  |
  | merge to main
  v
GitHub Actions production deploy
  - apply D1 migrations
  - deploy Cloudflare Worker
  - smoke test public routes
  |
  v
Cloudflare Worker custom domain
  roycopharos.pharos.watch
  |
  | reads
  v
Cloudflare D1
  published snapshot rows
  sync runs
  history
  Pharos cache
  |
  ^
  | writes on schedule
Cloudflare Worker Cron
  - Royco Dawn fetch
  - Pharos fetch
  - scoring
  - validation
  - publish last-known-good snapshot
```

Recommended production route map:

| Route | Host | Behavior |
| --- | --- | --- |
| `/` | Worker/OpenNext | Server-rendered overview from D1 |
| `/markets/[marketKey]` | Worker/OpenNext | Market detail from D1 |
| `/methodology` | Worker/OpenNext | Methodology rendered from scoring constants |
| `/health` | Worker/OpenNext | Human-readable health page |
| `/api/health` | Worker route handler | Operational health JSON |
| `/api/tranches` | Worker route handler | Published tranches JSON |
| `/api/markets` | Worker route handler | Published markets JSON |
| `/api/markets/[marketKey]` | Worker route handler | Published market JSON |
| `/api/history/tranche/[trancheId]` | Worker route handler | D1 history rows |
| `/api/methodology` | Worker route handler | Methodology JSON |
| `/admin/sync` | Worker route handler, protected | Optional manual sync trigger |

## Alternative Architectures

### Option A: Recommended - Workers + D1 + Cron

Use this if RoycoPharos should remain a live product with SSR pages, API routes, public health, and scheduled ingestion.

Pros:

- Preserves current Next.js mental model.
- Keeps UI and API on the same origin.
- Keeps data reads server-side.
- D1 matches the current relational SQLite schema closely.
- Worker Cron keeps sync near the deployed app.
- Cloudflare custom domains align with the Pharos-style infrastructure request.

Cons:

- Requires D1 repository implementation.
- Requires OpenNext build compatibility work.
- Requires replacing filesystem locks and local SQLite-only code.

### Option B: Cloudflare Pages Static UI + Worker API

Use this if the team wants a static CDN UI but still needs live API/data.

Pros:

- Clear separation between static shell and API.
- Pages offers simple Git-based preview deployments.
- API can still be Workers + D1.

Cons:

- More app refactoring.
- Current server-rendered pages must become static/client-fetching or pre-rendered from artifacts.
- Two deployable surfaces.
- More CORS/cache/version coordination.

### Option C: GitHub Pages Static Snapshot

Use this only for a lightweight public snapshot/demo where live API routes are not required.

Pros:

- Cheapest and simplest static hosting.
- GitHub Actions can publish generated `out/` or JSON artifacts.

Cons:

- No server routes.
- No private runtime secrets.
- No live request-time health.
- No D1 direct binding.
- API routes must be replaced with static JSON files or a separate API host.
- Less aligned with the current app architecture.

## Phase 0: Foundations And Decisions

Goal: remove ambiguity before code changes.

Tasks:

1. Choose the production hostname:
   - Recommended: `roycopharos.pharos.watch`.
   - Acceptable shorter name: `royco.pharos.watch`.
   - Avoid wildcard DNS records.
2. Confirm Cloudflare account ownership of the `pharos.watch` zone.
3. Confirm GitHub organization/repo location.
4. Initialize or reconnect this directory as a Git repository.
5. Decide whether production is public read-only for v1. Recommendation: yes.
6. Decide whether public JSON API is product surface. Recommendation: yes, read-only and cacheable.
7. Decide sync frequency:
   - Royco: every 15 minutes.
   - Pharos: every 60 minutes, or every full sync if rate limits permit.
   - Score freshness follows latest successful publish.
8. Decide deployment environments:
   - `production`: `roycopharos.pharos.watch`.
   - `staging`: `roycopharos-staging.pharos.watch` or Workers preview URL.
   - PR previews: Cloudflare preview deployment if practical.
9. Decide manual sync access:
   - Preferred: Cloudflare Access-protected admin route.
   - Acceptable: GitHub Actions `workflow_dispatch`.
   - Minimal: HMAC-protected route with a Cloudflare secret.
10. Decide retention:
    - Keep the current 30-day observed history policy for v1.

Exit criteria:

- Repository exists on GitHub.
- Domain and environment names are chosen.
- Cloudflare account and zone access are confirmed.
- Owner has approved Workers + D1 + Cron as the primary architecture.

## Phase 1: Repo Productization

Goal: make the repo ready for CI, deploy config, and production operations without changing behavior yet.

Tasks:

1. Add `.env.example` with only placeholder values:
   - `ROYCO_DAWN_LIVE=0`
   - `ROYCO_DAWN_FIXTURE_PATH=`
   - `PHAROS_API_KEY=ph_live_replace_me`
   - `PHAROS_API_BASE=https://api.pharos.watch`
   - `ROYCOPHAROS_DB_PATH=data/roycopharos.db`
2. Add `wrangler.jsonc` skeleton:
   - Worker name.
   - Compatibility date.
   - D1 binding placeholder.
   - Cron triggers.
   - Routes/custom domain placeholders.
   - Environment-specific configuration for staging and production.
3. Add `migrations/` directory for D1 SQL migrations.
4. Add package scripts:
   - `build:worker`
   - `preview:worker`
   - `deploy:worker`
   - `db:migrate:local`
   - `db:migrate:remote`
   - `db:execute:local`
   - `db:execute:remote`
5. Add `docs/deployment.md`.
6. Add `docs/production-runbook.md`.
7. Update `docs/architecture.md` to distinguish:
   - local SQLite development;
   - production D1 runtime;
   - shared repository interface.
8. Add a short product/legal disclaimer to product docs and methodology copy:
   - informational scoring only;
   - no financial advice;
   - no guarantee of solvency, APY, or redemption.
9. Add `SECURITY.md` or a security section in docs:
   - secret handling;
   - report process;
   - API abuse assumptions.
10. Add root `.gitignore` checks if missing:
    - `.env*` except `.env.example`;
    - `data/*.db`, `*.db-wal`, `*.db-shm`;
    - `.wrangler/state`;
    - `.next`;
    - OpenNext output directories;
    - generated screenshots/reports unless explicitly tracked.

Exit criteria:

- `npm run typecheck`, `npm run test`, and `npm run build` still pass locally.
- Repo has deployment docs and a Cloudflare config skeleton.
- No behavior change in local mode.

## Phase 2: Storage Abstraction

Goal: keep local development working while enabling D1 in production.

Current issue:

- `repository.ts` imports `sqlite.ts` directly.
- `sqlite.ts` imports `node:sqlite` directly.
- This cannot run in Cloudflare Workers.

Target shape:

```text
src/lib/roycopharos/storage/
  types.ts              shared repository/storage interfaces
  sqlite-store.ts       local Node implementation
  d1-store.ts           Cloudflare D1 implementation
  factory.ts            chooses store based on runtime/env
```

Tasks:

1. Define read-facing interface:
   - `readSnapshot()`
   - `readLatestSyncRun()`
   - `readTrancheHistory(trancheId, days)`
   - `readPharosUnderlyings()`
   - `readHealth()` if useful.
2. Define write-facing interface:
   - `beginSyncRun()`
   - `writeCandidateSnapshot()`
   - `publishCandidate()`
   - `markRunDegraded()`
   - `pruneHistory()`
   - `writePharosCacheEntries()`
3. Move local SQLite behavior into `sqlite-store.ts` with minimal behavior change.
4. Implement D1 store using D1 prepared statements and `.bind()`.
5. Keep `repository.ts` as the UI/API boundary and make it call the store abstraction.
6. Avoid leaking Cloudflare types into generic domain logic. Keep D1 binding at the edge boundary where practical.
7. Add tests around both:
   - local SQLite store with a temp DB;
   - D1-like behavior with mocked prepared statements or Miniflare/Wrangler integration tests.

Exit criteria:

- Local app still reads and writes via SQLite.
- No direct `node:sqlite` import appears in code that will be bundled for Workers.
- D1 implementation compiles and is covered by tests.

## Phase 3: Production Schema And Migrations

Goal: make D1 schema first-class and safe to evolve.

Tasks:

1. Convert `ROYCOPHAROS_SCHEMA_SQL` into an initial D1 migration:
   - `migrations/0001_initial.sql`.
2. Add migration for any production-specific publish metadata:
   - `published_snapshots` table or equivalent pointer table;
   - sync lock table if using D1 locks;
   - indexes needed by published-read queries.
3. Avoid relying only on `CREATE TABLE IF NOT EXISTS` in production.
4. Add indexes for common reads:
   - latest published snapshot pointer;
   - tranches by market;
   - market history by market/time;
   - tranche history by tranche/time;
   - sync runs by started/published time.
5. Add migration application commands to docs and CI.
6. Add rollback guidance:
   - D1 export before risky migrations;
   - Worker rollback does not automatically roll back schema;
   - destructive migrations require a manual backup and approval.

Suggested production publish tables:

```sql
CREATE TABLE IF NOT EXISTS published_snapshots (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  run_id TEXT NOT NULL,
  published_at INTEGER NOT NULL
);
```

Suggested sync lock table:

```sql
CREATE TABLE IF NOT EXISTS sync_locks (
  lock_name TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

Exit criteria:

- Local and remote D1 migrations can be applied.
- Schema changes are versioned.
- Production read queries do not require table scans for the main pages.

## Phase 4: Safe Publish Model

Goal: preserve last-known-good behavior in a production-safe way.

Current local model:

- `seedDatabase()` writes a `royco_sync_runs` row.
- If validation passes, it deletes current latest rows and inserts replacement latest rows in one transaction.
- If validation fails, it keeps prior latest rows.

Target production model:

- Write each candidate under a new `run_id`.
- Validate candidate completeness before marking it as published.
- Publish by moving a pointer to the candidate `run_id`.
- Reads always filter by the published `run_id`.

Tasks:

1. Tag all latest snapshot tables with `run_id` where needed.
2. Change read queries to use the published run pointer.
3. Candidate write flow:
   - create sync run;
   - insert candidate rows;
   - insert history points only if publish succeeds, or stage them separately;
   - validate candidate count and computed count;
   - update published pointer if valid;
   - mark run `ok` or `degraded`.
4. Preserve validation invariants:
   - empty candidate does not publish;
   - fewer than 18 tranches does not overwrite prior published snapshot;
   - all `NR` candidate does not overwrite prior published snapshot;
   - first boot can publish a partial non-empty candidate only with explicit degraded bootstrap status.
5. Add tests for:
   - first boot partial candidate;
   - prior good snapshot plus undersized candidate;
   - prior good snapshot plus all-`NR` candidate;
   - good candidate replacing prior snapshot;
   - history retention after publish.
6. Ensure failed candidate rows are either retained for debugging with retention or pruned safely.

Exit criteria:

- Reads are always from a published snapshot pointer.
- Bad candidates cannot erase the public site.
- Tests prove last-known-good behavior.

## Phase 5: Worker-Safe Sync

Goal: run ingestion in Cloudflare Worker Cron without filesystem or local SQLite dependencies.

Tasks:

1. Split sync runner into domain and runtime layers:
   - domain: load sources, map tokens, score, validate;
   - runtime: lock, read/write store, secrets, logging.
2. Replace `node:fs` lockfile with D1-backed lock or idempotent run ownership.
3. Keep Royco Dawn fetch as `fetch()` based code.
4. Keep Pharos fetch as `fetch()` based code with:
   - `X-API-Key` from Cloudflare secrets;
   - timeout;
   - bounded 429 retry respecting `Retry-After`;
   - stale-if-error fallback.
5. Add Worker `scheduled()` handler.
6. Add optional HTTP route for manual sync:
   - `POST /admin/sync`;
   - protected by Cloudflare Access or HMAC secret;
   - never public unauthenticated.
7. Add structured sync logs:
   - `runId`;
   - mode;
   - upstream counts;
   - candidate counts;
   - publish status;
   - error code;
   - duration.
8. Keep fixture-first local mode.
9. Add staging cron schedule before production schedule.

Suggested schedules:

| Environment | Cron | Purpose |
| --- | --- | --- |
| staging | `7 * * * *` | hourly staging sync |
| production | `*/15 * * * *` | Royco-grade freshness target |

If Pharos rate limits make 15-minute full syncs too expensive, split jobs:

| Job | Cron | Behavior |
| --- | --- | --- |
| Royco refresh | `*/15 * * * *` | refresh Royco, reuse Pharos cache |
| Pharos refresh | `3 * * * *` | refresh Pharos, rebuild score |
| Full sync | `9 */6 * * *` | full reconciliation |

Exit criteria:

- Worker Cron can publish a fixture snapshot in staging.
- Worker Cron can publish a live snapshot in staging.
- Manual sync path is protected.
- Pharos key is only stored as a Cloudflare secret.

## Phase 6: Next.js On Cloudflare Workers

Goal: prove the app renders correctly under OpenNext/Workers.

Tasks:

1. Add Cloudflare OpenNext adapter dependencies and scripts.
2. Run a compatibility spike with the current `next@16.2.6`.
3. If OpenNext support lags Next 16, choose one:
   - pin Next to a supported version;
   - wait for adapter support;
   - use the static UI plus Worker API fallback.
4. Remove or isolate `output: "standalone"` if it conflicts with OpenNext output.
5. Verify supported features:
   - App Router pages;
   - route handlers;
   - server components;
   - CSS modules;
   - public assets and logos;
   - cache headers;
   - dynamic route params for `marketKey` containing `:`.
6. Confirm no Worker bundle includes unsupported Node APIs:
   - `node:sqlite`;
   - local `node:fs` runtime dependencies;
   - lockfile writes;
   - direct filesystem fixture reads in production bundle.
7. Add environment bindings:
   - `DB`;
   - optional `ENVIRONMENT`;
   - optional `SYNC_ADMIN_SECRET`;
   - Cloudflare secret `PHAROS_API_KEY`.
8. Add smoke tests:
   - `GET /`;
   - `GET /api/health`;
   - `GET /api/tranches`;
   - `GET /methodology`;
   - `GET /markets/{encoded-marketKey}` for a known market.

Exit criteria:

- Staging Worker serves UI and API from D1.
- No unsupported Node runtime dependencies in production path.
- Smoke tests pass after deploy.

## Phase 7: CI/CD

Goal: make production deploys boring and auditable.

### Pull Request Workflow

Run on every PR:

1. `npm ci`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. OpenNext build or preview build
6. Optional: run D1 local migrations and store tests

### Main Branch Deploy Workflow

Run on merge to `main`:

1. `npm ci`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. Build Worker artifact.
6. Apply D1 migrations to production.
7. Deploy Cloudflare Worker.
8. Run smoke tests against production domain.
9. Report deployment URL, Worker version, and smoke status.

### Manual Operations Workflows

Add GitHub Actions `workflow_dispatch` for:

- deploy staging;
- deploy production;
- apply migrations;
- trigger protected sync endpoint;
- smoke test only;
- D1 export/backup command wrapper if credentials allow.

### Required Secrets

GitHub repository secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler deploy target |
| `CLOUDFLARE_API_TOKEN` | Deploy, D1 migrate, Worker operations |

Cloudflare Worker secrets:

| Secret | Purpose |
| --- | --- |
| `PHAROS_API_KEY` | Live Pharos reads |
| `SYNC_ADMIN_SECRET` | Optional manual sync auth |

Do not store `PHAROS_API_KEY` as a public Next env var. Do not expose it to static builds.

Exit criteria:

- PRs are gated.
- Production deploys are reproducible from GitHub.
- Smoke failures fail the deploy workflow or mark it clearly failed.

## Phase 8: Domain, DNS, And TLS

Goal: put the product on the chosen `pharos.watch` subdomain safely.

Recommended Worker custom domain steps:

1. Confirm `pharos.watch` is an active Cloudflare zone.
2. Deploy staging Worker first.
3. Add custom domain in Worker settings or `wrangler.jsonc` route:
   - `roycopharos.pharos.watch`
   - `custom_domain: true`
4. Let Cloudflare create the DNS record and certificate.
5. Verify:
   - `dig roycopharos.pharos.watch`;
   - HTTPS certificate;
   - HTTP redirects to HTTPS if configured;
   - all canonical routes load.
6. Avoid wildcard DNS for this product.
7. Decide whether to redirect any alternatives:
   - `royco.pharos.watch` -> `roycopharos.pharos.watch`;
   - `www.roycopharos.pharos.watch` is probably unnecessary.

If using Cloudflare Pages static fallback:

1. Add custom domain through the Pages project first.
2. Add or let Cloudflare add the CNAME.
3. Verify Pages domain activation.

If using GitHub Pages static fallback:

1. Configure custom domain in GitHub repository settings first.
2. Add CNAME DNS to GitHub Pages host.
3. Enforce HTTPS.
4. Confirm no sensitive generated files are published.

Exit criteria:

- Production hostname resolves.
- HTTPS works.
- No unrelated wildcard DNS is required.
- `*.workers.dev` or preview domains are either acceptable or redirected/protected as desired.

## Phase 9: Observability And Operations

Goal: make failures visible before users discover them.

Public health:

- Keep `/api/health` as no-store JSON.
- Keep `/health` as a human-readable status page.
- Surface:
  - `ok`;
  - `degraded`;
  - freshness;
  - last run;
  - candidate error code;
  - published snapshot time;
  - tranche count;
  - `NR`, conflict, stale, and low-confidence counts.

Internal operations:

1. Use Cloudflare Worker logs for runtime errors.
2. Use `royco_sync_runs` for durable sync audit.
3. Add alerts for:
   - no successful publish in 30 minutes;
   - no Pharos live data in 2 hours;
   - candidate below 18 tranches;
   - candidate all `NR`;
   - `/api/health.ok === false`;
   - repeated Pharos 429 or auth errors;
   - Worker deploy smoke failure.
4. Add D1 backup/export runbook:
   - before destructive migrations;
   - before methodology version changes;
   - weekly/monthly export if product becomes relied on.
5. Add incident runbook:
   - roll back Worker deployment;
   - disable cron;
   - force fixture mode in staging only;
   - restore D1 backup;
   - rotate Pharos key;
   - update public methodology/status copy if data is degraded.

Exit criteria:

- An operator can tell whether the public site is fresh without shell access.
- Sync failures are durable and inspectable.
- There is a documented rollback path.

## Phase 10: Security And Abuse Controls

Goal: keep the first public release appropriately hardened for a read-only risk product.

Tasks:

1. Keep all public routes read-only.
2. Protect manual sync/admin routes.
3. Store Pharos credentials only in Cloudflare secrets.
4. Avoid logging:
   - API keys;
   - full upstream payloads if they could contain sensitive data;
   - request authorization headers.
5. Consider Cloudflare WAF/rate limiting for `/api/*`.
6. Set security headers where compatible:
   - `Strict-Transport-Security`;
   - `X-Content-Type-Options: nosniff`;
   - `Referrer-Policy`;
   - conservative `Content-Security-Policy` after testing assets/scripts.
7. Add dependency scanning:
   - `npm audit --omit=dev` for runtime dependencies;
   - Dependabot or Renovate.
8. Add CORS policy:
   - same-origin by default;
   - if public API is intentionally cross-origin, make that explicit and cacheable.
9. Add method guards:
   - reject non-GET on public API routes;
   - reject non-POST on admin sync.
10. Add body size limits if admin routes accept payloads.

Exit criteria:

- No secrets in GitHub, static assets, or logs.
- Admin operations require authentication.
- Public API cannot mutate data.

## Phase 11: Product Readiness

Goal: make the public website feel like a product, not a leaked prototype.

Tasks:

1. Keep the risk-desk voice from `PRODUCT.md`.
2. Add clear status copy for:
   - fresh;
   - degraded;
   - stale;
   - `NR`;
   - mapping conflict;
   - low-confidence score.
3. Ensure every score has visible evidence:
   - Pharos base score;
   - exposure haircut;
   - tranche structure effect;
   - APY used;
   - freshness.
4. Keep methodology page sourced from the same constants the engine uses.
5. Add canonical metadata:
   - title;
   - description;
   - Open Graph image if desired;
   - favicon.
6. Add no-financial-advice copy in a restrained way.
7. Validate mobile and desktop layout.
8. Validate accessibility:
   - keyboard navigation;
   - contrast;
   - non-color status signals;
   - reduced motion.
9. Validate performance:
   - initial load;
   - table rendering;
   - API cache headers;
   - no oversized screenshots accidentally shipped.
10. Decide whether API docs remain public at `docs/api.md` only or get a product page.

Exit criteria:

- Site can be shown to Pharos/Royco stakeholders.
- Users can tell whether data is current and complete.
- The product does not imply guarantees or financial advice.

## Phase 12: Launch Sequence

### Staging Launch

1. Create staging D1 database.
2. Apply migrations.
3. Deploy staging Worker.
4. Publish fixture snapshot.
5. Publish live snapshot with Royco + Pharos.
6. Run smoke tests.
7. Manually inspect:
   - homepage;
   - market page;
   - methodology page;
   - health page;
   - all public API routes.
8. Force bad candidates in staging:
   - fewer than 18 tranches;
   - all `NR`;
   - failed Pharos fetch;
   - failed Royco fetch.
9. Confirm last-known-good behavior.
10. Confirm stale/degraded UI states.

### Production Launch

1. Create production D1 database.
2. Apply migrations.
3. Configure Cloudflare secrets.
4. Deploy production Worker without public domain or on temporary Workers URL.
5. Run first production sync.
6. Verify `/api/health`.
7. Attach custom domain.
8. Run external smoke tests.
9. Enable production cron.
10. Monitor first 24 hours:
    - sync runs;
    - freshness;
    - Worker logs;
    - Pharos rate limits;
    - D1 query behavior.

### Public Announcement Readiness

Do not announce until:

- Latest production snapshot has at least 18 tranches.
- `ok` is true.
- Royco and Pharos freshness are within target.
- Methodology version is final for launch.
- Disclaimer is visible.
- Operator knows rollback steps.

## Verification Matrix

| Change Type | Required Verification |
| --- | --- |
| Docs only | Content/link sanity check |
| Storage abstraction | `npm run typecheck && npm run test` plus local DB read/write tests |
| D1 migrations | Local D1 migration, remote staging migration, read/write smoke |
| Scoring/methodology | `npm run calibrate && npm run sync && npm run status && npm run typecheck && npm run test` |
| Worker sync | Staging cron/manual sync, `/api/health`, bad-candidate tests |
| UI/app routing | `npm run typecheck && npm run build`, Worker preview, browser screenshots |
| Production deploy | Migration, deploy, smoke tests, health check |

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Workers cannot run `node:sqlite` | High | D1 store abstraction before production |
| OpenNext does not support current Next version cleanly | High | Spike early; pin supported Next version or choose static/API split |
| Bad candidate overwrites good snapshot | High | Published `run_id` pointer and validation tests |
| Sync races | High | D1 lock or idempotent run ownership |
| Pharos key leaks | High | Cloudflare secrets only; never public env |
| Pharos rate limits | Medium | Split Royco and Pharos schedules; respect `Retry-After`; stale-if-error |
| D1 migration breaks production reads | High | Staging migration first; backup/export; rollback plan |
| Domain misconfiguration | Medium | Use Worker custom domain flow; avoid wildcard DNS |
| Public API abuse | Medium | Cache headers, rate limits/WAF, read-only route guards |
| Stale data appears trustworthy | High | Prominent freshness and degraded states |
| Methodology/code drift | High | Methodology page from engine constants; version bumps and tests |
| Generated/local artifacts get committed | Medium | `.gitignore`, CI checks, repo review |

## Open Questions

1. What exact subdomain should be used?
2. Which GitHub org should own the repo?
3. Who owns the Cloudflare account and `pharos.watch` zone?
4. Should public API consumers be supported as a formal surface?
5. Is a staging subdomain required, or are Worker preview URLs enough?
6. Should manual sync be Cloudflare Access-protected or GitHub Actions-only?
7. What is the acceptable public freshness SLA?
8. Should history remain 30 days for v1?
9. Is a no-index launch desired before public announcement?
10. Who approves methodology changes after launch?

## Initial Implementation Order

Recommended first milestone:

1. Initialize/reconnect Git repository.
2. Add deployment docs, `.env.example`, `wrangler.jsonc`, and GitHub Actions skeleton.
3. Add D1 migrations from current schema.
4. Introduce storage abstraction.
5. Implement D1 read path.
6. Deploy staging Worker that serves fixture data from D1.
7. Port sync write path to D1.
8. Add Worker Cron and protected manual sync.
9. Run live staging sync.
10. Attach production custom domain only after staging passes bad-candidate and freshness tests.

This sequence keeps the riskiest assumptions early: OpenNext compatibility, D1 compatibility, and safe publish semantics.

