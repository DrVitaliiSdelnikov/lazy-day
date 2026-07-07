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

## TODO / Known Issues (prioritized)

### 1. Google Places API — Phase 3 Enterprise enrichment
- Pro enrichment done: 1,753/2,976 venues matched (59%), google_types + accessibility attrs stored.
- Next: Enterprise tier (~$40) for `regularOpeningHours` + `rating` on matched venues.
- Then: Atmosphere tier (~$80, optional) for `allowsDogs`, `goodForChildren`, `outdoorSeating`.
- See `docs/research/google-places-api-integration.md`.

### 2. Behavioral learning (post-MVP)
- Track click/save/hide patterns → re-rank within interest-filtered set.
- Three-phase plan: cold start → learning → mature.
- Impact: high long-term. Effort: high (interactions pipeline, user profiles, A/B).
- See `docs/research/categorization-and-ranking-strategy.md` §5.

### 3. Localization
- Venue names: OSM has `name:ka`, `name:en` — currently only `name` (usually Georgian) is shown.
- Explanations, UI labels hardcoded in Russian. Need i18n pipeline for en/ka.

### 4. Events data source
- Zero events in DB (Overpass doesn't have events). Need external source: Facebook Events, Eventbrite, local aggregators.
- Event scoring already works (timeFit, starts_in explanation) — just needs data.

## Deploy

- Frontend: push to `main` → Cloudflare Pages auto-deploy → `lazy-day-app.pages.dev`
- Backend: TBD (Hetzner VPS + Docker Compose)
