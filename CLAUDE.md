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

PostgreSQL 16 + PostGIS. Tables: venues, places, events, source_items, source_refs, interactions, recommendation_logs, dedup_candidates.
Migrations: `apps/api/src/app/database/migrations/` (SQL). Runner: `npx tsx tools/run-migrations.ts`

## Key Patterns

- **Shared models**: `@lazy-day/shared-models` — types/enums/DTO shared between frontend and backend
- **DI override**: `ApiService` (abstract) → `MockApiService` | `HttpApiService` via `USE_REAL_API` flag in `providers.ts`
- **OSM import**: Overpass API → venues + places. Category mapping in `osm-category-map.ts`
- **Scoring**: `0.35×interest + 0.25×distance + 0.20×time + 0.10×quality + 0.05×source`, diversity reranker, explanations
- **Signal stores**: ProfileStore, SavedStore — Angular signals + localStorage persistence
- **Design tokens**: CSS custom properties `--ld-*`, dark mode via class + prefers-color-scheme

## Docs

- `docs/commands.md` — all dev commands
- `docs/project-structure.md` — full file tree
- `docs/api-endpoints.md` — API reference
- `docs/database.md` — tables, migrations, useful queries

## Deploy

- Frontend: push to `main` → Cloudflare Pages auto-deploy → `lazy-day-app.pages.dev`
- Backend: TBD (Hetzner VPS + Docker Compose)
