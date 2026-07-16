# LazyDay

Contextual leisure discovery. Not a map — a **decision engine**.
Google Maps tells you WHAT exists. LazyDay tells you WHERE TO GO.

Angular 21 PWA + NestJS 11 API + PostgreSQL/PostGIS. Nx monorepo.

## Quick Start

```bash
npm install
cd docker && docker compose up -d && cd ..   # postgres + redis
npx tsx tools/run-migrations.ts               # DB schema (001-012)
npx nx run-many -t serve -p lazy-day api      # frontend :4200 + api :3000
curl -X POST http://localhost:3000/v1/admin/ingestion/osm  # OSM import
GOOGLE_PLACES_API_KEY=... npx nx serve api    # with Google enrichment
```

## Projects

| Project | Path | Stack |
|---|---|---|
| lazy-day | `src/` | Angular 21, PrimeNG, signals |
| api | `apps/api/` | NestJS 11, TypeORM, PostgreSQL+PostGIS |
| shared-models | `libs/shared-models/` | Pure TypeScript types |

## Product Identity

Our value is NOT data (Google has more). Our value is:

1. **Compound context** — 5+ dimensions simultaneously (interest + company + pet + time + distance). Google filters one at a time
2. **Explainability** — "Тебе нравится: природа • Открыто • Для пары • 11 мин" — Google doesn't explain WHY
3. **Decision reduction** — 8 scored results, not 200. Less choice = better UX
4. **Events + places unified** — Google Events and Google Maps are separate. We merge them
5. **Social context** — "I'm with family + dog" changes everything. Google has no concept of this

See `docs/research/product-differentiation.md` for full analysis and competitive moat strategy.

## Core Engine

- **Scoring**: `0.45×interest + 0.25×distance + 0.15×time + 0.10×quality + 0.05×source`
- **Dynamic categories**: venue tags split into primary/secondary per request (same venue = different classification per user)
- **Interest synonyms**: user says "nature" → engine matches `[outdoor, park, garden, viewpoint]`
- **Weight semantics**: ≥0.7 = hard filter ("I want this"), 0.3-0.6 = soft boost, <0.3 = ignored
- **Company modifiers**: family penalizes nightlife, couple boosts viewpoints, friends boosts bars
- **Pet modifier**: fact-based (`allowsDogs` from Google) → proxy fallback (tag-based) + `outdoorSeating` softening
- **Opening hours**: dual-format parser (OSM raw + Google structured periods), auto-detect
- **Adaptive radius**: expands ×1.5 if <5 relevant results (up to 2x)
- **No serendipity pool**: hard filter, not random noise

## Data Coverage

| Data | Coverage | Source |
|---|---|---|
| Venues | 3,166 | OSM (bbox incl. Lilo, Orkhevi) |
| Google matched | 1,755 (55%) | Google Places |
| Opening hours | 1,794 (57%) | Google + OSM |
| Ratings | 1,755 local / ~1,256 prod (40%) | Google |
| allowsDogs | 607 | Google Atmosphere |
| goodForChildren | 1,292 | Google Atmosphere |
| Events | ~68 (4 opera.ge + 20 Google Events + 24 YOLO.ge + tkt.ge/biletebi.ge disabled) | 5 adapters (3 active) |
| Localization | en: ~74%, ka: ~54% | OSM name_en/name_ka |

## Docs

### Technical
- `docs/scoring.md` — scoring formula, all modifiers, explanations table
- `docs/data-quality.md` — OSM pipeline, tag vocabulary, venue status
- `docs/api-endpoints.md` — API reference
- `docs/database.md` — tables, migrations (001-012)
- `docs/project-status.md` — full project state, decisions, roadmap

### Research
- `docs/research/product-differentiation.md` — why LazyDay ≠ Maps, 5 pillars, moat timeline
- `docs/research/events-unified-strategy.md` — layered events (aggregator + local + monitoring)
- `docs/research/events-scalable-strategy.md` — SerpApi, City-as-Config model
- `docs/research/events-ingestion-plan.md` — adapter pattern, opera.ge, source analysis
- `docs/research/ux-improvements-analysis.md` — UX review, agreements, disagreements
- `docs/research/categorization-and-ranking-strategy.md` — serendipity, interest weights, cold start
- `docs/research/company-context-strategy.md` — company matrix, venue attributes
- `docs/research/google-places-api-integration.md` — pricing, fields, enrichment results
- `docs/research/search-sorting-pagination.md` — adaptive scoring, sort modes, pagination
- `docs/research/location-selection-strategy.md` — GPS + coords vs districts, scaling
- `docs/research/competitive-analysis-notes.md` — actionable insights, monetization, crowd data
- `docs/research/events-local-sources-verified.md` — verified sources, dedup, legal
- `docs/product-brief.md` — 3-page product overview

