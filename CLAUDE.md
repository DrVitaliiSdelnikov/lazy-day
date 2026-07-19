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
| Ratings | 1,755 local / ~1,256 prod (40%) | Google |
| allowsDogs | 607 | Google Atmosphere |
| goodForChildren | 1,292 | Google Atmosphere |
| Events | ~68 (4 opera.ge + 20 Google Events + 24 YOLO.ge + tkt.ge/biletebi.ge disabled) | 5 adapters (3 active) |
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

### MVP — Intelligence + Events + Deploy — COMPLETE
1. ~~Events: SerpApi Google Events~~ — DONE
2. ~~Mood presets~~ — DONE (6 presets)
3. ~~Events: YOLO.ge parser~~ — DONE
4. ~~Event cron~~ — DONE (daily 02:00 UTC)
5. ~~Type filter~~ — DONE
6. ~~Closed venues filter~~ — DONE
7. ~~Location: GPS + coords~~ — DONE
8. ~~Interest categories~~ — DONE (11 intent-based)
9. ~~SEO basics~~ — DONE (robots, sitemap, OG, JSON-LD, hreflang)
10. ~~Domain~~ — DONE (lazigo.app, Cloudflare DNS)
11. ~~Privacy~~ — DONE (privacy.component.ts, consent-banner.component.ts, Consent Mode v2)
12. ~~Interaction schema~~ — DONE (migration 013, interaction_events entity)
13. ~~Analytics~~ — DONE (GA4 G-8RSG5LFWBC + Google Ads AW-18318311908, gtag events)
14. ~~Deploy~~ — DONE (Cloudflare Pages + Railway EU West)
**Full roadmap with decisions: `docs/roadmap.md`**

### Post-MVP — done in 2026-07-16 session
- ~~Events: tkt.ge adapter~~ — DONE (8 categories, 125 events). Disabled: Cloudflare blocks Railway IP.
- ~~Events: biletebi.ge adapter~~ — DONE. Disabled: same Cloudflare issue.
- ~~Landing page~~ — DONE (entry point, company+preset chips, event cards, ProfileStore sync)
- ~~Telegram monitoring~~ — DONE (daily alerts on source failures)
- ~~Google enrichment sync~~ — DONE (~1,256/1,755 venues with ratings on prod)
- ~~locationRestriction fix~~ — DONE (future enrichment works from prod directly)
- ~~Push-model event ingestion~~ — DONE (325 events: tkt.ge 224 + biletebi.ge 101). `tools/fetch-blocked-events.ts` + `events/import` endpoint + GH Actions workflow.
- ~~Body limit fix~~ — DONE (`json({ limit: '5mb' })` in main.ts)

### Post-MVP — done in 2026-07-16 + 2026-07-17 sessions (COMMITTED + DEPLOYED)
- ~~Feed card refactor~~ — 3-slot structure (title, meta, status). Removed: badges, walk_time chip, "тебе нравится" chip, separate rating line.
- ~~Detail card refactor~~ — removed "Почему это вам" block, price dupe, double "на карте", `canonical` leak. Added: info rows, "часы не подтверждены", taxi hidden <500m.
- ~~Place/event stripe~~ — places get `--ld-primary` stripe, events keep `--ld-event` stripe.
- ~~Icons~~ — added `clock-off`, `car` to ld-icon registry.
- ~~"Также: bar" translation~~ — `lAlsoHas` now translates tags (bar→бар, food→еда) via `lTag()`.
- ~~Session filter persistence~~ — preset, typeFilter, radius, time saved to sessionStorage as `ld_filters` object.
- ~~"Реши за меня" pulse~~ — subtle box-shadow pulse animation (3s cycle, 40% opacity, 9px radius).
- ~~tkt.ge ticketUrl fix~~ — `/en/event/{slug}` → `/en/show/{showId}/{slug}` (was 404).
- ~~Event price on reload~~ — `cards.service.mapEvent` now returns `priceLabel`.
- ~~Ticket button label~~ — "Билеты" when no price, "Билеты от X" when price exists.
- ~~Splash fade-out~~ — 400ms opacity animation on bootstrap (was instant jerk).
- ~~Events "0м"~~ — distanceM/walkMinutes=null when venue not linked. walk_time explanation skipped.
- ~~openStatus~~ — 3 states work: open (green), unknown → "Часы не подтверждены" (gray), closed filtered from feed.
- ~~Filter sync~~ — landing preset → sessionStorage → discover toolbar active.
- ~~Price filter hidden~~ — 0% places with price_level, button commented out.
- ~~"Реши за меня" algorithm~~ — MMR λ=0.6, position band, event quota, anti-repeat, session penalties, mulberry32.
- ~~Taxi~~ — Yandex Go only (Bolt removed — no public API). Hidden <500m.

