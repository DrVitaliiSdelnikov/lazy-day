# Структура проекта

```
lazy-day/
├── src/                          # Angular PWA (frontend)
│   ├── app/
│   │   ├── core/
│   │   │   ├── layout/           # AppShellComponent (3 tabs)
│   │   │   ├── models/           # re-export из @lazy-day/shared-models
│   │   │   ├── providers.ts      # DI: ApiService → MockApiService
│   │   │   ├── services/
│   │   │   │   ├── api.service.ts          # abstract contract
│   │   │   │   ├── mock-api.service.ts     # mock: haversine + scoring
│   │   │   │   └── geolocation.service.ts  # GPS / fallback
│   │   │   └── stores/
│   │   │       ├── profile.store.ts        # interests, company, budget, theme
│   │   │       └── saved.store.ts          # card snapshots
│   │   └── features/
│   │       ├── discover/         # лента + context bar + filters + onboarding
│   │       ├── detail/           # карточка места/события
│   │       ├── saved/            # избранное
│   │       └── settings/         # язык, тема, профиль
│   ├── styles.scss               # design tokens, dark mode
│   └── index.html
│
├── apps/
│   ├── api/                      # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts           # bootstrap, /v1 prefix, ValidationPipe
│   │   │   └── app/
│   │   │       ├── app.module.ts           # root module, TypeORM config
│   │   │       ├── recommendation/         # POST /v1/recommendations (PostGIS + scoring)
│   │   │       ├── cards/                  # GET /v1/cards/:type/:id
│   │   │       ├── feedback/               # POST /v1/interactions
│   │   │       ├── meta/                   # GET /v1/meta/categories
│   │   │       ├── health/                 # GET /v1/health
│   │   │       ├── ingestion/              # OSM import (POST /v1/admin/ingestion/osm)
│   │   │       └── database/
│   │   │           ├── entities/           # TypeORM entities (8 шт)
│   │   │           └── migrations/         # SQL миграции (9 шт)
│   │   ├── tsconfig.app.json
│   │   └── webpack.config.js
│   └── api-e2e/                  # e2e тесты для API
│
├── libs/
│   └── shared-models/            # типы, enums, DTO — общие для web + api
│       └── src/lib/
│           ├── types.ts          # RecommendationCard, DiscoverRequest/Response
│           ├── enums.ts          # CardType, CompanyType, Locale, etc.
│           └── dto.ts            # DiscoverRequestDto, InteractionDto
│
├── docker/
│   ├── docker-compose.yml        # postgres+postgis:16, redis:7-alpine
│   └── .env.example
│
├── tools/
│   ├── run-migrations.ts         # прогон SQL миграций
│   └── generate-icons.mjs
│
├── e2e/                          # Playwright (frontend)
├── public/                       # PWA assets, manifest, icons
├── docs/                         # эта папка
│
├── nx.json                       # Nx workspace config
├── package.json                  # монорепо dependencies
├── tsconfig.json                 # root tsconfig + path aliases
└── project.json                  # Angular app targets
```

## Зависимости между проектами

```
lazy-day (Angular PWA)
    └── @lazy-day/shared-models

api (NestJS)
    └── @lazy-day/shared-models
```

`shared-models` — чистые TypeScript типы без рантайм-зависимостей. Фронт и бэк импортируют через `@lazy-day/shared-models`.
