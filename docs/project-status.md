# LaziGo — Project Status

Last updated: 2026-07-11 (end of week 1 post-deploy)

## What It Is

**LaziGo** (lazigo.app) — contextual leisure discovery PWA for Tbilisi, Georgia.
"Where to go — no overthinking." User picks interests, company, and the app
delivers scored recommendations with explanations. Not a map — a decision engine.

**Core promise**: "Don't check, just go." One recommendation should be enough.

## Production

```
Frontend:  lazigo.app                              → Cloudflare Pages (free)
API:       lazy-day-production.up.railway.app       → Railway (~$5/mo)
DB:        Railway PostgreSQL (Haversine, no PostGIS)
Analytics: Yandex.Metrika (consent-gated) + interaction_events
Cost:      ~$5/month
```

**Deployed: July 10, 2026** — live, accepting users.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Angular 21, standalone components, signals, new control flow |
| Design | Custom design system, 3 themes (day/evening/dark), Tabler SVG icons |
| i18n | ngx-translate, 3 languages (ru/en/ka), 170+ keys |
| API | NestJS 11, TypeORM, class-validator |
| Database | PostgreSQL (Railway), 14 migrations |
| PWA | Service worker, manifest, splash screen, OG image |
| Monorepo | Nx 23 (lazy-day frontend, api backend, shared-models lib) |

## Data

| What | Count | Source |
|---|---|---|
| Venues | 3,164 | OSM (Tbilisi full bbox) |
| Google-enriched | 1,755 (55%) | Google Places API ($74 one-time) |
| Events | ~55 | opera.ge + Google Events + YOLO.ge |
| Opening hours | 1,794 (57%) | Google + OSM |
| Chains flagged | updating... | OSM brand + 35 known chains |

## What's Live (features)

### Killer Feature
- **"Decide for me" (K1)** — fullscreen top-1 card, Route/Another(×3)/Share. Non-chain preferred.

### Core Engine
- **Scoring**: `0.45×interest + 0.25×distance + 0.15×time + 0.10×quality + 0.05×source × chain_penalty(0.85)`
- **Interest synonyms**: 11 categories, each with tag vocabulary
- **Company/pet modifiers**: Google attributes (fact) → tag proxy (fallback)
- **Adaptive radius**: ×1.5 expansion if <5 results (up to 2x)
- **Night fallback**: 21:00-06:00 → tomorrow mode with honest banner
- **24/7 boost**: +0.05 for always-open venues at night
- **Daily rotation**: date-seeded shuffle for cards with |Δscore| < 0.05, top-3 stable
- **Chain deprioritization**: ×0.85 score, excluded from K1. 35 known + OSM brand detection

### UX
- Welcome → Onboarding (3 steps) → Feed (or ghost path → tune-block)
- 7 mood presets with × clear, type filter (all/places/events)
- Feed loader animation ("пины сбегаются"), splash screen
- Undo hide (6s toast), desktop hover hide icon
- Share (navigator.share mobile / clipboard desktop) → OG preview endpoint
- Route → Google Maps (walking <2.5km), Yandex Go taxi (mobile)
- "On map" link next to address. Address always shown.
- GPS auto-init, route/taxi disabled without GPS + hint
- Desktop: sidebar (location, radius, sections, company, pet, time) + modal detail
- Theme switching (sun/moon/refresh icons)
- Tab bar hidden during onboarding

### Security & Legal
- Admin endpoints protected by `x-admin-token` (AdminGuard)
- Consent banner — Yandex.Metrika only loads on Accept
- Webvisor removed (session replay = GDPR issue)
- `consent_state` tracked in interaction_events
- Privacy page at /privacy

### Data & Analytics
- **Interaction tracking**: impression (with position), card_click, save, hide, route, share, taxi, decide_open, decide_skip
- **Beacon API**: fire-and-forget, works on page close
- **Event source monitoring**: Telegram alert if 0 events in 48h
- **Yandex.Metrika**: clickmap + trackLinks (consent-gated)
- **Google Search Console**: verified, sitemap submitted
- **Feedback**: bottom sheet in settings → POST /v1/feedback → Telegram bot
- **Dynamic OG**: GET /v1/og/:type/:id returns rich preview for messengers

### Kill/Scale Metrics (ready to compute)
```sql
-- D7 Return Rate, Top-3 CTR, Route Rate, DAU
-- SQL queries in docs/cheatsheet.md
```

## Known Debts