### Phase 0: Stabilize what we built (BLOCKER — nothing else until done)

#### 0.1 Critical bugs & flows — ✅ CLOSED
All critical bugs fixed. Remaining items moved to 0.1b and deferred.

#### 0.1b Card logic refactor (before 0.2)
Full spec: `.workbench/specs/feed-cards-ui-spec.md`
- [ ] **Batch 3: API changes** — closesAt на бэке, secondaryInterests маппинг (blocked on A2)
- [ ] **Batch 4: Events rail** — горизонтальный scroll-snap рельс событий отдельно от сетки мест (~3ч)
- [ ] События не видны в выдаче — scoring places > events, нужен events rail или буст
- [ ] Проверить фильтр "События" на фронте — отделяет ли type=event от type=place
- [ ] UI flows: landing → discover, onboarding, chips → ProfileStore, language switcher
- [ ] QA: полный пользовательский путь на проде (landing → discover → карточка → share)

#### 0.2 Backend stabilization
- [ ] GitHub Actions `workflow_dispatch` тест (Azure IP vs Cloudflare для tkt.ge/biletebi.ge)
- [ ] Если 403 → настроить local cron на тбилисской машине
- [ ] ADMIN_SECRET: проверить что guard реально блокирует (сейчас dev mode)
- [ ] Daily cron 02:00 UTC: проверить что работает (opera.ge, google_events, yolo.ge)
- [ ] Качество event данных: дубли, пустые titles, прошедшие даты, encoding
- [ ] Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID в Railway Variables

#### 0.3 Testing strategy
Full spec: `.workbench/specs/testing-strategy.md`
Vitest via `vitest-angular` (Angular 21 default). Zoneless. ~2 дня total.
- [ ] **0.3a Setup**: Vitest config + test-providers.ts + trivial passing test (~2ч)
- [ ] **0.3b Pure logic**: extract `resolveStatusSlot`, `formatDistance`, `formatEventTime` → `core/logic/`, write specs (~4ч)
- [ ] **0.3b** i18n key parity test (ru/en/ka key sets match)
- [ ] **0.3c Stores**: profile.store.spec.ts + saved.store.spec.ts (~2ч)
- [ ] **0.3c Components**: result-card.spec.ts (distance hidden, status slot variants) (~1ч)
- [ ] **0.3d K1 algorithm**: extract `decidePick()` → `core/logic/decide.ts`, write specs (determinism, anti-repeat, event quota) (~2ч)
- [ ] **0.3e E2E smoke**: landing → discover → card visible; "Реши за меня" → result (~2ч)

#### 0.4 Frontend optimization
- [ ] Аудит каждого модуля:
  - `landing/` — AdLandingComponent: chips, loadExamples, applySelectionsToStore
  - `discover/` — DiscoverComponent: recommendations fetch, card rendering, filters
  - `settings/` — SettingsComponent: language, location, preferences
  - `onboarding/` — WelcomeComponent + OnboardingComponent: flow, ProfileStore sync
  - `privacy/` — PrivacyComponent: consent banner, Consent Mode v2
  - `core/layout/` — AppShellComponent: showNav, navigation, language switcher
  - `core/services/` — ProfileStore, InteractionService, ProfileSyncService