## Roadmap (what builds the moat)

### MVP — Intelligence + Events + Deploy — COMPLETE
1. ~~Events: SerpApi Google Events~~ — DONE
2. ~~Mood presets~~ — DONE (6 presets)
3. ~~Events: YOLO.ge parser~~ — DONE
4. ~~Event cron~~ — DONE (daily 02:00 UTC)
5. ~~Type filter~~ — DONE
6. ~~Closed venues filter~~ — DONE
7. ~~Location: GPS + coords~~ — DONE
8. ~~Interest categories~~ — DONE (11 intent-based)
9. ~~SEO basics~~ — DONE (robots, sitemap, OG, JSON-LD, hreflang)
10. ~~Domain~~ — DONE (lazigo.app, Cloudflare DNS)
11. ~~Privacy~~ — DONE (privacy.component.ts, consent-banner.component.ts, Consent Mode v2)
12. ~~Interaction schema~~ — DONE (migration 013, interaction_events entity)
13. ~~Analytics~~ — DONE (GA4 G-8RSG5LFWBC + Google Ads AW-18318311908, gtag events)
14. ~~Deploy~~ — DONE (Cloudflare Pages + Railway EU West)
**Full roadmap with decisions: `docs/roadmap.md`**

### Post-MVP — done in 2026-07-16 session
- ~~Events: tkt.ge adapter~~ — DONE (8 categories, 125 events). Disabled: Cloudflare blocks Railway IP.
- ~~Events: biletebi.ge adapter~~ — DONE. Disabled: same Cloudflare issue.
- ~~Landing page~~ — DONE (entry point, company+preset chips, event cards, ProfileStore sync)
- ~~Telegram monitoring~~ — DONE (daily alerts on source failures)
- ~~Google enrichment sync~~ — DONE (~1,256/1,755 venues with ratings on prod)
- ~~locationRestriction fix~~ — DONE (future enrichment works from prod directly)

