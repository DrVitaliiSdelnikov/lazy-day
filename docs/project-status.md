# LaziGo — Project Status

Last updated: 2026-07-18 (Phase 0 stabilization in progress)

## What It Is

**LaziGo** (lazigo.app) — contextual leisure discovery PWA for Tbilisi, Georgia.
"Where to go — no overthinking." User picks interests, company, and the app
delivers scored recommendations with explanations. Not a map — a decision engine.

**Core promise**: "Don't check, just go." One recommendation should be enough.

**Product narrative**: decide → match → assemble.

## Production

```
Frontend:  lazigo.app                              → Cloudflare Pages (free, CDN global)
API:       api.lazigo.app                          → Railway (EU West, Node 22, ~$5/mo)
DB:        Railway PostgreSQL (EU West, 17 migrations, Haversine — no PostGIS)
Analytics: GA4 (G-8RSG5LFWBC) + Google Ads (AW-18318311908) + Consent Mode v2
Domain:    lazigo.app (Cloudflare DNS)
Cost:      ~$5/month infra + ~$35 one-time Google enrichment on prod
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
| Venues | 3,168 | OSM (Tbilisi full bbox incl. Lilo, Orkhevi) | July 10 |
| Google-enriched (local) | 1,755 (55%) | Google Places API ($74 one-time) | July 8 |
| Google-enriched (prod) | ~1,256 (40%) | API enrichment + coord sync | July 16 |
| Opening hours | 1,794 (57%) | Google + OSM (local only) | July 8 |
| Ratings (prod) | ~1,256 | Enterprise enrichment + coord sync | July 16 |
| allowsDogs (local) | 524 | Google Atmosphere | July 8 |
| goodForChildren (local) | 1,210 | Google Atmosphere | July 8 |
| Atmosphere on prod | 0 | NOT synced yet | — |
| Events | ~300+ | 5 sources (3 active, 2 push-model) | July 17 |
| Chains flagged | 258 | OSM brand + 35 known chains | July 11 |
| Names translated | 285 | Google Translate API (ka→en, ~$0.60) | July 13 |
| Migrations | 17 | 001-017 (016=biletebi, 017=tkt.ge) | July 16 |
| Google types (unique) | 227 | From google_types[] field | July 18 |

### Event Sources

| Source | Events | Frequency | Cost | Status |
|---|---|---|---|---|
| opera.ge | ~4 | daily cron 02:00 UTC | free | ✅ active |
| Google Events (SerpApi) | ~20 | daily cron | free tier (100/mo) | ✅ active |
| YOLO.ge | ~24 | daily cron | free | ✅ active |
| tkt.ge | ~215 | push-model (local/GH Actions) | free | ✅ active (Cloudflare blocks Railway) |
| biletebi.ge | ~97 | push-model (local/GH Actions) | free | ✅ active (Cloudflare blocks Railway) |
| **Total** | **~360/run** | **daily** | **$0** | |

tkt.ge + biletebi.ge blocked by Cloudflare on Railway IP. Push-model: `tools/fetch-blocked-events.ts` fetches from local/GH Actions → POST to `events/import` endpoint. `.github/workflows/fetch-events.yml` for daily cron.

## What's Live (features)

### Killer Feature
- **"Decide for me" (K1)** — MMR-based seeded algorithm, Route/Another(×3)/Share/Save
- Pool: top 25% eligible cards, MMR λ=0.6 for diversity (category + type + distance band)
- Event quota: ≥1 event in 3 picks if events exist
- Anti-repeat: shownIds set, session penalties (impression ×0.6, category skip ×0.85)
- Seeded PRNG (mulberry32): deterministic within session, fresh between days
- YandexGo taxi (hidden <500m, desktop hidden)
- Subtle pulse animation on button (3s cycle)
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
- **YandexGo taxi** — deeplink (mobile only, desktop hidden, hidden <500m)
- **Location row** — clickable → Google Maps (combined address + distance)
- **"Часы не подтверждены"** — shown when openStatus is null (with clock-off icon)
- **Theme switching** — day/evening/dark, icons only (sun/moon/refresh), auto by Tbilisi time
- **Theme-color meta** — status bar matches theme from first frame (splash + runtime)
- **Tab bar hidden** during welcome/onboarding
- **GPS auto-init** — silent request if permission granted, dev console logs
- **Route always active** — Google Maps handles origin. GPS hint shown if no GPS.
- **Session filter persistence** — preset/typeFilter/radius/time in sessionStorage (ld_filters)
- **Landing → discover sync** — preset chip selection synced via sessionStorage
- **Splash fade-out** — 400ms opacity animation (was instant jerk)
- **Place stripe** — `--ld-primary` left border. Event stripe — `--ld-event`
- **Feed cards 3-slot** — title+save, meta (category·distance·rating·cross-interest), status (open/closed/hours unknown/event countdown)
- **Detail card** — removed "Почему это вам" dupe, price dupe, double "на карте", canonical leak
- **Price filter hidden** — 0% places with price_level. Button commented out
- **Tag translations** — "Также: bar" → "Также: бар" via lTag() in all locales
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
- **UTM tracking** — UtmService captures gclid + utm_* from ad clicks, persists in sessionStorage, injected into all interaction_events
- **qualified_session** — GA4 event: ≥2 cards opened + ≥1 action (route/save/share). Primary Google Ads conversion
- **GA4 events** — recommendation_generated, no_results, route_clicked, share_clicked, favorite_added
- **Consent Mode v2** — default denied, update on Accept/Decline (analytics_storage, ad_storage, ad_user_data, ad_personalization)
- **Google Analytics** — G-8RSG5LFWBC, consent-gated alongside Metrika
- **Ad landing pages** — /en/tbilisi/today, /ru/tbilisi/today, /ka/tbilisi/today (dedicated, no nav)
- **Batch translate** — 285 Georgian venue names → English via Google Translate API (~$0.60)
- **Smart title fallback** — ru/en locale: prefer name_en over Georgian name

### API Endpoints

```
Public:
  POST /v1/recommendations              — Scored feed (main)
  GET  /v1/cards/:type/:id?lat=&lng=&locale= — Card detail with distance + locale
  GET  /v1/og/:type/:id                 — Dynamic OG HTML (messengers)
  POST /v1/interactions                  — Single interaction
  POST /v1/interactions/batch            — Batch interactions (beacon)
  POST /v1/feedback                      — User feedback → Telegram
  GET  /v1/meta/categories               — Interest categories
  GET  /v1/health                        — Status + event source freshness

