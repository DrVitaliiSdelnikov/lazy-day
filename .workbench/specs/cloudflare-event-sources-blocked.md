# Cloudflare-blocked Event Sources: tkt.ge + biletebi.ge

## Проблема

Railway API (NestJS, EU West) не может получить события с tkt.ge и biletebi.ge.
Оба сайта за Cloudflare, который блокирует запросы с datacenter IP Railway.

## Диагностика (проведена 2026-07-16)

Тест из Railway Console:
```bash
node -e "fetch('https://gateway.tkt.ge/Shows/List?categoryId=2&api_key=7d8d34d1-e9af-4897-9f0f-5c36c179be77', {
  headers: { Origin: 'https://tkt.ge', Referer: 'https://tkt.ge/' }
}).then(r => { console.log('status:', r.status); return r.text(); })
.then(t => console.log(t.slice(0,200)))"
```

Результат: `status: 403`, body = `<!DOCTYPE html><html><head><title>Just a moment...</title>` — Cloudflare challenge page.

С локального IP (Грузия): `status: 200`, body = `{"shows":[...]}` — 121 событие.

Добавление полных browser headers (User-Agent, Accept, Accept-Language) не помогает — блокировка по IP reputation, не по headers.

## Архитектура текущего ingestion pipeline

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│ @Cron        │────▶│ EventCronService  │────▶│ EventIngestion │
│ 02:00 UTC    │     │ dailyEventRefresh │     │ Service.runAll │
│ (daily)      │     │                   │     │                │
└─────────────┘     │ 1. mark past      │     │ for each       │
                    │ 2. runAll()       │     │ enabled source │
                    │ 3. checkHealth()  │     │ in event_sources│
                    │ 4. gcUsers()      │     │ table:         │
                    └──────────────────┘     │                │
                                             │ adapter.fetch()│
                                             └───────┬───────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    │                │                │
                              ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
                              │ opera.ge   │   │ google_   │   │ yolo.ge   │
                              │ Adapter    │   │ events    │   │ Adapter   │
                              │ HTML parse │   │ SerpApi   │   │ AJAX JSON │
                              │ ✅ works   │   │ ✅ works  │   │ ✅ works  │
                              └───────────┘   └───────────┘   └───────────┘

                              ┌─────────────┐   ┌─────────────┐
                              │ tkt.ge      │   │ biletebi.ge │
                              │ Adapter     │   │ Adapter     │
                              │ REST API    │   │ HTML parse  │
                              │ ❌ CF 403   │   │ ❌ CF 403   │
                              └─────────────┘   └─────────────┘
```

### tkt.ge — REST JSON API

**Источник данных:** `gateway.tkt.ge` — публичный REST API за Cloudflare.

**Как работает:**
```
NestJS (Railway EU West)
  │
  │  globalThis.fetch()
  │  POST: нет, GET запрос
  │  Headers: Origin: https://tkt.ge, Referer: https://tkt.ge/
  ▼
gateway.tkt.ge (Cloudflare)  ──── 403 "Just a moment..." ────▶ BLOCKED
  │
  │  Что ДОЛЖНО произойти (работает с грузинского IP):
  ▼
gateway.tkt.ge/Shows/List?categoryId={N}&api_key={KEY}
  │
  │  Response: { shows: Show[] }
  │
  │  Show fields:
  │    showId, name, description, mobileImage, desktopImage,
  │    fromDate (ISO|null), toDate, minPrice, maxPrice,
  │    isSoldOut, soldType, tags (JSON string), slug,
  │    venues[]: { id, name, eventInfos[]: { eventDate } },
  │    integrationHost
  ▼
TktGeAdapter.parseShows()
  │
  │  Filters: isSoldOut=true, no date, past date, no title
  │  Maps to NormalizedEvent
  │  enrichTags() — keyword bridge to LazyDay interests
  │  posterUrl: https://tkt.ge/api/image/{mobileImage}
  │  ticketUrl: https://tkt.ge/en/event/{slug}
  ▼
NormalizedEvent[] → EventIngestionService.upsertEvent()
  │
  │  Dedup by (source, sourceEventId) = ('tkt.ge', 'tkt-{showId}')
  │  Match venue by name (exact → partial ILIKE)
  ▼
events table (PostgreSQL)
```

**API details:**
- Base URL: `https://gateway.tkt.ge`
- Auth: `api_key=7d8d34d1-e9af-4897-9f0f-5c36c179be77` (public, baked into tkt.ge frontend JS)
- Endpoint: `GET /Shows/List?categoryId={id}&api_key={key}`
- Categories endpoint: `GET /Categories?api_key={key}` (returns all ~50 categories)
- Image CDN: `https://tkt.ge/api/image/{mobileImage}` (mobileImage = UUID.jpeg)
- No pagination needed — all shows per category in one response
- 8 categories configured: 2(music), 5(sports), 16(theater), 17(kids), 18(opera), 71(standup), 73(masterclass), 75(festival)
- Locally returns ~125 upcoming events across all categories

