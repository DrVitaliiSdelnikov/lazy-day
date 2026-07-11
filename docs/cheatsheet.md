# LaziGo Cheatsheet

## Quick Start (local)

```bash
npm install
cd docker && docker compose up -d && cd ..
npx tsx tools/run-migrations.ts
npx nx run-many -t serve -p lazy-day api
```

Frontend: http://localhost:4200 | API: http://localhost:3000/v1

## Production

```
Frontend:  lazigo.app              → Cloudflare Pages (auto-deploy on push)
API:       lazy-day-production.up.railway.app → Railway (auto-deploy on push)
DB:        Railway PostgreSQL (no PostGIS — Haversine formula)
Analytics: Yandex.Metrika (110570889) + Google Search Console
```

## Key Commands

```bash
# Build
npx nx build lazy-day              # frontend prod build → dist/lazy-day/browser
npx nx build api                   # backend build
npx nx build shared-models         # shared types lib

# Serve
npx nx serve lazy-day              # :4200 (dev, hot reload)
npx nx serve api                   # :3000 (dev, hot reload)

# Data ingestion
curl -X POST localhost:3000/v1/admin/ingestion/osm                      # OSM places
curl -X POST localhost:3000/v1/admin/ingestion/google-enrich?limit=500  # Google Pro
curl -X POST localhost:3000/v1/admin/ingestion/events/run               # All event sources

# Database
npx tsx tools/run-migrations.ts    # Run pending migrations (001-013)
docker compose -f docker/docker-compose.yml exec postgres psql -U lazyday -d lazyday

# Production DB (Railway)
# Migrations via API: POST /v1/health/migrate
# OSM import: POST /v1/admin/ingestion/osm

# Nx
npx nx reset                       # Clear nx cache
```

## Env Vars

| Var | Required | Where |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | For enrichment | local |
| `SERPAPI_KEY` | For Google Events | local + Railway |
| `DATABASE_URL` | Auto (Railway) | Railway env |
| `TELEGRAM_BOT_TOKEN` | For alerts | Railway env |
| `TELEGRAM_CHAT_ID` | For alerts | Railway env |

## Data Stats

- 3,164 venues (OSM Tbilisi bbox)
- 1,755 Google-enriched (types, hours, ratings, attributes)
- ~55 events (opera.ge + Google Events + YOLO.ge)
- 13 migrations (001-013)
- 6 chains detected (OSM brand:wikidata)

## Scoring Formula

```
score = 0.45×interest + 0.25×distance + 0.15×time + 0.10×quality + 0.05×source
× CHAIN_SCORE_MULTIPLIER (0.85 for chains)
```

Modified by: company, pet, interest weight semantics (strict ≥0.7 = filter, soft 0.3-0.6 = boost).

## API Reference

```
POST /v1/recommendations              # Main feed (scored cards)
GET  /v1/cards/:type/:id?lat=&lng=    # Place/event detail (with distance)
POST /v1/interactions                  # Single interaction
POST /v1/interactions/batch            # Batch interactions (beacon)
GET  /v1/meta/categories              # Interest categories
GET  /v1/health                       # Health + event source freshness
POST /v1/health/migrate               # Run DB migrations (production)
POST /v1/admin/ingestion/osm          # OSM import
POST /v1/admin/ingestion/events/run   # Event refresh
```

## Architecture

```
lazigo.app (Cloudflare Pages)
  └── Angular 21 PWA, i18n (ru/en/ka), 3 themes

Railway (~$5/mo)
  ├── NestJS 11 API
  └── PostgreSQL (Haversine, no PostGIS)

Key features:
  - "Decide for me" (K1) — top-1 fullscreen card
  - Feed loader animation ("пины сбегаются")
  - Night fallback (tomorrow mode)
  - Interaction tracking (beacon API)
  - Event source monitoring (Telegram alerts)
  - Share (navigator.share + clipboard)
  - Undo hide (6s toast)
  - Chain deprioritization (OSM brand detection)
  - GPS auto-init, route/taxi disabled without GPS
```
