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
| Ratings | 1,755 (55%) | Google |
| allowsDogs | 607 | Google Atmosphere |
| goodForChildren | 1,292 | Google Atmosphere |
| Events | 55 (10 opera.ge + 21 Google Events + 24 YOLO.ge) | 3 adapters |
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

### MVP — Intelligence + Events + Deploy
1. ~~Events: SerpApi Google Events~~ — DONE (21 events, one adapter any city)
2. ~~Mood presets~~ — DONE (6 presets: chill, active, family, culture, food, nightlife)
3. ~~Events: YOLO.ge parser~~ — DONE (24 events, AJAX endpoint, workshops/exhibitions/excursions)
4. ~~Event cron~~ — DONE (daily 06:00 Tbilisi, marks past, refreshes all sources)
5. ~~Type filter~~ — DONE (Всё / Места / События, client-side)
6. ~~Closed venues filter~~ — DONE (hard-filtered from results)
7. ~~Location: GPS + coords~~ — DONE (removed districts, DMS parser)
8. ~~Interest categories~~ — DONE (11 intent-based: food, nature, culture, active, entertainment...)
9. **Pre-deploy: Domain** — buy lazyday.app or lazyday.ge, configure DNS ← NEXT
10. **Pre-deploy: SEO basics** — robots.txt, sitemap.xml, meta+OG tags on index.html
11. **Pre-deploy: Privacy** — privacy policy page, consent banner (GDPR)
12. **Pre-deploy: Analytics** — Plausible/Umami (no consent) + Yandex.Metrica (with consent)
13. **Pre-deploy: Webmaster** — Google Search Console + Yandex.Webmaster (verify domain)
14. **Deploy** — Cloudflare Pages (frontend) + Hetzner VPS (API: api.lazyday.app)
15. **Post-deploy: Share button** — native share on cards + detail page
16. **Post-deploy: Behavioral tracking** — verify interactions, add dwell time, session context
17. **Post-deploy: SSR for detail pages** — event/venue JSON-LD for Google rich results
18. **Visited + behavioral re-ranking** — after enough data
19. **Sort modes** — Smart / Closest / Top rated / Open now

### v1 — Community Layer (the moat)
6. Events: TKT.ge (Puppeteer, only if Google gap >30%). 7. Micro-tips + collections + "been here" badges. 8. Search/autocomplete. 9. Conversational discovery (one smart question per session). 10. Compact API + offline cache.

### v2 — Personalization + Scale
11. Behavioral re-ranking (from accumulated user data). 12. Gamification (light: exploration badges, streaks). 13. Journey planner. 14. Weather-aware. 15. City expansion via CityConfig. 16. Local curator network.

### Competitive Moat Timeline
```
Month 1-3:  Intelligence advantage (done: scoring, explanations, context)
Month 3-6:  Behavioral data (save/hide/click from real users)
Month 6-12: Community data (tips, collections, badges — network effect)
Month 12+:  Curator network + multi-city = sustainable moat
```

## Critical: Event Freshness

Events must be refreshed daily. Stale events = broken trust.

Automated via `@nestjs/schedule` cron (daily 02:00 UTC = 06:00 Tbilisi). Manual: `POST /v1/admin/ingestion/events/run`.

| Source | Refresh | SerpApi cost | Notes |
|---|---|---|---|
| opera.ge | 1x/day | 0 | Free HTML parser |
| google_events | 1x/day | 3 calls/day | 90/month ≈ free tier limit (100/mo) |
| yolo.ge | 1x/day | 0 | Free AJAX endpoint |

**SerpApi quota**: 100 searches/month (free tier), resets 1st of each month. Cached (identical) queries = free, don't count. Our 1 run = 3 searches. Daily refresh = 90/month. Fits in free tier for 1 city. No cost. 2+ cities = $50/mo plan (5,000 searches).

**Automated**: `@nestjs/schedule` cron runs daily at 06:00 Tbilisi (02:00 UTC). Marks past events, refreshes all sources. Manual trigger: `POST /v1/admin/ingestion/events/run`.

## Open UX Questions

- **Opening hours unknown (57% venues)**: currently no label shown. Closed venues hard-filtered. Need to decide: show "Hours unknown"? Or improve coverage (more Google enrichment)? For now — silence = no data, don't lie to user.

## Cost Tracking

| Month | Google Places | SerpApi | Total | Budget |
|---|---|---|---|---|
| July 2026 | $74 | $0 (free tier) | $74 | $100 |

Google Places breakdown: Pro (free) + Enterprise (~$35) + Atmosphere (~$39). One-time enrichment, not recurring.

## Deploy

- Frontend: push to `main` → Cloudflare Pages → `lazy-day-app.pages.dev`
- Backend: TBD (Hetzner VPS + Docker Compose)