**Error handling:**
- Per-category try/catch — one failing category doesn't block others
- Errors silently caught → `this.logger.warn()`
- Result: `fetched: 0, errors: 0` (errors counted only in upsertEvent, not in adapter)
- 8 sequential requests, no rate limiting needed

**Tags field quirk:** `show.tags` is a JSON-serialized string `"[\"WORD1\",\"WORD2\"]"`, not a native array. Contains title words + city names (Tbilisi, Batumi). Used only for city detection, not category mapping.

### biletebi.ge — HTML scraping

**Источник данных:** `biletebi.ge` — Next.js App Router с SSR. Рендерит полный HTML для Googlebot.

**Как работает:**
```
NestJS (Railway EU West)
  │
  │  globalThis.fetch()
  │  Headers: User-Agent: Googlebot/2.1
  ▼
biletebi.ge/en/{category} (Cloudflare)  ──── 403/connection reset ────▶ BLOCKED
  │
  │  Что ДОЛЖНО произойти (работает с грузинского IP):
  ▼
biletebi.ge/en/concerts (или /en/theatres)
  │
  │  Response: Full HTML (Next.js SSR)
  │  Event data embedded in data-testid attributes:
  │    data-testid="event_card_title_{type}_{slug}"     → title
  │    data-testid="event_card_date_{type}_{slug}"      → "Wed, 15 Jul, 22:00"
  │    data-testid="event_card_location_{type}_{slug}"  → venue name
  │    data-testid="event_card_price_{type}_{slug}"     → "20 ₾"
  │    alt="event  - {title}" src="..."                 → poster CDN URL
  ▼
BiletebiGeAdapter.parseCategory()
  │
  │  Regex extraction from HTML (no DOM parser needed)
  │  Date parse: "Wed, 15 Jul, 22:00" → Date (year inferred)
  │  Filters: no date, past date, no title
  │  enrichTags() — category + title keyword bridge
  │  ticketUrl: https://biletebi.ge/en/{category}/{slug}
  │  sourceEventId: biletebi-{category}-{slug}
  ▼
NormalizedEvent[] → EventIngestionService.upsertEvent()
  │
  │  Dedup by (source, sourceEventId)
  │  Match venue by name
  ▼
events table
```

**Scraping details:**
- URLs: `https://biletebi.ge/en/concerts`, `https://biletebi.ge/en/theatres`
- User-Agent: `Googlebot/2.1` — biletebi рендерит полный HTML для ботов
- Only 2 categories (concerts, theatres) — other categories don't show dates in listing
- Date format: `"Wed, 15 Jul, 22:00"` — no year, inferred from context
- Price: regex `>(\d+)\s*[₾₽$€]<`
- Poster: matched by `alt="event  - {title}" src="..."`
- robots.txt: scanning allowed, AI training blocked
- Locally returns ~101 events

**eventType values:** `Event`, `EventWithSitting`, `Stadium`, `Education`

### Shared ingestion pipeline (upsertEvent)

```
NormalizedEvent
  │
  ▼
Check existing: SELECT WHERE source=$1 AND sourceEventId=$2
  │
  ├── EXISTS → compare title/ticketUrl/priceMin
  │   ├── changed → UPDATE, return 'updated'
  │   └── same → touch lastVerifiedAt, return 'skipped'
  │
  └── NEW → matchVenue(venueName) → INSERT
      │
      │  Venue matching:
      │  1. Exact: LOWER(v.name) = LOWER(name)
      │  2. Exact: LOWER(v.nameEn) = LOWER(name)
      │  3. Partial: LOWER(v.name) LIKE LOWER('%{name}%')
      │  4. No match → venueId = null (event без привязки к venue)
      │
      │  Event fields saved:
      │  title, titleEn, startsAt, timezone='Asia/Tbilisi',
      │  category, tags, priceMin, currency, ticketUrl,
      │  posterUrl, source, sourceEventId, venueId,
      │  status='scheduled', qualityScore=0.7
      ▼
return 'inserted'
```

### Database state

```sql
-- event_sources table
SELECT name, enabled, last_fetched_at, last_event_count FROM event_sources;

-- tkt.ge:     enabled=false, last_fetched_at=2026-07-15, last_event_count=0
-- biletebi.ge: enabled=false, last_fetched_at=2026-07-15, last_event_count=0
-- opera.ge:    enabled=true,  last_fetched_at=...,        last_event_count=0
-- google_events: enabled=true, last_fetched_at=...,       last_event_count=0
-- yolo.ge:     enabled=true,  last_fetched_at=...,        last_event_count=20
```

## Почему Cloudflare блокирует

