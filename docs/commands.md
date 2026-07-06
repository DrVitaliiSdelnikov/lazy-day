# Команды

## Первый запуск

```bash
# 1. Зависимости
npm install

# 2. Поднять PostgreSQL + Redis (Docker Desktop должен быть запущен)
cd docker && docker compose up -d && cd ..

# 3. Прогнать миграции
npm install -D tsx    # если ещё нет
npx tsx tools/run-migrations.ts

# 4. Импорт данных из OSM (Тбилиси)
curl -X POST http://localhost:3000/v1/admin/ingestion/osm

# 5. Проверить
docker compose -f docker/docker-compose.yml ps   # postgres + redis = running
```

## Ежедневная разработка

### Frontend (Angular PWA)

```bash
npx nx serve lazy-day           # http://localhost:4200 (proxy /v1 → :3000)
npx nx build lazy-day            # production build → dist/lazy-day/
npx nx build lazy-day --configuration=development
npx nx test lazy-day             # unit tests
npx nx lint lazy-day             # eslint
```

### Backend (NestJS API)

```bash
npx nx serve api                 # http://localhost:3000/v1
npx nx build api                 # production build → dist/apps/api/
npx nx lint api                  # eslint
```

### Shared Models (libs/shared-models)

```bash
npx nx build shared-models       # TypeScript compile
npx nx test shared-models        # unit tests
```

### Оба проекта вместе

```bash
npx nx run-many -t serve -p lazy-day api    # frontend + backend параллельно
npx nx run-many -t build                     # build all
npx nx run-many -t lint                      # lint all
npx nx run-many -t test                      # test all
npx nx affected -t build                     # build только изменённое
npx nx affected -t test                      # test только изменённое
```

## Docker

```bash
cd docker
docker compose up -d             # запустить postgres + redis
docker compose down              # остановить
docker compose logs postgres     # логи postgres
docker compose logs redis        # логи redis
docker compose ps                # статус
```

### Подключиться к БД

```bash
docker compose -f docker/docker-compose.yml exec postgres psql -U lazyday -d lazyday
```

## Миграции

```bash
npx tsx tools/run-migrations.ts                          # прогнать все новые
DATABASE_URL=postgresql://... npx tsx tools/run-migrations.ts  # на другую БД
```

SQL файлы лежат в `apps/api/src/app/database/migrations/`. Нумерация: `001_`, `002_`, ...

## Импорт данных

```bash
# OSM import (Тбилиси — рестораны, кафе, парки, музеи, бани...)
# Требует: запущенный API + postgres с миграциями
curl -X POST http://localhost:3000/v1/admin/ingestion/osm
```

## Nx утилиты

```bash
npx nx graph                     # визуальный граф зависимостей
npx nx show project lazy-day     # все targets фронтенда
npx nx show project api          # все targets бэкенда
npx nx list                      # установленные плагины
npx nx reset                     # очистить кеш Nx
```

## Deploy

### Frontend (Cloudflare Pages)

Push в `main` → автодеплой на `lazy-day-app.pages.dev`.

```bash
npx nx build lazy-day --configuration=production   # dist/lazy-day/browser/
```

### Backend (будущее — Hetzner VPS)

```bash
npx nx build api --configuration=production        # dist/apps/api/
```

## E2E

```bash
npx nx e2e e2e                   # Playwright (frontend)
```
