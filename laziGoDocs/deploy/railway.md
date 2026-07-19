# Deploy Guide

## Infrastructure

| Component | Service | Region |
|---|---|---|
| Frontend | Cloudflare Pages | Edge (global) |
| API | Railway | EU West |
| Database | Railway PostgreSQL | EU West |
| Domain | Cloudflare DNS | lazigo.app |
| Analytics | GA4 + Yandex.Metrika | — |

## Deploy Frontend

Automatic on push to `main`. Cloudflare Pages builds Angular SSR.

## Deploy API

Automatic on push to `main`. Railway builds from Dockerfile.

## Post-Deploy Checklist (Personalization)

Before personalization works on prod, run these in order:

```bash
# 1. Run migration 018 (facets + personalization tables)
POST /v1/health/migrate

# 2. Backfill osm_id on venues
npx tsx tools/backfill-osm-id.ts

# 3. Map Google types to facets
POST /v1/admin/ingestion/map-facets

# 4. Run Gemini enrichment (atmosphere/occasion)
POST /v1/admin/ingestion/gemini-enrich?limit=500
# Repeat until all 3,168 venues enriched

# 5. Recalculate IDF
POST /v1/admin/ingestion/recalculate-idf

# 6. Sync enrichment from local (if needed)
npx tsx tools/sync-atmosphere-to-prod.ts
```

## Railway Notes

- **Console**: Deployments tab → click deployment → Deploy Logs. Terminal: `root@.../app#`
- **No curl in container** — use `node -e "fetch(...).then(r=>r.json()).then(console.log)"`
- **Proxy timeout**: ~30s for external requests. Use localhost from Console for long ops.
- **Body limit**: `5mb` (configured in main.ts)
- **Env vars**: `ADMIN_SECRET`, `GOOGLE_PLACES_API_KEY`, `DATABASE_URL`

## Known Issues

- tkt.ge + biletebi.ge blocked by Cloudflare (403 from Railway IPs). Push-model workaround via GitHub Actions.
- 14 venues loop forever in Enterprise enrichment — likely missing placeId. Non-critical.