1. **IP reputation**: Railway EU West использует shared datacenter IP пул. Cloudflare знает что это datacenter → высокий bot score.
2. **TLS fingerprint (JA3)**: Node.js имеет специфический TLS fingerprint, отличный от браузеров.
3. **Не помогает**: User-Agent spoofing, Origin/Referer headers, Accept headers.
4. **Помогло бы**: residential IP, или IP из Грузии (где Cloudflare настроен мягче для местного трафика).

## Решение: Push-модель (не прокси)

### Почему НЕ прокси
- **CF Worker отпадает**: Worker к origin идёт через публичный интернет из datacenter IP Cloudflare. Тот же bot score, тот же 403. JA3 у Workers runtime свой, не браузерный.
- **Fly.io/Vercel**: тоже datacenter IP — та же проблема.
- **ScrapingBee $30-50/мес**: абсурд для 10 запросов/день.

### Архитектура: внешний воркер + push endpoint

```
Внешний воркер (cron, вне Railway)
  ├─ fetch tkt.ge       → TktGeAdapter.fetch()     → 125 events
  ├─ fetch biletebi.ge  → BiletebiGeAdapter.fetch() → 101 events
  ├─ нормализация (те же адаптеры, общий код)
  └─ POST /v1/admin/ingestion/events/import
        headers: x-admin-token: $ADMIN_TOKEN
        body: { events: NormalizedEvent[] }
        └─ Railway: только upsertEvent(), никаких внешних запросов
```

**Почему push лучше proxy:**
- Прод не зависит от доступности воркера в рантайме
- Нет таймаутов HTTP цепочки
- Адаптеры переиспользуются as-is
- Воркер можно запустить откуда угодно (GH Actions, локально, Pi)
- **Это же решение для enrichment** — Railway IP bias для Google тоже решается push-воркером

### Порядок проверки (от быстрого к надёжному)

#### 1. GitHub Actions [5 мин тест]
```yaml
# .github/workflows/fetch-events.yml
on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:
jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx tsx tools/fetch-blocked-events.ts
        env:
          ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
          API_URL: https://api.lazigo.app
```
Azure IP с лучшей репутацией чем Railway. Может пройти.
Тест: `workflow_dispatch` → один запрос к tkt.ge → смотрим статус.
- 200 → готово, настраиваем cron
- 403 → следующий вариант

#### 2. Cron на тбилисской машине [30 мин]
- Грузинский резидентный IP — гарантированно работает (уже проверено)
- `npx tsx tools/fetch-blocked-events.ts` по cron
- Машина должна быть включена в 02:00 (или любое удобное время)
- Пропуск одного дня некритичен — события никуда не денутся
- **Достаточно для MVP**

#### 3. Raspberry Pi / VPS в Грузии [позже]
- Pi: $0 если железо есть, always-on
- VPS: ~$5/мес, проверить что IP резидентный (не datacenter)
- Когда надоест включать машину

### Что нужно построить

1. **`POST /v1/admin/ingestion/events/import`** — принимающий endpoint
   - Принимает `{ events: NormalizedEvent[] }`
   - Под AdminGuard (x-admin-token, уже есть)
   - Вызывает тот же `upsertEvent()` из EventIngestionService
   - Updates `event_sources.last_fetched_at` и `last_event_count`

2. **`tools/fetch-blocked-events.ts`** — скрипт-воркер
   - Импортирует TktGeAdapter и BiletebiGeAdapter
   - Вызывает `.fetch()` на каждом
   - POST результат на `$API_URL/v1/admin/ingestion/events/import`
   - Exit code 0/1 для мониторинга

3. **Body limit fix** — `app.use(json({ limit: '5mb' }))` в `main.ts`
   - 226 событий с описаниями + poster URLs > 100KB
   - Тот же 413 что уже словили на enrichment
   - Одна строка, решает обе задачи (events + enrichment sync)

### Единый внешний воркер (архитектурное решение)

Две задачи с одним решением:
- Events: tkt.ge/biletebi.ge заблокированы с Railway IP
- Enrichment: Google Places возвращает неточные результаты с Railway IP

Обе решаются одним `tools/worker/` с двумя jobs:
```
tools/
  fetch-blocked-events.ts    ← events job
  enrich-from-local.ts       ← enrichment sync job (future)
```

Не строить два обходных пути. Строить один.

## Количество запросов

- tkt.ge: 8 GET запросов/день (по одному на категорию)
- biletebi.ge: 2 GET запроса/день (concerts + theatres)
- Итого: **10 запросов/день** — любой free tier покрывает

## Ожидаемый результат после решения

- tkt.ge: ~125 событий (концерты, спорт, театр, дети, опера, стендап, мастерклассы, фестивали)
- biletebi.ge: ~101 событие (концерты, театры)
- Итого +226 событий → общий пул ~300+ событий в Тбилиси