| Debt | Severity | Status |
|---|---|---|
| Chain detection incomplete (need fix-chains on prod) | 🟡 | fixing now |
| 43% venues without opening hours | 🟡 | needs targeted re-enrichment |
| No error monitoring (Sentry) | 🟡 | pending |
| No uptime monitoring (UptimeRobot) | 🟡 | pending |
| ~55 events may be thin for K7 digest | 🟡 | needs SQL gate check |
| Tourist vs Local not implemented | 🟡 | spec ready |
| Scroll restore on back-navigation | 🟡 | spec ready |
| Stale-while-revalidate entry | 🟡 | spec ready |

## Week 1 Post-Deploy (done)

| Day | What | Status |
|---|---|---|
| 1 | R1 admin security + S1 metrics foundation | ✅ |
| 2 | R2 consent + privacy (GDPR) | ✅ |
| 3 | R3 detail URL + #34 dynamic OG | ✅ |
| 4 | A1 chain detection + #40 daily rotation | ✅ |
| 5 | #39 feedback + Telegram | ✅ |

## Next Up (week 2)

| # | Task | Effort |
|---|---|---|
| A1b | Fix chain flags on prod (fix-chains endpoint) | 5 min |
| A4 | UptimeRobot + Sentry | 30 min |
| #38 | Tourist vs Local | 1-2 hours |
| #41 | Scroll restore | 3-4 hours |
| #42 | Stale-while-revalidate | 3-4 hours |
| A2 | Event depth check → K7 gate | 30 min |
| K2-lite | "Decide together" shared picks | 1-2 days |

## Month 2-3 (v1)

| Task | Impact |
|---|---|
| K7 Evening digest bot (if events sufficient) | Retention anchor |
| K4 Telegram Mini App (if K7 shows engagement) | Channel |
| Data dedup & cross-verification | Quality |
| Yandex Organizations adapter | Coverage |
| SSR for detail pages | SEO |
| "Been here" button | Proprietary data |
| Collections | Virality |
| Search/autocomplete | Usability |

## Month 4-12 (v2)

| Task | Impact |
|---|---|
| K5 Locals' choice badge | Data moat |
| K3 Lazy Evening journey | Perceived value |
| K2-full Real-time match | Virality |
| Behavioral re-ranking | Quality |
| Weather-aware | Relevance |
| City expansion (Batumi, Kutaisi) | Scale |

## Kill / Scale (deploy + 2 months)

| Signal | Decision |
|---|---|
| D7 ≥10% AND top-3 CTR ≥25% | **Scale** |
| D7 ≥10% BUT CTR <25% | **Iterate** scoring |
| D7 <10% AND CTR ≥25% | **Pivot** evening anchor |
| D7 <10% AND CTR <25% | **Freeze** |

## Product Narrative

- **MVP** (now): "Opened — saw 15 ideas — or pressed one button and got one."
- **v1**: "Sent a link — picked together — matched — went."
- **v2**: "Evening assembles itself, and locals approve."

Each stage adds one verb: **decide → match → assemble**.

## Architecture

```
lazigo.app (Cloudflare Pages, free CDN)
  └── Angular 21 PWA, 3 themes, 3 languages

lazy-day-production.up.railway.app (Railway ~$5/mo)
  ├── NestJS 11 API
  │   ├── /v1/recommendations (scored feed)
  │   ├── /v1/cards/:type/:id (detail with distance)
  │   ├── /v1/og/:type/:id (dynamic OG preview)
  │   ├── /v1/interactions/batch (beacon tracking)
  │   ├── /v1/feedback (user feedback → Telegram)
  │   ├── /v1/health (status + event freshness)
  │   └── /v1/admin/* (protected: OSM, Google, events, chains, migrate)
  └── PostgreSQL (14 migrations, Haversine)
```

## Cost

| Scale | Monthly |
|---|---|
| **MVP (current)** | **$5** |
| v1 (1 city) | $5 |
| 5 cities | $70 |
| 20 cities | $90 |

## Key Documents

| Doc | What |
|---|---|
| `docs/roadmap.md` | Full roadmap with all tasks |
| `docs/post-deploy-review.md` | Week 1 review, red flags, plan |
| `docs/cheatsheet.md` | Commands, API, kill/scale SQL |
| `docs/ux-specs/` | 23 UX specs (README has index) |
| `docs/research/killer-features.md` | K1-K7 strategy |
| `docs/research/data-dedup-cross-verification.md` | Multi-provider matching |
| `docs/scoring.md` | Scoring formula |
| `CLAUDE.md` | AI session context |