### Current TODOs
- [ ] osm_id migration (018) — stable sync key for cross-env, future cities
- [ ] Atmosphere enrichment on prod (allowsDogs/goodForChildren)
- [ ] Remaining ~500 venue enrichment gap (coord collisions, short names)
- [ ] tkt.ge + biletebi.ge proxy solution (Cloudflare bypass)
- [ ] Remove temporary `import-enrichment` endpoint after osm_id
- [ ] Telegram env vars (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
- [ ] Share button, behavioral tracking

### v1 — Community Layer (the moat)
1. ~~Events: TKT.ge~~ — DONE (adapter ready, blocked by Cloudflare)
2. Micro-tips + collections + "been here" badges
3. Search/autocomplete
4. Conversational discovery (one smart question per session)
5. Compact API + offline cache

### v2 — Personalization + Scale
6. Behavioral re-ranking (from accumulated user data)
7. Gamification (exploration badges, streaks)
8. Journey planner
9. Weather-aware
10. City expansion via CityConfig (needs osm_id first)
11. Local curator network

### Competitive Moat Timeline
```
Month 1-3:  Intelligence advantage (DONE: scoring, explanations, context)
Month 3-6:  Behavioral data (save/hide/click from real users)
Month 6-12: Community data (tips, collections, badges — network effect)
Month 12+:  Curator network + multi-city = sustainable moat
```

## Critical: Event Freshness

Events must be refreshed daily. Stale events = broken trust.

Automated via `@nestjs/schedule` cron (daily 02:00 UTC = 06:00 Tbilisi). Manual: `POST /v1/admin/ingestion/events/run`.

| Source | Refresh | Cost | Notes |
|---|---|---|---|
| opera.ge | 1x/day | 0 | Free HTML parser |
| google_events | 1x/day | 3 SerpApi/day | 90/month ≈ free tier limit (100/mo) |
| yolo.ge | 1x/day | 0 | Free AJAX endpoint |
| tkt.ge | **disabled** | 0 | Cloudflare 403 blocks Railway IPs |
| biletebi.ge | **disabled** | 0 | Cloudflare 403 blocks Railway IPs |

**SerpApi quota**: 100 searches/month (free tier), resets 1st of each month. Cached (identical) queries = free, don't count. Our 1 run = 3 searches. Daily refresh = 90/month. Fits in free tier for 1 city. No cost. 2+ cities = $50/mo plan (5,000 searches).

**Automated**: `@nestjs/schedule` cron runs daily at 06:00 Tbilisi (02:00 UTC). Marks past events, refreshes all sources. Manual trigger: `POST /v1/admin/ingestion/events/run`.

## Open UX Questions

- **Opening hours unknown (57% venues)**: currently no label shown. Closed venues hard-filtered. Need to decide: show "Hours unknown"? Or improve coverage (more Google enrichment)? For now — silence = no data, don't lie to user.

## Google Enrichment Pipeline

Three-phase enrichment. All require `GOOGLE_PLACES_API_KEY` env var on Railway.
Run order: Pro → Enterprise → Atmosphere (each phase needs the previous).

| Phase | Endpoint | What it writes | Cost |
|---|---|---|---|
| Pro | `POST /v1/admin/ingestion/google-enrich?limit=N` | `googlePlaceId`, photos, types | ~$0 (free) |
| Enterprise | `POST /v1/admin/ingestion/google-enrich-enterprise?limit=N` | **rating, ratingCount, openingHours** | ~$35 |
| Atmosphere | `POST /v1/admin/ingestion/google-enrich-atmosphere?limit=N` | allowsDogs, goodForChildren | ~$39 |

**Important**: limit=100-200 max from external URL (Railway proxy timeout). From Railway Console use `node -e "fetch('http://localhost:3000/...', {method:'POST'}).then(r=>r.json()).then(console.log)"` (no curl in container).

**Prod status (2026-07-16)**:
- Pro matched: ~684 (via API) + 572 (via coord sync) = **~1,256 venues with ratings**
- Local: 1,755. Gap: ~500 (venues with coord collisions or no match)
- Atmosphere: NOT run (allowsDogs/goodForChildren = 0 on prod)
- `locationRestriction` fix deployed — future enrichment runs on prod directly
- Coord-based sync done — `import-enrichment` endpoint works, remove after osm_id migration

## Cost Tracking

| Month | Google Places | SerpApi | Total | Budget |
|---|---|---|---|---|
| July 2026 (local) | $74 | $0 (free tier) | $74 | $100 |
| July 2026 (prod) | ~$35 (enterprise enrichment) | $0 | ~$35 | $100 |

Google Places breakdown: Pro (free) + Enterprise (~$35) + Atmosphere (~$39). One-time enrichment, not recurring.

## Deploy

- Domain: **lazigo.app** (lazy + go)
- Frontend: `lazigo.app` → Cloudflare Pages
- API: `api.lazigo.app` → **Railway** (EU West, Node.js 22, 1 replica)
- DB: Railway PostgreSQL (EU West, migrated from US West)
- Migrations: `POST /v1/health/migrate` (inline MIGRATIONS array in `health.controller.ts`)
- Manual ingestion: `POST /v1/admin/ingestion/events/run`
- Discover endpoint: `POST /v1/recommendations` (NOT /v1/discover)

## Known Issues

### tkt.ge + biletebi.ge: Cloudflare IP Block (2026-07-16)
Railway runs on shared datacenter IPs. tkt.ge and biletebi.ge are both behind Cloudflare
which returns **HTTP 403** to all Railway egress IPs. The adapters are registered and in
`event_sources` but `enabled=false` until a proxy solution is in place.

Root cause: outbound requests from Railway → Cloudflare bot protection → 403 HTML page →
`response.json()` throws → caught per-category silently → `fetched: 0, errors: 0`.

**Fix options:**
- ScrapingBee / ScraperAPI ($30-50/mo) — simplest
- Georgian VPS ($5-10/mo) + cron → POST to Railway ingest endpoint
- Cloudflare Worker as proxy (free 100k req/day)

**Current state:** both sources disabled in DB (`enabled=false`).
To re-enable after proxy is set up: `UPDATE event_sources SET enabled=true WHERE name IN ('tkt.ge','biletebi.ge')`

### Railway Console: no curl (2026-07-16)
Railway containers don't have `curl`. Use `node -e "fetch(...)"` for all HTTP calls from Console.

### Railway proxy timeout (2026-07-16)
External requests to `api.lazigo.app` timeout after ~30s. For long operations (enrichment, bulk ingestion),
use Railway Console with `http://localhost:3000/...` to bypass the proxy. Or use smaller batch sizes (limit=100-200).

### Google enrichment: sync resolved, gap remaining (2026-07-16)
- **Fixed**: `locationBias` → `locationRestriction` (rectangle + regionCode:GE). +162 new matches on prod.
- **Fixed**: coord-based sync (lat/lng match, ABS < 1e-7). +572 venues synced from local.
- **Remaining gap**: ~500 venues (local 1,755 vs prod ~1,256). Mostly coord collisions or short Georgian names.
- **TODO**: osm_id migration (018) for permanent stable key. After that, remove `import-enrichment` endpoint.
- **TODO**: Atmosphere enrichment on prod (allowsDogs/goodForChildren).
- NestJS body limit ~100KB — sync uses chunks of 30 records.

### Migration numbers used
016 = biletebi.ge source, 017 = tkt.ge source. Next free: **018**.