Auth (HttpOnly cookie):
  POST /v1/auth/anon                     — Create/restore anon identity (idempotent)
  GET  /v1/auth/me                       — Get current user
  PATCH /v1/auth/me                      — Sync profile/savedIds/hiddenIds/consent
  DELETE /v1/auth/me                     — GDPR delete (anonymize)

Protected (x-admin-token → ADMIN_SECRET env var):
  POST /v1/health/migrate                — Run DB migrations
  POST /v1/admin/ingestion/osm           — OSM import
  POST /v1/admin/ingestion/fix-chains    — Flag known chains
  POST /v1/admin/ingestion/translate-names — Google Translate ka→en
  POST /v1/admin/ingestion/events/run    — Run all event sources
  POST /v1/admin/ingestion/events/source/:name — Run single source
  POST /v1/admin/ingestion/events/import — Push events from external worker
  GET  /v1/admin/ingestion/events/sources — List event sources
  POST /v1/admin/ingestion/google-enrich — Google Places Pro enrichment
  POST /v1/admin/ingestion/google-enrich-enterprise — Ratings, hours
  POST /v1/admin/ingestion/google-enrich-atmosphere — Dogs, kids, outdoor
  POST /v1/admin/ingestion/import-enrichment — Coord-based enrichment sync (temp)
