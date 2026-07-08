# LazyDay Cheatsheet

## Quick Start

```bash
npm install
cd docker && docker compose up -d && cd ..
npx tsx tools/run-migrations.ts
GOOGLE_PLACES_API_KEY=... SERPAPI_KEY=... npx nx run-many -t serve -p lazy-day api
```

Frontend: http://localhost:4200 | API: http://localhost:3000/v1

## Key Commands

```bash
# Build
npx nx build lazy-day              # frontend prod build → dist/lazy-day
npx nx build shared-models         # shared types lib
npx nx build api                   # backend build

# Serve
npx nx serve lazy-day              # :4200 (dev, hot reload, proxy /v1 → :3000)
npx nx serve api                   # :3000 (dev, hot reload)

# Data ingestion
curl -X POST localhost:3000/v1/admin/ingestion/osm                      # OSM places
curl -X POST localhost:3000/v1/admin/ingestion/google-enrich?limit=500  # Google Pro
curl -X POST localhost:3000/v1/admin/ingestion/google-enrich-enterprise?limit=500
curl -X POST localhost:3000/v1/admin/ingestion/google-enrich-atmosphere?limit=500
curl -X POST localhost:3000/v1/admin/ingestion/events/run               # All event sources
curl -X POST localhost:3000/v1/admin/ingestion/events/source/opera.ge   # One source

# Database
npx tsx tools/run-migrations.ts    # Run pending migrations (001-012)
docker compose -f docker/docker-compose.yml exec postgres psql -U lazyday -d lazyday

# Nx
npx nx reset                       # Clear nx cache (fixes stale builds)
npx nx graph                       # Dependency graph
```

## Env Vars

| Var | Required | Example |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | For enrichment | `AIza...` |
| `SERPAPI_KEY` | For Google Events | `0c69...` |
| `DATABASE_URL` | Optional (default: local) | `postgresql://lazyday:lazyday_dev@localhost:5434/lazyday` |

## Data Stats (current)

- 3,166 venues (OSM + expanded bbox)
- 1,755 Google-enriched (types, hours, ratings, attributes)
- 57 events (opera.ge + Google Events + YOLO.ge)
- 12 migrations (001-012)

## Scoring Formula

```
score = 0.45×interest + 0.25×distance + 0.15×time + 0.10×quality + 0.05×source
```

Modified by: company (family/couple/friends), pet (allowsDogs fact), interest weight semantics (strict ≥0.7 = filter, soft 0.3-0.6 = boost).

## API Quick Reference

```
POST /v1/recommendations           # Main feed
GET  /v1/cards/:type/:id           # Place/event detail
POST /v1/interactions              # User actions (save, hide, click)
GET  /v1/meta/categories           # Interest categories
GET  /v1/health                    # Health check
```
