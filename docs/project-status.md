# LaziGo — Project Status

Last updated: 2026-07-11 (late evening, post week 1 fixes)

## What It Is

**LaziGo** (lazigo.app) — contextual leisure discovery PWA for Tbilisi, Georgia.
"Where to go — no overthinking." User picks interests, company, and the app
delivers scored recommendations with explanations. Not a map — a decision engine.

**Core promise**: "Don't check, just go." One recommendation should be enough.

**Product narrative**: decide → match → assemble.

## Production

```
Frontend:  lazigo.app                              → Cloudflare Pages (free, CDN global)
API:       lazy-day-production.up.railway.app       → Railway (~$5/mo, auto-deploy on push)
DB:        Railway PostgreSQL (14 migrations, Haversine — no PostGIS)
Analytics: Yandex.Metrika (consent-gated, no webvisor) + interaction_events
Domain:    lazigo.app (Cloudflare DNS)
Cost:      ~$5/month
```

**Deployed: July 10, 2026** — live, accepting users.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Angular 21 | Standalone components, signals, new control flow (@if/@for) |
| Design | Custom CSS design system | 3 themes (day/evening/dark), CSS custom properties `--ld-*` |
| Icons | LdIconComponent | 35+ Tabler inline SVGs, tree-shakeable |
| Fonts | Manrope (body) + Unbounded (display) | Google Fonts |
| i18n | ngx-translate v18 | 3 languages (ru/en/ka), 170+ keys, fallback to ru |
| API | NestJS 11 | TypeORM, class-validator, @nestjs/schedule |
| Database | PostgreSQL | 14 migrations, Haversine distance, no PostGIS |
| PWA | Angular SW | manifest, splash screen (sleeping pin SVG), OG image |
| Monorepo | Nx 23 | lazy-day (frontend), api (backend), shared-models (lib) |

## Data

| What | Count | Source | Last updated |
|---|---|---|---|
| Venues | 3,164 | OSM (Tbilisi full bbox incl. Lilo, Orkhevi) | July 10 |
| Google-enriched | 1,755 (55%) | Google Places API ($74 one-time) | July 8 |
| Opening hours | 1,794 (57%) | Google + OSM | July 8 |
| Ratings | 1,755 (55%) | Google | July 8 |
| allowsDogs | 607 | Google Atmosphere | July 8 |
| goodForChildren | 1,292 | Google Atmosphere | July 8 |
| Events | ~55 | 3 sources (see below) | July 11 |
| Chains flagged | 258 | OSM brand + 35 known chains | July 11 |
| Migrations | 14 + 014b | 001-014 + event sources fix | July 11 |

### Event Sources (all working on prod)

| Source | Events | Frequency | Cost |
|---|---|---|---|
| opera.ge | ~7 | daily cron 06:00 Tbilisi | free |
| Google Events (SerpApi) | ~17 | daily cron | free tier (100/mo) |
| YOLO.ge | ~24 | daily cron | free |
| **Total** | **~48/run** | **daily** | **$0** |

All sources were dormant on prod until July 11 (missing `SERPAPI_KEY` env + missing
`google_events`/`yolo.ge` entries in `event_sources` table — both fixed).

## What's Live (features)

### Killer Feature
- **"Decide for me" (K1)** — fullscreen top-1 card, Route/Another(×3)/Share
- Non-chain preferred, graceful degradation (3 tiers)
- Each "Another one" skip tracked as `decide_skip` (strongest training signal)

### Core Scoring Engine
- **Formula**: `0.45×interest + 0.25×distance + 0.15×time + 0.10×quality + 0.05×source`
- **Chain penalty**: ×0.85 on final score (258 chains flagged)
- **Daily rotation**: date-seeded shuffle for |Δscore| < 0.05, top-3 stable
- **Interest synonyms**: 11 categories → tag vocabulary (nature→[outdoor,park,garden,viewpoint])
- **Weight semantics**: ≥0.7 strict filter, 0.3-0.6 soft boost, <0.3 ignored
- **Company modifiers**: family/couple/friends/solo affect scoring via Google attributes + tag proxy
- **Pet modifier**: allowsDogs (fact) → tag fallback → outdoorSeating softening
- **Adaptive radius**: ×1.5 if <5 results, up to 2× expansion
- **Night fallback**: 21:00-06:00, <5 results → tomorrow mode with banner + greeting override
- **24/7 night boost**: +0.05 time component for always-open venues
- **Haversine distance**: pure math, no PostGIS. Bbox pre-filter on indexed lat/lng

