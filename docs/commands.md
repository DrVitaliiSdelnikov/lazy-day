# Команды

## Первый запуск (с нуля)

```bash
npm install                                          # зависимости
cd docker && docker compose up -d && cd ..           # postgres:5434 + redis:6379
npx tsx tools/run-migrations.ts                      # 9 миграций (PostGIS, таблицы, индексы)
npx nx serve api                                     # API на :3000/v1
curl -X POST http://localhost:3000/v1/admin/ingestion/osm   # ~2976 мест Тбилиси из OSM
npx nx serve lazy-day                                # фронт на :4200 (proxy /v1 → :3000)
```

## Ежедневная разработка

```bash
# Поднять инфру (если контейнеры остановлены)
cd docker && docker compose up -d && cd ..

# Запустить оба проекта
npx nx run-many -t serve -p lazy-day api

# Или по отдельности
npx nx serve api                   # http://localhost:3000/v1  (hot reload)
npx nx serve lazy-day              # http://localhost:4200     (proxy /v1 → :3000)
```

## Сборка

```bash
npx nx build lazy-day              # production → dist/lazy-day/browser/
npx nx build api                   # production → dist/apps/api/
npx nx run-many -t build           # всё
npx nx affected -t build           # только изменённое
```

## Тесты и линтинг

```bash
npx nx test lazy-day               # vitest (frontend)
npx nx test shared-models          # jest (shared lib)
npx nx lint lazy-day               # eslint
npx nx lint api                    # eslint
npx nx run-many -t lint            # всё
npx nx e2e e2e                     # Playwright
```

## Docker (postgres + redis)

```bash
cd docker
docker compose up -d               # старт
docker compose down                # стоп
docker compose ps                  # статус
docker compose logs postgres       # логи
docker compose logs redis
```

PostgreSQL доступен на `localhost:5434` (не 5432 — тот занят локальным PG).

### Подключиться к БД

```bash
docker compose -f docker/docker-compose.yml exec postgres psql -U lazyday -d lazyday
```

## Миграции

```bash
npx tsx tools/run-migrations.ts    # прогнать все новые
```

SQL файлы: `apps/api/src/app/database/migrations/001_*.sql` — `009_*.sql`
Трекинг: таблица `_migrations` в БД.

## Импорт данных

```bash
# OSM (Overpass API → venues + places, ~3000 POI Тбилиси)
# Требует: запущенный API + postgres
curl -X POST http://localhost:3000/v1/admin/ingestion/osm
```

## API endpoints (curl)

```bash
# Health
curl http://localhost:3000/v1/health

# Рекомендации (центр Тбилиси, радиус 3км, интересы: кафе + музеи)
curl -X POST http://localhost:3000/v1/recommendations \
  -H 'Content-Type: application/json' \
  -d '{"lat":41.7151,"lng":44.8271,"radiusM":3000,"timeWindow":{"from":"2026-07-06T10:00:00","to":"2026-07-06T23:00:00"},"profile":{"interests":{"cafe":0.9,"museum":0.7}},"locale":"ru"}'

# Карточка места
curl http://localhost:3000/v1/cards/place/<uuid>

# Категории
curl http://localhost:3000/v1/meta/categories?locale=ru
```

## Nx утилиты

```bash
npx nx graph                       # визуальный граф зависимостей
npx nx show project lazy-day       # все targets
npx nx show project api
npx nx list                        # плагины
npx nx reset                       # очистить кеш
```

## Deploy

**Frontend:** push в `main` → Cloudflare Pages → `lazy-day-app.pages.dev`
**Backend:** TBD (Hetzner VPS + Docker Compose)

## Переключение mock ↔ real API

`src/app/core/providers.ts` → `USE_REAL_API = true | false`

При `false` фронт работает без бэкенда (mock JSON данные).
