# LaziGo — Full Project Status (2026-07-25)

## What It Is

Contextual leisure discovery for Tbilisi. Angular 21 PWA + NestJS 11 + PostgreSQL. One developer.

**Core promise**: "Что посмотреть в Тбилиси — прямо сейчас". Not a map, not a catalog — a decision engine that scores 3,168 venues and ~200 events across 5+ dimensions simultaneously (interest + company + pet + time + distance) and explains every suggestion.

**Domain**: lazigo.app. Deploy: Cloudflare Pages (frontend) + Railway EU West (API + DB).

---

## What Works (shipped & live)

### Scoring Engine
- 17-step pipeline: fetch → filter → score → personalize → discount → diversity → serve
- Weights: 0.45 interest + 0.25 distance + 0.15 time + 0.10 quality + 0.05 source + personalization (0→0.20) + price boost (0→0.06)
- 11 interest categories with synonym expansion (user says "nature" → engine matches park, garden, viewpoint, outdoor)
- Company modifiers: family penalizes nightlife, couple boosts viewpoints
- Pet modifier: fact-based (Google allowsDogs) with tag proxy fallback
- Chain penalty: ×0.80 for local users, ×0.90 for tourists
- Adaptive radius: expands ×1.5 if <5 results, up to 2× original
- Opening hours: dual-format parser (OSM raw + Google structured periods)