### UX Features
- **Welcome screen** — brand icon, value prop, "Начать" CTA, ghost "Лень отвечать"
- **Onboarding** — 3 steps: interests (9 categories) + tourist/local question, company + pet, GPS
- **Ghost path** — skip all → tune-block at position 6 in feed (interest picker)
- **Feed loader** — animated SVG "пины сбегаются" (themed per day/evening/dark)
- **Splash screen** — sleeping pin with Z-z-z bubbles, auto-removed by Angular
- **7 mood presets** — Прогулка, Поесть, Культура, Активно, С детьми, Ночная жизнь, Фитнес
- **× on active chip** — clear preset with one tap
- **Type filter** — Всё / Места / События
- **Undo hide** — 6s toast with "Вернуть", card restored at original position
- **Desktop hover hide** — eye-off icon appears on card hover (≥1024px only)
- **Share** — navigator.share (mobile) / clipboard (desktop) → OG preview endpoint
- **Route** — Google Maps navigation (walking mode <2.5km, googlePlaceId for named pin)
- **Yandex Go taxi** — deeplink (mobile only, desktop hidden)
- **"On map"** — ghost link next to address opens Google Maps view
- **Address always shown** — fallback "Показать на карте" if no address text
- **Theme switching** — day/evening/dark, icons only (sun/moon/refresh), auto by Tbilisi time
- **Theme-color meta** — status bar matches theme from first frame (splash + runtime)
- **Tab bar hidden** during welcome/onboarding
- **GPS auto-init** — silent request if permission granted, dev console logs
- **Route/taxi disabled** without GPS + hint "Включите геолокацию"
- **Long title overflow** — word-break on detail, ellipsis on cards, overflow hidden on grid
- **Scroll restore (#41)** — cached feed + scroll position on back-navigation from detail
- **SWR entry (#42)** — cached feed shown instantly on re-open, silent background revalidate
- **Tourist vs Local (#38)** — onboarding question (First time / Been before / I live here)
- **OG image** — branded sleeping pin with badges 1200×630
- **Dynamic OG** — GET /v1/og/:type/:id returns rich preview for messengers

### Desktop (≥1024px)
- **Sidebar** — location, radius slider, sections (Всё/Места/События), company icons, pet toggle, time selector (Сейчас/Вечер/Завтра/Выходные), reset
- **Modal detail** — overlay with close X, no back button, URL via replaceState
- **3-column card grid** (2-column on 640px+)
- **Presets in toolbar** (not duplicated in sidebar)
- **No bottom padding** (no mobile nav)

### Security & Legal
- **AdminGuard** — `x-admin-token` header required for `/v1/health/migrate` and `/v1/admin/*`
- **Consent banner** — Yandex.Metrika only loads on Accept, i18n (ru/en/ka)
- **Webvisor removed** — session replay = GDPR issue
- **consent_state** tracked in every interaction_event (accepted/declined/pending)
- **Declined users** — device_id_hash='anonymous', aggregates work, no per-user tracking
- **Privacy page** — /privacy, linked from consent banner and settings
- **CORS** — explicit origin whitelist (lazigo.app + localhost:4200)

### Data & Analytics
- **Interaction tracking** — 9 event types: impression (with card_position), card_click, save, hide, route, share, taxi, decide_open, decide_skip
- **Beacon API** — sendBeacon with JSON blob, keepalive fetch fallback
- **deviceId in body** — sendBeacon can't set headers, so deviceId sent in JSON
- **Event source monitoring** — Telegram alert if 0 events from source in 48h
- **Yandex.Metrika** (ID: 110570889) — clickmap + trackLinks, consent-gated
- **Google Search Console** — verified (meta tag), sitemap submitted
- **Feedback** — bottom sheet in settings (4 categories: Bug/Idea/Missing/Other) → POST /v1/feedback → Telegram bot forwarding
- **Dynamic OG** — GET /v1/og/:type/:id for rich share previews
- **Kill/scale SQL** — D7 return, top-3 CTR, route rate, DAU queries in cheatsheet

### API Endpoints

```
Public:
  POST /v1/recommendations              — Scored feed (main)
  GET  /v1/cards/:type/:id?lat=&lng=    — Card detail with distance
  GET  /v1/og/:type/:id                 — Dynamic OG HTML (messengers)
  POST /v1/interactions                  — Single interaction
  POST /v1/interactions/batch            — Batch interactions (beacon)
  POST /v1/feedback                      — User feedback → Telegram
  GET  /v1/meta/categories               — Interest categories
  GET  /v1/health                        — Status + event source freshness

Protected (x-admin-token):
  POST /v1/health/migrate                — Run DB migrations
  POST /v1/admin/ingestion/osm           — OSM import
  POST /v1/admin/ingestion/fix-chains    — Flag known chains
  POST /v1/admin/ingestion/events/run    — Run all event sources
  POST /v1/admin/ingestion/events/source/:name — Run single source
  GET  /v1/admin/ingestion/events/sources — List event sources
  POST /v1/admin/ingestion/google-enrich — Google Places enrichment
```

## Known Debts

| Debt | Severity | Status | Notes |
|---|---|---|---|
| 43% venues without opening hours | 🟡 | open | Needs targeted re-enrichment for top venues |
| No error monitoring (Sentry) | 🟡 | pending | User to set up |
| No uptime monitoring (UptimeRobot) | 🟡 | pending | User to set up |
| UX-23 Session refinement | 🟡 | spec ready | scroll-triggered sub-tag narrowing |
| K7 event depth | 🟡 | improved | Was 4 events, now ~55 with all sources. Recheck gate |
| UX-1 phase 2 (session cooldown + company tune) | 🟡 | spec ready | |
| UX-4 phase 2 (reason chips + hidden screen) | 🟡 | spec ready | |

## Completed (chronological)

### Pre-deploy (July 9-10)
- Scoring engine rebuild (synonyms, dynamic tags, company/pet modifiers)
- Events ingestion (opera.ge, Google Events, YOLO.ge, daily cron)
- PrimeNG removal → custom design system (3 themes, Tabler icons)
- Desktop sidebar + modal detail
- SEO (robots.txt, sitemap.xml, meta+OG, JSON-LD, hreflang)
- PWA (manifest, splash screen, service worker)
- UX-1 tune-block, UX-3 night fallback, UX-4 undo hide
- UX-6 preset reset ×, UX-12 theme-color, UX-13 linear onboarding
- UX-15 route navigation + Yandex Go taxi
- UX-16 gym category, UX-17 share, UX-18 interaction tracking
- UX-19 event monitoring, K1 "Decide for me"
- Full i18n (ru/en/ka, 170+ keys)
- GPS auto-init, location fallback
- OG image, privacy page
- Deploy: Cloudflare Pages + Railway + PostgreSQL

### Post-deploy week 1 (July 10-11)
- Day 1: R1 admin security (AdminGuard) + S1 metrics foundation (deviceId fix, SQL queries)
- Day 2: R2 consent banner + GDPR (Metrika consent-gated, webvisor removed)
- Day 3: R3 detail URL (replaceState) + #34 dynamic OG endpoint
- Day 4: A1 chain detection (35 known + brand, 258 flagged) + #40 daily rotation
- Day 5: #39 feedback + Telegram + #41 scroll restore + #42 SWR entry
- Day 5: #38 tourist vs local + A2 event depth gate
- Fix: CORS for beacon API, event sources in DB (google_events + yolo.ge), chain fix endpoint
- Fix: detail distance 0m bug (preloadedCard + getCard with lat/lng)
- Fix: spa/bath icon (dog → coffee), long title overflow

## Next Up

| # | Task | Effort | Depends on |
|---|---|---|---|
| **A4** | UptimeRobot + Sentry | 30 min | user action |
| **A2 recheck** | K7 gate with 55 events | 30 min | — |
| **K2-lite** | "Decide together" shared picks | 1-2 days | R3 done ✅ |
| **UX-23** | Session refinement | 1-1.5 days | — |
| **A3** | Opening hours targeted re-enrichment | 2-3 hours | — |

## Month 2-3 (v1)

| Task | Impact |
|---|---|
| K7 Evening digest bot (gate passed if ≥3 events most evenings) | Retention anchor |
| K4 Telegram Mini App (if K7 shows engagement) | Channel |
| Data dedup & cross-verification (OSM↔Google matcher) | Quality |
| Yandex Organizations adapter | Coverage |
| "Been here" button | Proprietary data |
| Collections (create, save, share via URL) | Virality |
| Search/autocomplete | Usability |
| TKT.ge parser (if event gap >30%) | Event depth |

## Month 4-12 (v2)

| Task | Impact |
|---|---|
| K5 Locals' choice badge (behavioral signal from ≥5-session users) | Data moat |
| K3 Lazy Evening journey (auto-composed with dwell-time data) | Perceived value |
| K2-full Real-time match (upgrade from K2-lite if metrics pass) | Virality |
| Behavioral re-ranking (from user_preference_aggregates) | Quality |
| Weather-aware scoring (OpenWeatherMap → indoor boost on rain) | Relevance |
| City expansion (Batumi, Kutaisi via CityConfig) | Scale |
| Local curator network | Deep moat |

## Kill / Scale Criteria (deploy + 2 months)

| Signal | Decision |
|---|---|
| D7 ≥10% AND top-3 CTR ≥25% | **Scale**: invest in v1 features |
| D7 ≥10% BUT CTR <25% | **Iterate**: improve scoring, tourist mode |
| D7 <10% AND CTR ≥25% | **Pivot**: evening anchor, push notifications |
| D7 <10% AND CTR <25% | **Freeze**: preserve as portfolio piece |

Metrics computable via SQL in `docs/cheatsheet.md`. Requires: `card_position` in impressions ✅, stable `device_id_hash` ✅. Missing: tourist/local segmentation in interaction_events context (foundation laid, not yet passed to API).

## Architecture

```
lazigo.app (Cloudflare Pages, free CDN)
  └── Angular 21 PWA
      ├── 3 themes (auto-switch by Tbilisi time)
      ├── 3 languages (ru/en/ka)
      ├── InteractionService (beacon API, 9 event types)
      └── Consent-gated Yandex.Metrika

lazy-day-production.up.railway.app (Railway ~$5/mo)
  ├── NestJS 11 API
  │   ├── Recommendation engine (9-step pipeline + chain penalty + rotation)
  │   ├── Cards service (Haversine distance)
  │   ├── OG preview (dynamic HTML for messengers)
  │   ├── Interaction tracking (batch + single)
  │   ├── Feedback → Telegram forwarding
  │   ├── Event cron (daily 06:00, 3 sources, health alerts)
  │   └── Admin endpoints (guarded)
  └── PostgreSQL
      ├── 3,164 venues + 1,755 Google-enriched
      ├── ~55 events (3 sources, daily refresh)
      ├── interaction_events (behavioral tracking)
      ├── feedback table
      └── 14 migrations
```

## Cost

| Scale | Railway | SerpApi | Google | Analytics | Total/mo |
|---|---|---|---|---|---|
| **MVP (current)** | **$5** | $0 | $0 (done) | $0 | **$5** |
| v1 (1 city) | $5 | $0 | $0 | $0 | **$5** |
| 5 cities | $10 | $50 | ~$10 | $0 | **$70** |
| 20 cities | $20 | $50 | ~$20 | $0 | **$90** |

## Key Documents

| Doc | What |
|---|---|
| `docs/roadmap.md` | Full roadmap with all tasks and priorities |
| `docs/post-deploy-review.md` | Week 1 review, red flags, revised plan |
| `docs/cheatsheet.md` | Commands, API ref, env vars, kill/scale SQL |
| `docs/project-status.md` | **This file** — comprehensive current state |
| `docs/ux-specs/` | 23 UX specs (README.md has index with status) |
| `docs/ux-specs/ux-22-chain-deprioritization.md` | Chain detection architecture |
| `docs/ux-specs/ux-23-session-refinement.md` | Scroll-triggered sub-tag refinement |
| `docs/research/killer-features.md` | K1-K7 strategy, kill metrics per feature |
| `docs/research/data-dedup-cross-verification.md` | Multi-provider matching spec |
| `docs/research/carebox-migration-strategy-v2.md` | (unrelated — CB_libs context) |
| `docs/scoring.md` | Scoring formula, all modifiers |
| `docs/database.md` | Tables, migrations, schema |
| `CLAUDE.md` | AI session context for lazy-day project |
