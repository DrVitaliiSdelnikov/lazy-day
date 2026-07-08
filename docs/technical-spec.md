# LazyDay Technical Specification

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (PWA)                         │
│  Angular 21 + PrimeNG + Signals + Service Worker         │
│  Port :4200 (dev) / Cloudflare Pages (prod)              │
│                                                          │
│  ProfileStore ──→ API calls ──→ Card rendering           │
│  (localStorage)    (HttpClient)   (result-card, detail)  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP /v1/* (proxy in dev)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend (API)                          │
│  NestJS 11 + TypeORM + PostGIS                           │
│  Port :3000 / Hetzner VPS (prod)                         │
│                                                          │
│  Recommendation ── Scoring Engine ── Opening Hours       │
│  Controller         (5-dim composite)  (dual parser)     │
│                                                          │
│  Ingestion ─── OSM Import ─── Google Enrichment          │
│  Controller    (Overpass)     (3-phase: Pro/Ent/Atmo)    │
│                │                                         │
│                └── Event Adapters (opera.ge, SerpApi,    │
│                    YOLO.ge) + Daily Cron                 │
└────────────────────────┬────────────────────────────────┘
                         │ SQL (TypeORM)
                         ▼
┌─────────────────────────────────────────────────────────┐
│               PostgreSQL 16 + PostGIS                    │
│  Docker: postgis/postgis:16-3.4 on port :5434            │
│                                                          │
│  venues ──→ places ──→ events                            │
│  (3,166)   (3,166)    (57)                               │
│  source_items, source_refs, interactions,                │
│  recommendation_logs, dedup_candidates, event_sources    │
└─────────────────────────────────────────────────────────┘
```

## Frontend

### Stack
- **Angular 21** — standalone components, signals, new control flow (`@if`, `@for`)
- **PrimeNG 21** — UI components (Tag, Slider, Button, Skeleton, Drawer)
- **@ngrx/signals** — not used yet (ProfileStore uses raw Angular signals)
- **@ngx-translate** — i18n (ru/en/ka)
- **Nx 23** — monorepo tooling, build, serve

### Project Structure

```
src/
  app/
    core/
      models/          → re-exports from @lazy-day/shared-models
      services/
        api.service.ts          → abstract API (DI switchable)
        http-api.service.ts     → real HTTP calls to /v1
        mock-api.service.ts     → mock data for offline dev
        geolocation.service.ts  → GPS + fallback + DMS parser
      stores/
        profile.store.ts  → interests, company, pet, locale (localStorage)
        saved.store.ts    → saved places/events (localStorage)
      providers.ts        → USE_REAL_API flag switches mock/http
    features/
      discover/
        discover.component.ts        → main feed page
        context-bar/                 → location, company, interests, time panels
        result-card/                 → place/event card with tags, rating, status
        filter-sheet/                → advanced filters drawer
        onboarding/                  → first-time setup (interests, company, pet, location)
      detail/
        detail.component.ts          → place/event detail page
      saved/
        saved.component.ts           → saved items list
      settings/
        settings.component.ts        → profile settings
    app.routes.ts                    → /discover, /detail/:type/:id, /saved, /settings
    app.config.ts                    → providers, SW, i18n
```

### Data Flow (Discover Page)

```
1. User opens /discover
2. ProfileStore provides: interests, company, hasPet, locale
3. GeolocationService provides: lat, lng (GPS or manual coords)
4. ContextBar provides: radiusKm, timeWindow (now/evening/tomorrow/weekend)
5. Mood presets override: interests + company + radius

6. DiscoverComponent.loadFeed() →
   api.discover({ lat, lng, radiusM, timeWindow, profile, hiddenIds, locale })

7. API returns: { sessionId, cards: RecommendationCard[], hasMore }

8. Client-side filtering:
   - activeTypeFilter: all / place / event
   - visibleCount: 15 → +15 on "Show more"

9. ResultCardComponent renders each card:
   - Place: title, category, distance, walk time, rating, openStatus, tags, explanations
   - Event: purple stripe + icon, venue, startsAt, ticket link
```

### Key Signals

| Signal | Store | Persisted | Purpose |
|---|---|---|---|
| `interests` | ProfileStore | localStorage | Map of interest→weight |
| `company` | ProfileStore | localStorage | solo/couple/family/friends |
| `hasPet` | ProfileStore | localStorage | boolean |
| `locale` | ProfileStore | localStorage | ru/en/ka |
| `position` | GeolocationService | — | { lat, lng, source } |
| `allCards` | DiscoverComponent | — | API response |
| `visibleCount` | DiscoverComponent | — | Pagination counter |
| `activeTypeFilter` | DiscoverComponent | — | all/place/event |

### Build & Deploy

```bash
npx nx build lazy-day                    # → dist/lazy-day (static files)
# outputMode: "static" in project.json
# Service worker: ngsw-config.json
# Deploy: dist/lazy-day/browser → Cloudflare Pages
```

Production build: ~467 KB initial (111 KB transfer). Lazy chunks for each route.

## Backend

### Stack
- **NestJS 11** — modules, controllers, services, decorators
- **TypeORM 1.x** — entities, repositories, raw SQL for PostGIS queries
- **PostgreSQL 16 + PostGIS** — spatial queries (ST_Distance, ST_DWithin)
- **@nestjs/schedule** — cron jobs (daily event refresh)
- **Webpack** — bundler for NestJS (Nx default)

### Module Structure

```
apps/api/src/app/
  app.module.ts           → root: TypeORM + ScheduleModule + all feature modules

  health/                 → GET /v1/health

  recommendation/
    recommendation.controller.ts  → POST /v1/recommendations, GET /v1/recommendations/:id/more
    recommendation.service.ts     → scoring engine (500+ lines)
    opening-hours.ts              → dual parser (OSM raw + Google periods)
    dto/discover-request.dto.ts   → validated input

  cards/
    cards.controller.ts   → GET /v1/cards/:type/:id
    cards.service.ts      → place/event detail with venue join

  feedback/
    feedback.controller.ts → POST /v1/interactions
    feedback.service.ts    → save interaction to DB

  meta/
    meta.controller.ts    → GET /v1/meta/categories (11 categories, localized)

  ingestion/
    ingestion.controller.ts         → admin endpoints for OSM, Google, events
    ingestion.module.ts             → providers: OSM, Google, Events, Cron
    osm-import.service.ts           → Overpass API → venues + places
    osm-category-map.ts             → OSM tags → LazyDay categories (25 rules)
    google-enrichment.service.ts    → 3-phase: Pro, Enterprise, Atmosphere
    event-ingestion.service.ts      → adapter pattern, venue matching, dedup
    event-cron.service.ts           → daily refresh at 06:00 Tbilisi
    event-sources/
      types.ts                      → NormalizedEvent, EventSourceAdapter interfaces
      opera-ge.adapter.ts           → HTML parser for opera.ge playbill
      google-events.adapter.ts      → SerpApi Google Events (any city)
      yolo-ge.adapter.ts            → YOLO.ge AJAX endpoint parser

  database/
    entities/                       → 8 TypeORM entities
      venue.entity.ts               → name, lat, lng, googlePlaceId
      place.entity.ts               → category, tags, attributes, googleTypes, rating, status
      event.entity.ts               → title, startsAt, endsAt, category, tags, source
      interaction.entity.ts
      source-item.entity.ts
      source-ref.entity.ts
      recommendation-log.entity.ts
      dedup-candidate.entity.ts
    migrations/                     → 12 SQL files (001-012)
```

### Recommendation Pipeline (request → response)

```
1. INPUT: { lat, lng, radiusM, timeWindow, profile: { interests, company, hasPet }, locale }

2. EXPAND INTERESTS
   buildExpandedWeights(interests) → Map<tag, weight>
   "nature" → { outdoor:1, park:1, garden:1, viewpoint:1 }
   Weights < 0.3 = ignored

3. FETCH CANDIDATES (PostGIS)
   fetchPlaces(lat, lng, radiusM)  → SQL: ST_DWithin + status='active' + LIMIT dynamic
   fetchEvents(lat, lng, radiusM, timeWindow) → SQL: starts_at BETWEEN + status='scheduled'
   Parallel execution

4. HARD FILTERS
   - hiddenIds excluded
   - budgetMax exceeded → excluded

5. SCORE EACH CANDIDATE (scoreCandidate)
   For each candidate:
   a. Classify tags → primaryTags (match interests) / secondaryTags (other)
   b. interestScore = avg(top 2 matching weights), 0.0 if no match
   c. Company modifier: family→penalize nightlife, couple→boost viewpoints, etc.
   d. Pet modifier: allowsDogs fact → outdoorSeating fallback → tag proxy
   e. Final: 0.45×interest + 0.25×distance + 0.15×time + 0.10×quality + 0.05×source

6. INTEREST HARD FILTER
   - Strict interests (≥0.7): must match at least one strict tag
   - Soft only (<0.7): must match any tag
   - No interests: show all

7. AVAILABILITY FILTER
   - checkOpenStatus(opening_hours, timeMid)
   - 'closed' → EXCLUDED
   - 'open' or 'unknown' → kept

8. ADAPTIVE RADIUS
   If <5 relevant results → expand radius ×1.5, retry (up to 2x)

9. SORT + DIVERSITY
   Sort by score desc
   Diversity reranker: max 2 consecutive same category, chain cap

10. BUILD RESPONSE
    Top 60 candidates → card objects with:
    - Localized title (en/ka/ru by locale)
    - Localized explanations (8 types, 3 per card max)
    - openStatus label
    - primaryTags, secondaryTags
    - Google rating preferred over OSM rating

11. OUTPUT: { sessionId, cards[], hasMore }
```

### Database Schema (key tables)

```sql
venues (3,166 rows)
  id UUID PK, name TEXT, name_en, name_ka, lat FLOAT, lng FLOAT,
  address, city, website, phone, google_place_id TEXT

places (3,166 rows, 1:1 with venues)
  id UUID PK, venue_id FK, category TEXT, tags TEXT[],
  opening_hours JSONB,    -- OSM { raw: "Mo-Su 10:00-22:00" } or Google { periods: [...] }
  rating NUMERIC, rating_count INT,
  google_rating NUMERIC, google_rating_count INT,
  google_types TEXT[],    -- ["restaurant", "food", "point_of_interest"]
  attributes JSONB,       -- { allowsDogs: true, goodForChildren: true, outdoorSeating: false }
  status VARCHAR,         -- 'active' | 'closed' | 'permanently_closed'
  quality_score NUMERIC, indoor BOOLEAN, price_level SMALLINT

events (57 rows)
  id UUID PK, venue_id FK (nullable), title TEXT, title_en, title_ka,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, timezone TEXT,
  category TEXT, tags TEXT[], price_min NUMERIC, price_max NUMERIC,
  ticket_url TEXT, poster_url TEXT,
  source TEXT, source_event_id TEXT,  -- dedup key
  status ENUM (scheduled/postponed/cancelled/past)

event_sources (5 rows)
  id SERIAL PK, name TEXT UNIQUE, url, adapter_type, last_fetched_at,
  last_event_count, enabled BOOLEAN, config JSONB
```

### External APIs

| API | Purpose | Auth | Cost |
|---|---|---|---|
| Overpass (OSM) | Venue import | None | Free (public, respect rate limits) |
| Google Places (New) | Venue enrichment | API key header | $74 one-time (Pro+Enterprise+Atmosphere) |
| SerpApi (Google Events) | Event discovery | API key param | Free (100/mo), $50/mo for 5K |
| opera.ge | Opera/ballet events | None | Free (HTML parsing) |
| yolo.ge | Local events | None | Free (AJAX endpoint) |

### Cron Jobs

| Job | Schedule | What it does |
|---|---|---|
| `EventCronService.dailyEventRefresh` | 02:00 UTC (06:00 Tbilisi) | Mark past events, refresh all enabled sources |

### Environment Variables

```env
DATABASE_URL=postgresql://lazyday:lazyday_dev@localhost:5434/lazyday
GOOGLE_PLACES_API_KEY=AIza...
SERPAPI_KEY=0c69...
NODE_ENV=development
```

## Shared Models

Library `@lazy-day/shared-models` (`libs/shared-models/src/`):
- Types: `RecommendationCard`, `DiscoverRequest`, `DiscoverResponse`, `CategoryNode`
- Enums: `CardType` (place/event), `CompanyType`, `Locale`, `InteractionAction`
- Used by both frontend and backend

Build: `npx nx build shared-models` → `dist/libs/shared-models`

## Frontend ↔ Backend Communication

```
Frontend                              Backend
────────                              ───────
api.service.ts                        recommendation.controller.ts
  discover(req) ──── POST /v1/recommendations ───→ discover(dto)
                                                    ↓
  ← { sessionId, cards[], hasMore } ←─────────── scored + filtered + localized

  getCard(type, id) ── GET /v1/cards/:type/:id ──→ getCard(type, id)
                                                    ↓
  ← RecommendationCard ←──────────────────────── place/event + venue join

  interact(data) ──── POST /v1/interactions ─────→ create(interaction)
  ← { ok: true }

  getCategories() ── GET /v1/meta/categories ────→ getCategories(locale)
  ← CategoryNode[]                                  ↓
                                                  11 categories, localized
```

### Proxy (dev)

`proxy.conf.json`: `/v1` → `http://localhost:3000`

Frontend runs on :4200, API on :3000. Angular dev server proxies API calls transparently.

### Auth

None currently. Device identified by `X-Device-Id` header (UUID from ProfileStore). No user accounts, no login.

## Docker

```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: postgis/postgis:16-3.4
    ports: ["127.0.0.1:5434:5432"]
    environment:
      POSTGRES_DB: lazyday
      POSTGRES_USER: lazyday
      POSTGRES_PASSWORD: lazyday_dev
  redis:
    image: redis:7-alpine
    ports: ["127.0.0.1:6379:6379"]
```

Redis provisioned but not used yet (planned for session cache / pagination).