### Faceted Personalization (Phase F2)
- Taste profile: IDF-weighted EMA, cosine similarity scoring
- Ramps from 0 to w=0.20 over 15 signals
- 7 signal types: save (1.0), route (0.7), taxi (0.7), share (0.7), ticket_click (0.7), decide_open (0.5), card_click (0.3)
- Negative attribution: threshold ≥2 concordant hides, floor -0.5
- Price tier gaussian boost (β=0.06)
- 83 IDF facets computed, 1,729 venues with Gemini-enriched atmosphere/occasion
- Validated: 16/16 tests green (McDonald's acceptance, preference-recovery, 9 invariants)

### Freshness (Phase F1)
- Impression discount: 0.85^unengaged_count, 24h recency gate
- Session dithering: deterministic variety between sessions
- Epsilon exploration: 1/8 random slot for serendipity
- Daily rotation for repeat visitors

### Data Coverage

| Data | Count | Coverage | Source |
|---|---|---|---|
| Venues | 3,168 | 100% | OSM Tbilisi bbox |
| Google matched | 1,755 | 55% | Google Places Pro |
| Ratings on prod | ~1,256 | 40% | Google Enterprise |
| Opening hours | 1,794 | 57% | Google + OSM |
| Facet atmosphere | 1,729 | 55% | Gemini Flash-Lite ($0.30 total) |
| Facet occasion | 1,729 | 55% | Gemini Flash-Lite |
| Facet cuisine/format | 69 facets | — | Google types mapping |
| IDF values | 83 facets | — | Computed, daily cron |
| allowsDogs | 524 | 17% | Google Atmosphere (synced) |
| goodForChildren | 1,210 | 38% | Google Atmosphere (synced) |
| Events | ~200 | — | 5 adapters |
| Event posters | 212/233 | 91% | tkt.ge + google + biletebi (proxy) |
| Place photos | 0 | 0% | Not yet (Google Photos API planned) |
| Localization en | ~74% | — | OSM name_en |
| Localization ka | ~54% | — | OSM name_ka |
| Event descriptions | 0 | 0% | No adapter parses them |

### Events Pipeline
- 5 source adapters: opera.ge, google_events (SerpApi), yolo.ge, tkt.ge, biletebi.ge
- 3 active on Railway cron (daily 02:00 UTC): opera, google, yolo
- 2 blocked by Cloudflare (tkt.ge, biletebi.ge): push-model via local fetch → POST /events/import
- GitHub Actions workflow for automated push (untested on Azure IPs)
- Event poster thumbnails: tkt.ge (static CDN), biletebi.ge (proxied through /v1/cards/img-proxy), google (direct)
- tkt.ge CDN migrated: `tkt.ge/api/image/` → `static.tkt.ge/img/`

### Frontend Features
- 3 languages (ru/en/ka) with ngx-translate
- Mood preset chips (9 categories, canonical taxonomy)
- "Решить за меня" / Decide-for-me: MMR λ=0.6 single-pick algorithm
- Detail card with hero image (poster/photo), save/share buttons in modal
- Explanations inline on cards: "Тебе нравится: культура · Высокий рейтинг · Рядом с вами"
- Geolocation: priming sheet, persistent chip with soft animation, "пл. Свободы (по умолчанию)" label
- Session filter persistence (sessionStorage)
- Yandex Go taxi (hidden <500m and on desktop)
- Dev tools: Reco Lab (/dev/reco-lab) with 5 action types, score decomposition, profile inspector

### Analytics
- GA4 (G-8RSG5LFWBC) + Google Ads (AW-18318311908)
- Yandex Metrika (110570889) with defer:true + manual SPA hit tracking
- SPA route tracking: ym('hit') + gtag('page_view') on every NavigationEnd
- Events: page_view, landing_view, favorite_added, route_clicked, share_clicked, scroll, session_start, first_visit
- Consent Mode v2: all granted (Georgia jurisdiction)

### Identity & Personalization Pipeline
- Anonymous identity: ProfileStore.deviceId (UUID) → SHA-256 hash → x-device-id header
- deviceIdHash cached in localStorage (no async race on first request)
- Single interceptor adds x-device-id to all /v1/ requests
- ProfileSyncService: POST /auth/anon → server uid → cookie ld_uid
- InteractionService uses ProfileStore.deviceId (unified, was separate ld_device_id)
- Taste profile: interactions → FeedbackService → TasteProfileService.updateOnPositive/updateOnHide

### Landing & Onboarding (E1-E9 refactor)
- Single primary CTA: "Показать, куда пойти" (outcome-naming, mirrors ad keyword)
- Secondary: quiet text link "Настроить под себя"
- H1 mirrors top ad queries for message match
- Preset chips as session filters (NOT written to ProfileStore)
- Canonical interest taxonomy: single source in libs/shared-models/src/lib/interests.ts
- ld_welcome_done only set on meaningful completion (not on ngOnInit)
- Onboarding: 2 steps (interests → company/pet). Geolocation removed.
- WelcomeComponent deleted (dead code)
- Welcome guard on /discover with ld_onboarding_started passthrough
- Tourist/local removed from UI — default 'local' (chains ×0.80)

---

## Problems Encountered & How They Were Solved

### Data & Enrichment

| Problem | Impact | Resolution |
|---|---|---|
| **tkt.ge/biletebi.ge Cloudflare block** | Railway IPs get 403, events not fetched | Push-model: local fetch → POST /events/import. GH Actions workflow (untested). |
| **Google enrichment coord mismatch** | 500 venue gap between local (1,755) and prod (~1,256) | osm_id migration (018) for stable key. sync-by-osm endpoint. Still ~500 gap. |
| **TypeORM column name mapping** | facet_atmosphere not saving (camelCase → snake_case) | Explicit `name:` in all @Column() decorators |
| **Biletebi CDN: application/octet-stream** | Browser downloads images instead of displaying | Image proxy endpoint /v1/cards/img-proxy with correct content-type |
| **tkt.ge poster URL format changed** | Old `tkt.ge/api/image/` returns 404 | CDN constant → `static.tkt.ge/img/`, 202 URLs migrated on prod |
| **Biletebi poster parser fails for Georgian titles** | 19/82 events without poster (regex mismatch) | Added fallback regex patterns (cover, any static.biletebi.ge image) |
| **Place photos = 0** | No venue thumbnails on cards | Google Places API planned ($7/1K, 1K free). On-demand proxy approach. |
| **Event descriptions = 0** | No content on detail cards | No adapter parses descriptions. Would need scraping per-event page. |
| **Google Places API key blocked for Gemini** | Maps Platform key can't call Generative Language API | Separate API key bound to service account |
| **Railway proxy timeout ~30s** | Enrichment operations fail from external URL | Use Railway Console (localhost) or small batches (limit=100-200) |
| **NestJS body limit 100KB** | Bulk event import + enrichment sync fail | `json({ limit: '5mb' })` in main.ts |

### Personalization & Scoring

| Problem | Impact | Resolution |
|---|---|---|
| **discoverWithExplanation ≠ discover pipeline** | Reco Lab showed different results than real feed | Added budget filter, interest filter, availability filter, impression discount, diversity to explain endpoint |
| **Interactions not updating taste profile** | Likes had no effect on personalization | Wired FeedbackService.log() → TasteProfileService.updateOnPositive/updateOnHide |
| **deviceId hash mismatch (3 algorithms)** | ProfileSyncService used djb2, backend used SHA-256 | Unified all to SHA-256. Cached hash in localStorage. |
| **3 different deviceId sources** | User appeared as 2-3 identities in DB | InteractionService now uses ProfileStore.deviceId. Single interceptor. |
| **deviceIdHash empty on first request** | Personalization skipped on first load (async race) | Cache SHA-256 in localStorage, sync on init |
| **Reco Lab x-device-id conflict** | Reset profile deleted wrong user's data | Interceptor skips if x-device-id already set by component |
| **PostgreSQL interaction_action enum** | route/taxi/card_click rejected by DB | Migration 019: ALTER TYPE ADD VALUE |
| **Events distance score 0.5** | Events sink when radius increases (places flood results) | Events without coords get distance=0.85 instead of 0.5 |
| **Event detail shows 6000km distance** | `v?.lat ?? 0` → haversine to (0,0) in Atlantic | Changed to `v?.lat ?? null`, null distance when no venue coords |
| **McDonald's #1 in "All" filter** | No interest filter → distance dominates | Personalization now applied before sorting in explain endpoint |

### Frontend & UX

| Problem | Impact | Resolution |
|---|---|---|
| **SPA analytics not tracked** | Yandex Metrika "depth ~1.0" was artifact | Added defer:true + manual ym('hit') on route change |
| **3 interest systems (landing/presets/tune block)** | Confusing, different weights for same key | Single canonical taxonomy in shared-models/interests.ts |
| **ld_welcome_done set before onboarding completes** | Abandoned users marked "done" with 0 interests | Only set in finishOnboarding() and goToFeed() |
| **Dual CTA on landing** | Decision paralysis, lower conversion | Single primary CTA + quiet text link |
| **Landing presets = 6, discover = 9** | Inconsistent category availability | All use PRESET_META (9 presets) |
| **Tune block weight = 0.8** | Different from onboarding (1.0) | Unified to 1.0 |
| **WelcomeComponent dead code** | Unreachable route, confuses architecture | Deleted |
| **Geolocation prompt in onboarding** | Burns native prompt before user sees value | Removed from onboarding, deferred to discover page geo chip |
| **How It Works bottomsheet** | Used ld-sheet--visible instead of ld-sheet--open | Fixed CSS class |
| **Save/share hidden in modal detail** | Buttons behind @if(!isModal()) | Moved outside condition |
| **Broken images crash layout** | CDN errors show broken img placeholder | (error)="brokenImage.set(true)" hides failed img |
| **Route button on events without coords** | Button present but useless | Hidden when !c.lat or !c.lng |

### Infrastructure

| Problem | Impact | Resolution |
|---|---|---|
| **Railway EADDRINUSE on restart** | Port 3000 held by zombie process | Manual taskkill before restart |
| **Railway no curl** | Can't make HTTP calls from console | `node -e "fetch(...)"` pattern |
| **Google Prepay required** | API calls fail without billing | Prepay set up |
| **ADMIN_SECRET with leading space** | Build breaks on Railway | No leading space in env var name |
| **Nx cache stale** | Old code served after changes | `--skip-nx-cache` flag or touch files to trigger rebuild |

---

## Traffic & Engagement (28-day data from GA4)

| Metric | Value |
|---|---|
| Unique users | 230 |
| First visits | 222 (96% new) |
| Sessions | 279 (1.26/user) |
| Page views | 835 (3.73/user) |
| Landing views | 116 (44% enter via landing) |
| Recommendations loaded | 514 from 133 users (3.86/user) |
| Favorites (save) | 40 from 8 users (5.0/user) |
| Routes | 6 from 4 users |
| Shares | 1 |
| Scrolls | 474 (87% scroll) |

**Key ratio**: recommendation_generated (58%) → route_clicked (1.7%). Users reach results but don't act.

---

## Costs

| Item | Monthly | Notes |
|---|---|---|
| Railway (API + DB) | ~$5 | Hobby plan |
| Cloudflare Pages | $0 | Free tier |
| Google Places (one-time) | $74 local + $35 prod | Pro + Enterprise + Atmosphere |
| Gemini enrichment (one-time) | $0.30 | 3,168 venues |
| SerpApi | $0 | Free tier (100/mo), using ~90 |
| Google Ads | ~$100/mo budget | ~$0.34 CPC |
| Domain | ~$10/yr | lazigo.app |

**Total recurring**: ~$105/mo (mostly ad spend)

---

## Architecture Debt

1. **Tune block ↔ presets not synced**: selecting in tune block doesn't highlight matching preset chip (documented as intentional but confusing UX)
2. **No place photos**: 0% coverage. Google Photos API on-demand proxy planned ($0 at current traffic).
3. **No event descriptions**: no adapter parses them. Would need per-event page scraping.
4. **Events rail missing**: events compete with places for same slots. Dedicated horizontal rail planned (0.1b Batch 4).
5. **No tests**: Vitest setup planned (0.3a) but not started. 16 personalization tests exist.
6. **No error handling/monitoring**: no Sentry, no structured logging. Telegram monitoring for event sources only.
7. **Desktop sidebar timeWindow bug**: "Сейчас" sends tomorrow's time window on some timezone configs.
8. **~500 venue gap on prod**: local has 1,755 Google-matched, prod has ~1,256. Coord collisions.

---

## What's Next (priority order)

1. **Wait 2-3 weeks** — measure E1-E9 effect on recommendation_generated → route_clicked
2. **Place photos** — Google Photos API on-demand proxy for detail cards
3. **Events rail** — horizontal scroll-snap separate from places grid
4. **Vitest setup** — unblock all testing
5. **Backend stabilization** — GH Actions test, admin guard verification, cron monitoring
6. **City expansion** — Batumi, Kutaisi (City-as-Config model ready)

---

## Migrations Applied

001-019 all applied on prod. Next free: 020.

Key migrations:
- 013: interaction_events + venue_interaction_stats
- 015: users table
- 018: facets + personalization (facet columns, facet_idf, impression_agg, user_taste_profile, osm_id)
- 019: interaction_action enum extension (route, taxi, card_click, decide_open, ticket_click)

---

## Documentation

```
laziGoDocs/
  architecture/
    system-overview.md          — stack, modules, stores
    scoring-pipeline.md         — 17-step pipeline, signal weights
  personalization/
    flow.md                     — cold start to learned profile
  data/
    enrichment-pipeline.md      — Google + Gemini + OSM, migrations, costs
  product/
    brief.md                    — product overview, 5 pillars
    project-status-full.md      — THIS FILE
  api/
    endpoints.md                — all REST endpoints + DTOs
  deploy/
    railway.md                  — prod deployment checklist
  dev-tools/
    reco-lab.md                 — Reco Lab v2 guide
  ux/
    onboarding-flow.md          — user journey, no-gate design
    onboarding-business-logic.md — detailed spec with all flows
    landing-improvement.md      — diagnostic + action plan
    landing-copy-variants.md    — all copy variants for A/B
    geolocation-playbook.md     — priming, fallback, microcopy
    entry-point-spec.md         — E1-E9 task tracker
```