- [ ] Bundle size analysis (`ng build --stats-json` → webpack-bundle-analyzer)
- [ ] Lazy loading audit: все feature modules lazy? Правильные preload strategies?
- [ ] PWA: service worker, offline mode, manifest, icons
- [ ] Performance: LCP, FID, CLS (Lighthouse audit на проде)
- [ ] i18n: проверить все 3 локали (ru/en/ka) — пропущенные ключи, encoding

#### 0.5 Documentation
- [ ] **Решить**: docs локально (markdown в репо) vs Notion vs оба
  - Локально: version-controlled, рядом с кодом, grep-able, offline
  - Notion: visual, shareable, non-dev friendly, search
  - Рекомендация: **код-доки в репо** (API, architecture, decisions), **product/user доки в Notion** (roadmap, specs, analytics)
- [ ] Актуализировать `docs/` в репо:
  - `docs/api-endpoints.md` — добавить events/import, import-enrichment
  - `docs/database.md` — добавить миграции 016-017, event_sources, текущую схему
  - `docs/scoring.md` — актуальный scoring formula, event vs place weighting
  - `docs/project-status.md` — обновить с текущими цифрами
- [ ] `.workbench/` cleanup — удалить устаревшие specs, оставить актуальные
- [ ] README.md — quick start для нового разработчика (setup, run, deploy)
- [ ] Notion MCP интеграция — подключить Claude Code к Notion для спек и доков. `@notionhq/notion-mcp-server` + API key. После стабилизации.

#### 0.6 Deferred (не делаем пока, зависимости или нужны метрики)
- [ ] `closesAt` на бэке — парсинг opening_hours.periods → close time в Asia/Tbilisi. Edge cases: 24/7, holidays, без periods. ~2ч. Делать в Batch 3 карточек.
- [ ] `openingHoursFetchedAt` + `isStale()` — BLOCKED на Phase A.A2 (миграция `enriched_at`). Без неё isStale() не работает. Пока: null → "Часы не подтверждены", без проверки свежести.
- [ ] `secondaryInterests` маппинг — бек отдаёт `secondaryTags`, нужен обратный lookup через INTEREST_SYNONYMS → interest names. Batch 3.
- [ ] ×0.95 scoring penalty за неподтверждённые часы — менять скоринг осторожно, затронет всю выдачу. Только после метрик Batch 1-2.
- [ ] Events rail component — новый компонент, scroll-snap, layout split. Batch 4, после стабилизации карточек.
- [ ] Tune-block (позиция 6 в сетке мест) — нет спеки что внутри. Уточнить перед реализацией.
- [ ] Мета-строка text-overflow — при длинной категории + дистанция + рейтинг + "также еда" может переноситься. Нужен `nowrap + ellipsis`.
- [x] ~~Bolt такси~~ — DONE. Yandex Go + Bolt в decide-for-me и detail card. Hidden <500m и на desktop.
- [ ] ESC закрывает модалку — детальная карточка места/события должна закрываться на Escape.
- [ ] Перевод категорий в карточках — проверить что category labels (Museum, Bar, Viewpoint...) переведены на ru/ka.
- [ ] Лайк в модальном окне — кнопка ♡ save в детальной карточке когда открыта как модалка (сейчас скрыта `@if (!isModal())`).
- [ ] Убирать прошедшие events — залоканные ивенты с `startsAt < now` не должны показываться. Проверить фронт-фильтрацию + бек cron.
- [ ] "Реши за меня" Фаза 2 — межсессионный impression discounting (Postgres), эвристика причины скипа, интерливинг. Только после метрик Фазы 1.
- [ ] Тултип полного имени — если title обрезан ellipsis, показывать полное имя по hover/long-press.
- [ ] Переводы мест на английский — не у всех venues есть `name_en`. Проверить coverage, запустить translate для недостающих.
- [ ] Кнопка фильтров (discover__filter-btn) — скрыта. Решить: добавить price_level через Google enrichment ($20/1K Enterprise) или переделать фильтр (open now, distance, type). 0% мест с ценами, 88% событий.
- [ ] Bolt такси — нет public API/deeplink. Идея: кнопка "Такси" → копирует адрес в clipboard + открывает приложение. Универсально для любого такси-провайдера.
- [ ] Такси UX улучшение — вместо отдельных кнопок провайдеров: одна кнопка "Такси" → копирует адрес/координаты → toast "Адрес скопирован" → открывает выбранное такси-приложение. Работает для Bolt, Yandex, любого.

