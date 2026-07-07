# LazyDay

Контекстный подбор досуга в Тбилиси. Angular PWA + NestJS API в Nx монорепо.

## Quick Start

```bash
npm install
cd docker && docker compose up -d && cd ..   # postgres + redis
npx tsx tools/run-migrations.ts               # DB schema
npx nx run-many -t serve -p lazy-day api      # frontend :4200 + api :3000
curl -X POST http://localhost:3000/v1/admin/ingestion/osm  # OSM import
```

## Projects

| Project | Path | Stack | Serve |
|---|---|---|---|
| lazy-day | `src/` (root) | Angular 21, PrimeNG, signals | `npx nx serve lazy-day` → :4200 |
| api | `apps/api/` | NestJS 11, TypeORM, PostgreSQL+PostGIS | `npx nx serve api` → :3000/v1 |
| shared-models | `libs/shared-models/` | Pure TypeScript types | (build only) |

## API

Prefix: `/v1`. Endpoints: health, recommendations (PostGIS + scoring), cards/:type/:id, interactions, meta/categories, admin/ingestion/osm.
Full docs: `docs/api-endpoints.md`. Proxy: `proxy.conf.json` routes `/v1` → `:3000` in dev.

## Database

PostgreSQL 16 + PostGIS. Tables: venues, places (with `status` column), events, source_items, source_refs, interactions, recommendation_logs, dedup_candidates.
Migrations: `apps/api/src/app/database/migrations/` (SQL, 001-010). Runner: `npx tsx tools/run-migrations.ts`

## Key Patterns

- **Shared models**: `@lazy-day/shared-models` — types/enums/DTO shared between frontend and backend
- **DI override**: `ApiService` (abstract) → `MockApiService` | `HttpApiService` via `USE_REAL_API` flag in `providers.ts`
- **OSM import**: Overpass API → venues + places. Category mapping in `osm-category-map.ts`. Detects closed venues via `disused:*` tags.
- **Google enrichment**: `POST /v1/admin/ingestion/google-enrich?limit=N`. Delta-aware — only processes venues without `google_place_id`. Matches by Text Search + 200m radius. Requires `GOOGLE_PLACES_API_KEY` env var.
- **Scoring**: `0.45×interest + 0.25×distance + 0.15×time + 0.10×quality + 0.05×source`. Dynamic primary/secondary tag classification. No serendipity pool. Adaptive radius expansion.
- **Dynamic categories**: venue tags split into primary (matching user interests) and secondary (other traits) at query time. Same venue classified differently per request.
- **Interest synonyms**: `INTEREST_SYNONYMS` map expands user-facing interest names to DB tag vocabulary.
- **Signal stores**: ProfileStore, SavedStore — Angular signals + localStorage persistence
- **Design tokens**: CSS custom properties `--ld-*`, dark mode via class + prefers-color-scheme

## Docs

- `docs/commands.md` — all dev commands
- `docs/project-structure.md` — full file tree
- `docs/api-endpoints.md` — API reference
- `docs/database.md` — tables, migrations, useful queries
- `docs/scoring.md` — scoring formula, dynamic tags, interest matching, adaptive fill
- `docs/data-quality.md` — OSM import pipeline, tag vocabulary, venue status
- `docs/research/categorization-and-ranking-strategy.md` — deep research on categorization, serendipity, cold start

## Resolved Issues

- **Interest vocabulary mismatch** (2026-07-06): `INTEREST_SYNONYMS` map bridges user interests to DB tags.
- **Serendipity noise** (2026-07-06 → 07): removed hardcoded serendipity pool, replaced with hard filter + adaptive radius. Research: random irrelevant venues ≠ discovery.
- **Closed venues** (2026-07-06): migration `010_add_place_status.sql`, `detectStatus()` in OSM import, `WHERE p.status = 'active'` filter.
- **Gym false matches** (2026-07-06): removed `wellness` from spa/bath synonyms — too broad, matched gyms.
- **Dynamic categories** (2026-07-07): primary/secondary tag classification per request. Interest weight raised 0.35→0.45.
- **Company context** (2026-07-07): tag boost/penalty matrix per company type. Family penalizes nightlife, couple boosts viewpoints, friends boosts bars.
- **Pet-friendly** (2026-07-07): `hasPet` flag boosts outdoor, penalizes indoor venues. Toggle in context bar.
- **Opening hours** (2026-07-07): OSM `opening_hours` parser. Closed venues get `timeFit=0.0` → demoted/filtered. Open venues get "Сейчас открыто" + `openStatus` in response.
- **Interest weight semantics** (2026-07-07): weight >= 0.7 = strict (hard filter), 0.3-0.6 = soft (scoring boost only), < 0.3 = ignored.
- **Google Places Pro enrichment** (2026-07-07): 1,753/2,976 venues matched. google_types (multi-category), businessStatus, accessibilityOptions stored. 1,223 unmatched = small OSM-only points without Google presence. Delta-aware: re-run only processes new venues.
- **Google Places Enterprise enrichment** (2026-07-07): 1,753 venues enriched. Opening hours: 1,497 Google structured + 264 OSM raw = 1,761 total (59%). Ratings: 1,722 venues (avg 4.42). `checkOpenStatus()` auto-detects format.
- **Google Places Atmosphere enrichment** (2026-07-07): 1,058 venues enriched. allowsDogs (523, 294 true), goodForChildren (1,208, 1,110 true), outdoorSeating (548), liveMusic (226). Pet/family scoring now uses real facts with tag proxy fallback.

## TODO / Known Issues (prioritized)

### 1. Localization (user-facing)
- Venue names: OSM has `name:ka`, `name:en`, Google has `displayName` — currently only `name` (usually Georgian) is shown.
- Explanations hardcoded in Russian ("Сейчас открыто", "Тебе нравится"). Need i18n for en/ka.
- Impact: high for non-Russian users. Effort: medium.

### 2. Pet modifier: use outdoorSeating fact
- `outdoorSeating` data available (548 venues). Restaurants currently neutral for pets.
- Could boost restaurants with `outdoorSeating=true` for pet owners.
- Impact: small. Effort: small (few lines in scoreCandidate).

### 3. Events data source
- Zero events in DB (Overpass doesn't have events). Need external source: Facebook Events, Eventbrite, local aggregators.
- Event scoring already works (timeFit, starts_in explanation) — just needs data.
- Impact: high for product value. Effort: medium-high (new ingestion pipeline).

### 4. Behavioral learning (post-MVP)
- Track click/save/hide patterns → re-rank within interest-filtered set.
- Three-phase plan: cold start → learning → mature.
- Impact: high long-term. Effort: high (interactions pipeline, user profiles, A/B).
- See `docs/research/categorization-and-ranking-strategy.md` §5.

## Deploy

- Frontend: push to `main` → Cloudflare Pages auto-deploy → `lazy-day-app.pages.dev`
- Backend: TBD (Hetzner VPS + Docker Compose)
