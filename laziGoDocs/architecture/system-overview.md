# System Overview

## Stack

| Layer | Tech | Location |
|---|---|---|
| Frontend | Angular 21, PrimeNG, Signals | `src/` |
| API | NestJS 11, TypeORM | `apps/api/` |
| Database | PostgreSQL + PostGIS | Railway / Docker |
| Shared types | TypeScript | `libs/shared-models/` |
| Build | Nx monorepo | `nx.json` |

## Deploy

| Service | Provider | URL |
|---|---|---|
| Frontend | Cloudflare Pages | `lazigo.app` |
| API | Railway (EU West) | `api.lazigo.app` |
| DB | Railway PostgreSQL | internal |

## Module Map

```
AppModule
  ├── HealthModule          — /v1/health, migrations
  ├── AuthModule            — /v1/auth (anon identity)
  ├── RecommendationModule  — /v1/recommendations (discover, explain, taste-profile)
  │     ├── RecommendationService   — scoring pipeline
  │     ├── TasteProfileService     — faceted personalization
  │     └── ImpressionService       — freshness & impression tracking
  ├── FeedbackModule        — /v1/interactions (save, hide, batch events)
  │     └── FeedbackService         — wires interactions → taste profile
  ├── CardsModule           — /v1/cards/:type/:id (detail card)
  ├── IngestionModule       — /v1/admin/ingestion (OSM, Google, events, Gemini)
  │     ├── OsmIngestionService
  │     ├── GoogleEnrichmentService
  │     ├── GeminiEnrichmentService
  │     ├── FacetMapperService
  │     └── EventIngestionService (adapters: opera.ge, google_events, yolo.ge, tkt.ge, biletebi.ge)
  └── MetaModule            — /v1/meta/categories
```

## Frontend Architecture

```
AppShellComponent (nav, dev-strip)
  ├── AdLandingComponent        — / (entry point)
  ├── DiscoverComponent         — /discover (main feed)
  │     ├── ContextBar          — presets, filters
  │     ├── ResultCard          — venue/event cards
  │     └── FilterSheet         — bottom sheet filters
  ├── DetailComponent           — /detail/:type/:id
  ├── SavedComponent            — /saved
  ├── SettingsComponent         — /settings (profile, taste, theme)
  ├── PrivacyComponent          — /privacy
  └── RecoLabComponent          — /dev/reco-lab (dev only)
```

## Key Stores

| Store | Persistence | Contents |
|---|---|---|
| ProfileStore | localStorage | interests, company, pet, locale, theme, savedIds, hiddenIds |
| SessionStorage `ld_filters` | sessionStorage | preset, typeFilter, radius, time |