```

## Known Debts

| Debt | Severity | Status | Notes |
|---|---|---|---|
| ~~Server identity (Safari ITP, D7 metrics)~~ | ~~🔴~~ | ✅ **tested** | UX-24 implemented, 8/8 API tests pass, Test A pass. Branch `feature/ux-24-anon-identity` ready to merge |
| ~~api.lazigo.app custom domain~~ | ~~🔴~~ | ✅ done | Live, SSL active |
| ~~Georgian venue names~~ | ~~🟡~~ | ✅ fixed | 285 translated via Google Translate API |
| 43% venues without opening hours | 🟡 | open | Needs targeted re-enrichment for top venues |
| No error monitoring (Sentry) | 🟡 | pending | User to set up |
| No uptime monitoring (UptimeRobot) | 🟡 | pending | User to set up |
| UX-23 Session refinement | 🟡 | spec ready | scroll-triggered sub-tag narrowing |
| K7 event depth | 🟡 | improved | Was 4 events, now ~55 with all sources |
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

### Post-deploy week 2 (July 12-13)
- Ads Day 1: UtmService + qualified_session + GA4 events (route_clicked, share_clicked, etc.)
- Ads Day 2: Ad landing pages (/en/tbilisi/today, /ru/tbilisi/today, /ka/tbilisi/today)
- Ads Day 3: Consent Mode v2 (default denied, update on Accept)
- Google Analytics G-8RSG5LFWBC added (consent-gated)
- Language switcher in header + welcome screen
- Fix: feedback button style, landing routes, nav hidden on landing
- Event sources fixed on prod (google_events + yolo.ge: 48 events/run)
- Batch translate: 285 Georgian venue names → English (~$0.60)
- Smart title fallback: ru/en prefer name_en over Georgian
- **UX-24 Anon server identity** — HttpOnly cookie, idempotent upsert (ON CONFLICT + xmax), ProfileSyncService (merge guard, UNION savedIds/hiddenIds, consent restore, debounced sync), GDPR DELETE /v1/auth/me (anonymize), GC cron (>90 days empty users). Spec v7, 9 commits, 8/8 API tests, both builds pass.
- Fix: detail save uses SavedStore (favorites work), Georgian titles via resolveTitle + locale, remove coordinates from location panel, sheet above mobile nav, duplicate open_now badge removed
- api.lazigo.app custom domain — Railway, SSL active, CORS configured

### Post-deploy week 3 (July 16-17) — Events + Enrichment + UI
- tkt.ge adapter (8 categories, 224 events) + biletebi.ge adapter (101 events). Cloudflare blocks Railway → push-model
- Push-model: `tools/fetch-blocked-events.ts` + `events/import` endpoint + GH Actions workflow
- Telegram monitoring (checkSourceHealth). Body limit 5mb.
- Landing page as entry point (chips, event cards, ProfileStore sync)
- Google enrichment on prod: locationRestriction fix (+162), coord sync (+572), total ~1,256 ratings
- Feed card 3-slot refactor. Detail card: removed dupes. Place/event stripe.
- "Реши за меня" MMR algorithm (diversity, event quota, anti-repeat, mulberry32)
- Session filter persistence (ld_filters). Landing→discover sync.
- Splash fade-out 400ms. Events "0м" fix. openStatus 3 states.
- tkt.ge ticketUrl fix. Event priceLabel on reload. YandexGo taxi. Bolt removed (no API).
- Tag translations (lTag). Price filter hidden. Icons (clock-off, car).

## Current: Phase 0 — Stabilization (BLOCKER)

Full checklist in CLAUDE.md. 9/12 done in 0.1, remaining:

| # | Task | Status |
|---|---|---|
| Events visibility | open — scoring places > events, events beyond limit 60 |
| Фильтр "События" | open — verify type=event filter works |
| UI flows | open — landing → discover → onboarding full path |
| QA | open — manual pass on prod |
| GH Actions test | open — test workflow_dispatch for tkt/biletebi |
| Daily cron | open — verify 02:00 UTC works (opera, google, yolo) |
| Vitest setup | open — Phase 0.3 |
| Frontend audit | open — Phase 0.4 |
| Documentation | open — Phase 0.5 |

## Next: Phase A — Data Stabilization

| # | Task | Effort |
|---|---|---|
| A1 | osm_id migration (018) — stable sync key | 3-4h |
| A2 | `enriched_at` timestamp — Google 30-day TTL | 1h |
| A3 | 30-day refresh cron | 2-3h |
| A4 | "Hours unknown" UI (stale data policy) | 1h |
| A5 | Atmosphere enrichment on prod | 30min |
| A6 | Field mask audit (price_level!) | 30min |
| A7 | Google Cloud budget controls | 30min |

## Later: Phase B — Multi-source Enrichment

| Task | Impact |
|---|---|
| Overture Maps Places (free, GERS ID) | Reconciliation backbone |
| Foursquare OS Places (free, closure detection) | Gap-fill |
| 2GIS commercial (best owner-verified for Tbilisi) | Quality |
| Entity resolution pipeline | Cross-verification |

## v1 — Community Layer

| Task | Impact |
|---|---|
| "Been here" button | Ground-truth visited signal (CF prerequisite) |
| Popularity prior (Bayesian-smoothed) | Hardest baseline to beat |
| Segment-based Thompson Sampling | First personalization |
| Search/autocomplete | Usability |
| Collections + "been here" badges | Virality + data moat |

## v2 — Personalization + Scale

| Task | Impact |
|---|---|
| Item-item co-occurrence + shrinkage (CF) | Recommendation quality |
| Behavioral re-ranking | Quality |
| Weather-aware scoring | Relevance |
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

api.lazigo.app (Railway EU West, Node 22, ~$5/mo)
  ├── NestJS 11 API
  │   ├── Recommendation engine (9-step pipeline + chain penalty + rotation)
  │   ├── Cards service (Haversine distance + locale title fallback + priceLabel)
  │   ├── Auth (HttpOnly cookie, idempotent upsert, GDPR delete)
  │   ├── OG preview (dynamic HTML for messengers)
  │   ├── Interaction tracking (batch + single)
  │   ├── Feedback → Telegram forwarding
  │   ├── Event cron (daily 02:00 UTC, 3 active sources, health alerts)
  │   ├── Event import (push-model for Cloudflare-blocked sources)
  │   ├── Google enrichment (Pro + Enterprise + Atmosphere, locationRestriction)
  │   ├── Enrichment sync (coord-based local→prod, temp endpoint)
  │   └── Admin endpoints (guarded, ADMIN_SECRET)
  └── PostgreSQL
      ├── 3,168 venues + ~1,256 Google-enriched on prod (1,755 local)
      ├── ~300+ events (5 sources, daily refresh)
      ├── users (anon identity, profile, saved/hidden, consent)
      ├── interaction_events (behavioral tracking)
      ├── event_sources (5 sources, enabled/disabled, last_fetched_at)
      ├── feedback table
      └── 17 migrations

External workers:
  ├── tools/fetch-blocked-events.ts (tkt.ge + biletebi.ge → push to prod)
  └── .github/workflows/fetch-events.yml (daily cron or manual dispatch)
```

