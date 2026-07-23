# Landing Page Improvement Plan

Based on diagnostic of 133 visits/week, depth ~1.0, 17-42s time-on-site, 2 detail views.

## Root Causes

1. **SPA measurement artifact** — Yandex Metrika not tracking route changes (no `defer:true`, no manual `hit()`). Real depth unknown.
2. **No photos on cards** — text-only cards don't earn the scroll. Users judge in ~50ms (Lindgaard 2006).
3. **First screen buries the product** — hero pitch → chips → how-it-works before showing actual places/events.
4. **No message match** — ad keywords ("что посмотреть в тбилиси") don't match H1.

## Data Availability (as of 2026-07-19)

| Asset | Count | Coverage | Ready? |
|---|---|---|---|
| Place photos | 0 | 0% | Need Google Photos API ($7/1K, 1K free/mo) |
| Event posters | 212 | 91% of events | YES — posterUrl in DB, not in API response |
| Place ratings | ~1,256 | 40% | YES — already on cards |
| Facet atmosphere | 1,729 | 55% | YES — Gemini enrichment |

## Priority Actions

### P0: Fix Analytics (30 min) — BLOCKER
Without this we're blind. Can't measure any improvement.
- Add `defer: true` to Metrika init
- Add `ym(ID, 'hit', url)` on Angular route change
- Add scroll depth goals (25/50/75/100%)
- Add card-open, CTA-click, chip-select events
- Verify GA4 fires on SPA navigation

### P1: Event Posters on Cards (1 hour)
91% of events have poster_url. Zero API cost.
- Add `posterUrl` to RecommendationCard type
- Include in discover() response
- Render in result-card template (lazy-loaded, AVIF/WebP)

### P2: Place Photos via Google Photos API (4 hours)
- Photo references exist in Google Places data but not saved as URLs
- Need to call Photos API to get actual image URLs
- $7/1K requests, 1K free/month — covers current traffic
- **Cannot cache photo names** (Google ToS) — must re-fetch from Place Details
- Attribution required when `authorAttributions` non-empty
- Strategy: fetch on-demand, one photo per card, lazy-load below fold

### P3: Landing Page Reorder (4-6 hours)
Current order: hero → cards → events → how-it-works → chips → differentiator → CTA

Recommended order:
1. **H1 = ad query match** ("Что посмотреть в Тбилиси — прямо сейчас")
2. **Primary CTA: "Решить за меня"** (MMR single-pick — the differentiator)
3. **Live photographed strip** — 3-4 place cards with photos + tonight's events with posters
4. **Liveness**: "3,168 мест · обновлено сегодня · без регистрации"
5. **Mood/company chips** (to refine, not to choose before seeing value)
6. **How it works** (compressed, or cut)

### P4: Message Match (1 hour)
- H1 mirrors winning keywords: "Что посмотреть в Тбилиси — прямо сейчас"
- Subhead: "Не листай десятки списков. Одна рекомендация — и ты уже в пути."
- English: "Tbilisi: where to go tonight"

## Research References

- **Airbnb Pro Photography (2024-2025)**: +19% bookings, +21% earnings over 14,700 listings
- **Expedia EMG study**: hotels with good photos convert better; avg traveler views 35 photos
- **Baymard Institute**: 3+ images needed in product lists; images are first exploration point for 56% users
- **NN/g scrolling**: 57% viewing time above fold; 84% attention difference above vs below
- **Moz message match**: proper ad-to-page match lifts conversions 200%+
- **Google/SOASTA**: bounce +32% as load goes 1s→3s
- **Lindgaard et al. (2006)**: visual appeal judged in ~50ms

## Metrics to Track After Fix

- Scroll depth (25/50/75/100%) as Metrika goals
- Card-open rate (the real engagement signal)
- "Decide for me" tap rate
- Time-to-first-interaction
- Mood chip tap rate
- Webvisor session replays (filter <20s sessions)

## Cost

| Item | Cost | Notes |
|---|---|---|
| Event posters | $0 | Already in DB |
| Place photos (Google) | $0-7/mo | 1K free cap covers current traffic |
| Analytics fix | $0 | Code change only |
| Landing redesign | $0 | Code change only |

## Benchmarks

- Travel industry bounce: ~50% avg (desktop ~42%, mobile ~51.5%)
- Top-decile travel: <31% mobile bounce
- LaziGo current: ~50% bounce — average, but near-zero card-opens is the real problem
