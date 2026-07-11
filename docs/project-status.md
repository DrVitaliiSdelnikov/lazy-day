# LaziGo — Project Status

Last updated: 2026-07-11

## What It Is

**LaziGo** (lazigo.app) — contextual leisure discovery PWA for Tbilisi, Georgia.
"Where to go — no overthinking." User picks interests, company, and the app
delivers scored recommendations with explanations.

Not a map, not a catalog — a **decision engine**.

## Production

```
Frontend:  lazigo.app              → Cloudflare Pages (free, auto-deploy)
API:       lazy-day-production.up.railway.app → Railway (~$5/mo)
DB:        Railway PostgreSQL (no PostGIS — Haversine formula)
Analytics: Yandex.Metrika + Google Search Console
Cost:      ~$5/month
```

**Deployed: July 10, 2026**

## Stack

| Layer | Tech |
|---|---|
| Frontend | Angular 21, standalone components, signals, new control flow |
| Styling | Custom design system, 3 themes (day/evening/dark), CSS custom properties |
| Icons | Inline SVG (Tabler), LdIconComponent (30+ icons) |
| i18n | ngx-translate, 3 languages (ru/en/ka), 155+ keys |
| API | NestJS 11, TypeORM, class-validator |
| Database | PostgreSQL (Railway), 13 migrations |
| PWA | Service worker, manifest, splash screen |
| Monorepo | Nx 23 (lazy-day frontend, api backend, shared-models lib) |

## Data

| What | Count | Source |
|---|---|---|
| Venues | 3,164 | OSM (Tbilisi full bbox) |
| Google-enriched | 1,755 (55%) | Google Places API |
| Events | ~55 | opera.ge + Google Events + YOLO.ge |
| Opening hours | 1,794 (57%) | Google + OSM |
| Chains detected | 6 | OSM brand:wikidata |
| Migrations | 13 | 001-013 |

## Features (what's live)

### Core Engine
- **Scoring**: `0.45×interest + 0.25×distance + 0.15×time + 0.10×quality + 0.05×source`
- **Chain penalty**: ×0.85 on final score for chain venues
- **Interest synonyms**: nature→[outdoor,park,garden,viewpoint], etc.
- **Weight semantics**: ≥0.7 = hard filter, 0.3-0.6 = soft boost
- **Company modifiers**: family/couple/friends/solo affect scoring
- **Pet modifier**: Google `allowsDogs` fact-based + tag fallback
- **Adaptive radius**: expands ×1.5 if <5 results (up to 2x)
- **Night fallback**: 21:00-06:00, <5 results → tomorrow mode with banner
- **24/7 night boost**: +0.05 for always-open places at night
- **Haversine distance**: no PostGIS dependency, pure math

### UX Features
- **"Decide for me" (K1)** — fullscreen top-1 card, Route/Another/Share
- **Feed loader** — animated "пины сбегаются" SVG animation
- **Splash screen** — sleeping pin with Z-z-z bubbles
- **Welcome + Onboarding** — 3-step flow (interests, company, GPS) + ghost path
- **Tune-block** — in-feed interest picker for ghost-path users
- **Mood presets** — 7 quick filters (Прогулка, Поесть, Культура, etc.)
- **× on active chip** — clear preset with one tap
- **Undo hide toast** — 6s undo with card restore
- **Desktop hover hide** — eye-off icon on card hover (≥1024px)
- **Share** — navigator.share on mobile, clipboard on desktop
- **Route** — Google Maps dir with walking mode <2.5km
- **Yandex Go taxi** — deeplink (mobile only)
- **"On map"** — link next to address
- **Theme switching** — day/evening/dark with icons (sun/moon/refresh)
- **Tab bar hidden** during onboarding
- **GPS auto-init** — silent request if permission granted
- **Route/taxi disabled** without GPS + hint
- **OG image** — branded sleeping pin 1200×630

### Desktop
- **Sidebar** — location, radius, sections, company, pet, time selector
- **Modal detail** — opens in overlay, no URL change
- **3-column card grid** (1024px+)

### Technical
- **Interaction tracking** — impression, card_click, save, hide, route, share, taxi
- **Beacon API** — fire-and-forget, works on page close
- **Event source monitoring** — Telegram alert if 0 events in 48h
- **Migration endpoint** — POST /v1/health/migrate for production
- **Chain detection** — OSM brand:wikidata → is_chain flag
- **Google site verification** + Yandex.Metrika

## Roadmap

### Post-Deploy: Week 1

| # | Task | Effort |
|---|---|---|
| 34 | ⚠️ Detail SSR preview (dynamic OG for shared links) | 3-4 hours |
| 35 | ⭐ K7: Evening digest Telegram bot | 1 day |
| 36 | ⭐ K2-lite: "Decide together" (shared picks) | 1-2 days |
| 38 | Tourist vs Local (one onboarding question) | 1-2 hours |
| 39 | Feedback + Telegram forwarding | 0.5-1 day |
| 40 | Daily feed rotation (date-seeded shuffle) | 2-3 hours |
| 41 | Scroll restore on back-navigation | 3-4 hours |
| 42 | Stale-while-revalidate entry | 3-4 hours |
| 34b | Session refinement (scroll-triggered sub-tag narrowing) | 1-1.5 days |

### Month 2-3 (v1)

- Data dedup & cross-verification (OSM↔Google matcher)
- Yandex Organizations adapter
- SSR for detail pages
- "Been here" button
- Collections
- Search/autocomplete
- Telegram Mini App (if K7 bot shows engagement)

### Month 4-12 (v2)

- Locals' choice badge (behavioral signal)
- Lazy Evening journey composer
- Real-time match (K2-full)
- Behavioral re-ranking
- Weather-aware scoring
- City expansion (Batumi, Kutaisi)

### Kill / Scale Criteria (deploy + 2 months)

| Signal | Decision |
|---|---|
| D7 ≥10% AND top-3 CTR ≥25% | **Scale** |
| D7 ≥10% BUT CTR <25% | **Iterate** scoring |
| D7 <10% AND CTR ≥25% | **Pivot** to evening anchor |
| D7 <10% AND CTR <25% | **Freeze** |

## Key Documents

| Doc | What |
|---|---|
| `docs/roadmap.md` | Full roadmap with all tasks |
| `docs/cheatsheet.md` | Commands, env vars, API reference |
| `docs/scoring.md` | Scoring formula details |
| `docs/ux-specs/` | 23 UX specs (README.md has index) |
| `docs/research/killer-features.md` | K1-K7 feature strategy |
| `docs/research/data-dedup-cross-verification.md` | Multi-provider matching |
| `CLAUDE.md` | AI session context |

## Cost

| Scale | Monthly |
|---|---|
| **MVP (current)** | **$5** |
| v1 (1 city) | $5 |
| 5 cities | $70 |
| 20 cities | $90 |