## Cost

| Scale | Railway | SerpApi | Google Places | Analytics | Total/mo |
|---|---|---|---|---|---|
| **MVP (current)** | **$5** | $0 | ~$20-50 (30-day refresh) | $0 | **$25-55** |
| v1 (1 city) | $5 | $0 | ~$20-50 | $0 | **$25-55** |
| 5 cities | $10 | $50 | ~$100-300 | $0 | **$160-360** |
| 20 cities | $20 | $50 | ~$500-1500 | $0 | **$570-1570** |

One-time costs: Google enrichment local $74, prod ~$35 (Enterprise).

## Key Documents

| Doc | What |
|---|---|
| `docs/roadmap.md` | Full roadmap with all tasks and priorities |
| `docs/post-deploy-review.md` | Week 1 review, red flags, revised plan |
| `docs/cheatsheet.md` | Commands, API ref, env vars, kill/scale SQL |
| `docs/project-status.md` | **This file** — comprehensive current state |
| `docs/ux-specs/` | 24 UX specs (README.md has index with status) |
| `docs/scoring.md` | Scoring formula, all modifiers |
| `docs/database.md` | Tables, migrations, schema |
| `CLAUDE.md` | AI session context — roadmap, Phase 0/A/B, v1/v2 |

**Workbench specs (local only, not committed):**
| Spec | What |
|---|---|
| `.workbench/specs/feed-cards-ui-spec.md` | Card redesign spec (batched rollout) |
| `.workbench/specs/decide-for-me-algorithm.md` | K1 MMR algorithm spec |
| `.workbench/specs/testing-strategy.md` | Vitest + Playwright strategy |
| `.workbench/specs/cloudflare-event-sources-blocked.md` | Push-model for tkt/biletebi |
| `.workbench/specs/data-enrichment-roadmap.md` | Phase A/B enrichment plan |
| `.workbench/specs/prod-enrichment-sync.md` | Local→prod sync spec |
| `.workbench/specs/collaborative-filtering-strategy.md` | CF roadmap (stages 0-6) |
| `.workbench/specs/categories-taxonomy-analysis.md` | Google types analysis, taxonomy proposal |