### Phase A: Data Foundation — ✅ COMPLETE (11/11)
Full spec: `.workbench/specs/phase-A-data-spec.md`
**⚠️ ПЕРЕД МЕРЖЕМ В MAIN: миграция 018 на прод + osm_id backfill + re-enrich Enterprise (priceLevel) + map-facets + gemini-enrich + sync-by-osm + recalculate-idf. Без этого прод БД не совпадает с кодом.**
- [x] **A0: tkt.ge + biletebi.ge event ingestion** — DONE. Push-model deployed.
- [ ] A6: price_level в Enterprise field mask (1ч, можно сразу)
- [ ] A9: Google types → facet_cuisine/format маппинг (4ч, бесплатно)
- [ ] A1: osm_id migration (018) + бэкфилл (3-4ч)
- [ ] A2: enriched_at timestamp на places (1ч)
- [x] ~~A5: sync-by-osm~~ — DONE. Replaces coord-based. 1,729/1,729 synced. `tools/sync-atmosphere-to-prod.ts`
- [x] ~~A3: enrichment refresh cron~~ — DONE. Sunday 03:00 UTC, 200 stale/week, ~$4/mo. + impression maintenance cron 05:00 UTC.
- [x] ~~A4: stale hours policy~~ — DONE. enriched_at > 30 days → openStatus=undefined → "Часы не подтверждены".
- [x] ~~A7: budget controls~~ — DONE. Prepay set up.
- [x] ~~A8: Gemini enrichment~~ — DONE. 3,168/3,168 enriched (atmosphere 100%, occasion 100%, role 100%). ~$0.30. IDF recalculated: 131 facets.
- [ ] A10: facet_idf таблица + cron (2ч, после A8+A9)
Gate: price_tier ≥70%, facet_cuisine ≥50% food, facet_idf computed

### Phase F1: Freshness & Venue Negative — ✅ COMPLETE
Full spec: `.workbench/specs/phase-F1-freshness-spec.md`
ImpressionService: `apps/api/src/app/recommendation/impression.service.ts`
All 7 tasks done: impression_agg, discount (0.85^n), dithering, epsilon (1/8), favorites, adaptive radius, venue negative (hide→100).

### Phase F2: Faceted Personalization — ✅ COMPLETE
Full spec: `.workbench/specs/phase-F2-personalization-spec.md`
TasteProfileService: `apps/api/src/app/recommendation/taste-profile.service.ts`
All done: profile update (IDF+EMA), cosine scoring (w_personal 0→0.20), facet negative (≥2 threshold), price gaussian (β=0.06). Steck calibration GATED for ≥10 signals.

### Phase F3: Transparency & Onboarding — ✅ COMPLETE
Full spec: `.workbench/specs/phase-F3-transparency-onboarding-spec.md`
All 6 tasks done: whyLabel on cards, scrollable taste profile, how-it-works, no-gate onboarding, tourist/local modifiers, tune block baseline.

### Phase F4: Optional (validate before investing)
- [ ] F4.1: структурный поиск (Claude → JSON-фасеты, if analytics show demand)
- [ ] F4.2: occasion-conditional profiles (when enough data per user)

### Phase B: Multi-source enrichment (after Phase A + real traffic)
Full spec: `.workbench/specs/data-enrichment-roadmap.md`
- [ ] B1-B7: Overture, FSQ, OSM, 2GIS, Yandex (see spec)

### v1 — Community Layer
- [ ] "Been here" button — ground-truth visited signal
- [ ] Micro-tips + collections + badges
- [ ] Search/autocomplete

