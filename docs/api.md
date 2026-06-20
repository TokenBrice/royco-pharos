# API

All API routes are implemented with Next.js route handlers under `src/app/api`.

Routes read from the latest published snapshot through `src/lib/roycopharos/repository.ts`: local development uses SQLite, while Cloudflare production uses D1 when `ROYCOPHAROS_STORAGE=d1`. They do not fetch Royco or Pharos live during request handling.

## Response Conventions

Most list/detail routes return:

```json
{
  "data": "...",
  "_meta": {
    "royco": {
      "ageSeconds": 120,
      "status": "fresh",
      "warning": null
    },
    "pharos": {
      "ageSeconds": 300,
      "status": "fresh",
      "warning": null
    },
    "score": {
      "ageSeconds": 120,
      "status": "fresh",
      "warning": null
    }
  }
}
```

`_meta` is an `ApiMeta` object. Each block is a `FreshnessBlock` with timestamps where available, `ageSeconds`, `status`, and optional `warning`.

Freshness statuses:

| Status | Meaning |
| --- | --- |
| `fresh` | Within the expected freshness window. |
| `degraded` | Outside the fresh window but not stale. |
| `stale` | Beyond the stale threshold. |

Error responses are JSON and use `Cache-Control: no-store`:

```json
{
  "error": "snapshot_unavailable",
  "message": "RoycoPharos production D1 snapshot is unavailable. Run migrations and publish a sync before serving traffic."
}
```

Routes that require a published snapshot return status `503` with `error: "snapshot_unavailable"` until D1 has a published sync. Detail routes still return `404` for valid snapshots where the requested market or tranche does not exist.

## Endpoints

### `GET /api/health`

Returns operational health, counts, freshness, and latest sync-run summary.

Cache header: `Cache-Control: no-store`

Status is `200` when `ok: true`; otherwise it is `503` with the same JSON health body so deploy smoke checks can fail with diagnostics.

Important fields:

| Field | Meaning |
| --- | --- |
| `ok` | Published snapshot has at least 18 tranches. |
| `degraded` | Latest run or freshness state indicates degradation. |
| `generatedAt` | Latest published snapshot timestamp. |
| `marketCount` | Published market count. |
| `trancheCount` | Published tranche count. |
| `mappedTrancheCount` | Tranches with mapped Pharos IDs. |
| `conflictCount` | Mapping conflicts. |
| `nrCount` | Not-rated tranche count. |
| `lowConfidenceCount` | Low-confidence tranche count. |
| `staleCount` | Stale tranche count. |
| `freshness` | Compact Royco, Pharos, and score statuses. |
| `lastRun` | Latest sync run summary. |
| `meta` | Full freshness metadata. |

Example:

```bash
curl http://localhost:3000/api/health
```

### `GET /api/tranches`

Returns all published tranches.

Cache header: `Cache-Control: s-maxage=60, stale-while-revalidate=240`

Response:

```json
{
  "data": [
    {
      "trancheId": "1:market-id:senior",
      "marketKey": "1:market-id",
      "marketName": "Example market",
      "side": "senior",
      "baseAssetScore": 66,
      "exposureScore": 58,
      "trancheStructureScore": 86,
      "safetyScore": 72,
      "safetyGrade": "A",
      "opportunityYield": 9.6,
      "opportunityScore": 80,
      "opportunityGrade": "B",
      "scoreStatus": "computed"
    }
  ],
  "_meta": {}
}
```

The actual tranche shape is `RoycoTrancheView` from `src/lib/roycopharos/types.ts`.

Example:

```bash
curl http://localhost:3000/api/tranches
```

### `GET /api/markets`

Returns all published markets with nested tranches, underlyings, and history.

Cache header: `Cache-Control: s-maxage=60, stale-while-revalidate=240`

The market shape is `RoycoMarketView`.

Each market includes `underlyings: UnderlyingSummary[]`. `UnderlyingSummary` carries the Pharos base-asset read used by
the scorer:

| Field | Meaning |
| --- | --- |
| `underlyingSafetyScore` / `underlyingSafetyGrade` | Pharos Safety Score and grade, shown verbatim. |
| `dews` | Pharos DEWS signal when reported, including status, stress score, summary, and timestamps. |
| `upstreamDependencies` | Named upstream dependencies reported by Pharos, including weight, Pharos score/grade, and link when available. |
| `pharosUrl` | Link to the Pharos stablecoin dossier for the base asset. |

Example:

```bash
curl http://localhost:3000/api/markets
```

### `GET /api/markets/[marketKey]`

Returns one market by `marketKey`.

Cache header: `Cache-Control: s-maxage=60, stale-while-revalidate=240`

`marketKey` is built as:

```text
{chainId}:{marketId}
```

Because `marketKey` contains `:`, callers should URL-encode it when constructing URLs.

Example:

```bash
curl "http://localhost:3000/api/markets/1%3Aexample-market"
```

Not found response:

```json
{
  "error": "market_not_found"
}
```

Status: `404`

### `GET /api/history/tranche/[trancheId]?days=30`

Returns APY and TVL history for one tranche.

Cache header: `Cache-Control: s-maxage=120, stale-while-revalidate=300`

`days` is clamped to the range `1..30`.

`trancheId` is built as:

```text
{chainId}:{marketId}:{side}
```

URL-encode it when constructing URLs.

Response:

```json
{
  "data": {
    "trancheId": "1:market-id:senior",
    "days": 30,
    "apy": [
      { "observedAt": 1770000000, "value": 5.2 }
    ],
    "tvl": [
      { "observedAt": 1770000000, "value": 250000 }
    ]
  },
  "_meta": {}
}
```

Not found response:

```json
{
  "error": "tranche_not_found"
}
```

Status: `404`

### `GET /api/methodology`

Returns the methodology payload and freshness metadata.

Cache header: `Cache-Control: s-maxage=300, stale-while-revalidate=600`

Response shape:

```json
{
  "data": {
    "version": "royco-opportunity-v0.6",
    "safetyScoreName": "Royco Safety Score",
    "opportunityScoreName": "Royco Opportunity Score",
    "safetyFormula": "clamp(round(pharosBaseScore - exposureHaircut + seniorCushionCredit - trancheStructureHaircut), 0, 100)",
    "opportunityFormula": "clamp(round((APY x (Safety / 100) ^ gamma) / 12% * 100), 0, 100)",
    "safetyBands": [],
    "opportunityBands": [],
    "layerFactors": [],
    "structureFactors": [],
    "disclaimer": "..."
  },
  "_meta": {}
}
```

Example:

```bash
curl http://localhost:3000/api/methodology
```

## Common Types

Canonical TypeScript interfaces live in `src/lib/roycopharos/types.ts`.

Most useful exported view types:

| Type | Use |
| --- | --- |
| `RoycoPharosSnapshot` | Full in-memory/read snapshot. |
| `RoycoMarketView` | Market detail shape. |
| `RoycoTrancheView` | Tranche row/detail shape. |
| `UnderlyingSummary` | Pharos base-asset summary. |
| `PenaltyBreakdownRow` | Factor-level score explanation. |
| `MethodologyPayload` | Methodology route shape. |
| `ApiMeta` | Freshness metadata shape. |

## Cache Notes

The JSON routes use short CDN-style cache headers, but local Next.js development may still execute dynamically because the pages and routes are marked around live snapshot reads. `/api/health` is always `no-store`.

Do not infer upstream freshness from HTTP cache age. Use `_meta.royco`, `_meta.pharos`, and `_meta.score`.