### v2 — Scale
Full spec: `.workbench/specs/collaborative-filtering-strategy.md`
- [ ] Popularity prior → segments → item-item co-occurrence
- [ ] City expansion (Batumi, Kutaisi)
- [ ] Journey planner ("Спланируй день" — schema ready in A8)
- [ ] Weather-aware, gamification, curator network

### Backend Testing & Documentation (after each phase, before merge)
- [ ] **Unit tests**: cover every service with Vitest (see `.workbench/specs/testing-strategy.md`)
  - [ ] RecommendationService: scoreCandidate, timeFit, applyDiversity, generateExplanations
  - [ ] FacetMapperService: mapAll, recalculateIdf — маппинг + IDF correctness
  - [ ] GoogleEnrichmentService: matchVenue (locationRestriction), applyEnterpriseDetails (priceLevel)
  - [ ] EventIngestionService: importEvents, upsertEvent — dedup, date parsing
  - [ ] TktGeAdapter: parseShows — date filter, URL format, tags enrichment
  - [ ] BiletebiGeAdapter: parseCategory — HTML parsing, date inference
  - [ ] CardsService: mapEvent (priceLabel), mapPlace (distance, title fallback)
  - [ ] Opening hours: checkOpenStatus, checkGooglePeriods — all edge cases (24/7, overnight, holidays)
  - [ ] [future] TasteProfileService: updateProfile, applyHideNegative, computeCosine
  - [ ] [future] ImpressionService: recordImpressions, applyDiscount
- [ ] **Class descriptions**: JSDoc на каждом service/controller с описанием:
  - Что делает (одно предложение)
  - Какие endpoints/methods выставляет
  - От чего зависит (inject)
  - Кто использует (consumers)

### Competitive Moat Timeline
```
Month 1-3:  Intelligence advantage (DONE: scoring, explanations, context)
Month 3-6:  Behavioral data (save/hide/click from real users)
Month 6-12: Community data (tips, collections, badges — network effect)
Month 12+:  Curator network + multi-city = sustainable moat
```

## Critical: Event Freshness

Events must be refreshed daily. Stale events = broken trust.

Automated via `@nestjs/schedule` cron (daily 02:00 UTC = 06:00 Tbilisi). Manual: `POST /v1/admin/ingestion/events/run`.

| Source | Refresh | Cost | Notes |
|---|---|---|---|
| opera.ge | 1x/day | 0 | Free HTML parser |
| google_events | 1x/day | 3 SerpApi/day | 90/month ≈ free tier limit (100/mo) |
| yolo.ge | 1x/day | 0 | Free AJAX endpoint |
| tkt.ge | **disabled** | 0 | Cloudflare 403 blocks Railway IPs |
| biletebi.ge | **disabled** | 0 | Cloudflare 403 blocks Railway IPs |

**SerpApi quota**: 100 searches/month (free tier), resets 1st of each month. Cached (identical) queries = free, don't count. Our 1 run = 3 searches. Daily refresh = 90/month. Fits in free tier for 1 city. No cost. 2+ cities = $50/mo plan (5,000 searches).

**Automated**: `@nestjs/schedule` cron runs daily at 06:00 Tbilisi (02:00 UTC). Marks past events, refreshes all sources. Manual trigger: `POST /v1/admin/ingestion/events/run`.

## Open UX Questions

- **Opening hours unknown (57% venues)**: currently no label shown. Closed venues hard-filtered. Need to decide: show "Hours unknown"? Or improve coverage (more Google enrichment)? For now — silence = no data, don't lie to user.

## Google Enrichment Pipeline

Three-phase enrichment. All require `GOOGLE_PLACES_API_KEY` env var on Railway.
Run order: Pro → Enterprise → Atmosphere (each phase needs the previous).

| Phase | Endpoint | What it writes | Cost |
|---|---|---|---|
| Pro | `POST /v1/admin/ingestion/google-enrich?limit=N` | `googlePlaceId`, photos, types | ~$0 (free) |
| Enterprise | `POST /v1/admin/ingestion/google-enrich-enterprise?limit=N` | **rating, ratingCount, openingHours** | ~$35 |
| Atmosphere | `POST /v1/admin/ingestion/google-enrich-atmosphere?limit=N` | allowsDogs, goodForChildren | ~$39 |

**Important**: limit=100-200 max from external URL (Railway proxy timeout). From Railway Console use `node -e "fetch('http://localhost:3000/...', {method:'POST'}).then(r=>r.json()).then(console.log)"` (no curl in container).

**Prod status (2026-07-16)**:
- Pro matched: ~684 (via API) + 572 (via coord sync) = **~1,256 venues with ratings**
- Local: 1,755. Gap: ~500 (venues with coord collisions or no match)
- Atmosphere: NOT run (allowsDogs/goodForChildren = 0 on prod)
- `locationRestriction` fix deployed — future enrichment runs on prod directly
- Coord-based sync done — `import-enrichment` endpoint works, remove after osm_id migration

## Cost Tracking

| Month | Google Places | SerpApi | Total | Budget |
|---|---|---|---|---|
| July 2026 (local) | $74 | $0 (free tier) | $74 | $100 |
| July 2026 (prod) | ~$35 (enterprise enrichment) | $0 | ~$35 | $100 |

Google Places breakdown: Pro (free) + Enterprise (~$35) + Atmosphere (~$39). One-time enrichment, not recurring.

## Deploy

- Domain: **lazigo.app** (lazy + go)
- Frontend: `lazigo.app` → Cloudflare Pages
- API: `api.lazigo.app` → **Railway** (EU West, Node.js 22, 1 replica)
- DB: Railway PostgreSQL (EU West, migrated from US West)
- Migrations: `POST /v1/health/migrate` (inline MIGRATIONS array in `health.controller.ts`)
- Manual ingestion: `POST /v1/admin/ingestion/events/run`
- Discover endpoint: `POST /v1/recommendations` (NOT /v1/discover)

## Known Issues

### tkt.ge + biletebi.ge: Cloudflare IP Block (2026-07-16)
Railway runs on shared datacenter IPs. tkt.ge and biletebi.ge are both behind Cloudflare
which returns **HTTP 403** to all Railway egress IPs. The adapters are registered and in
`event_sources` but `enabled=false` until a proxy solution is in place.

Root cause: outbound requests from Railway → Cloudflare bot protection → 403 HTML page →
`response.json()` throws → caught per-category silently → `fetched: 0, errors: 0`.

**Fix options:**
- ScrapingBee / ScraperAPI ($30-50/mo) — simplest
- Georgian VPS ($5-10/mo) + cron → POST to Railway ingest endpoint
- Cloudflare Worker as proxy (free 100k req/day)

**Current state:** both sources disabled in DB (`enabled=false`).
To re-enable after proxy is set up: `UPDATE event_sources SET enabled=true WHERE name IN ('tkt.ge','biletebi.ge')`

### Railway Console: no curl (2026-07-16)
Railway containers don't have `curl`. Use `node -e "fetch(...)"` for all HTTP calls from Console.

### Railway proxy timeout (2026-07-16)
External requests to `api.lazigo.app` timeout after ~30s. For long operations (enrichment, bulk ingestion),
use Railway Console with `http://localhost:3000/...` to bypass the proxy. Or use smaller batch sizes (limit=100-200).

### Google enrichment: sync resolved, gap remaining (2026-07-16)
- **Fixed**: `locationBias` → `locationRestriction` (rectangle + regionCode:GE). +162 new matches on prod.
- **Fixed**: coord-based sync (lat/lng match, ABS < 1e-7). +572 venues synced from local.
- **Remaining gap**: ~500 venues (local 1,755 vs prod ~1,256). Mostly coord collisions or short Georgian names.
- **TODO**: osm_id migration (018) for permanent stable key. After that, remove `import-enrichment` endpoint.
- **TODO**: Atmosphere enrichment on prod (allowsDogs/goodForChildren).
- NestJS body limit ~100KB — sync uses chunks of 30 records.

### Migration numbers used
016 = biletebi.ge source, 017 = tkt.ge source. Next free: **018**.
