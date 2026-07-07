# LazyDay — Product Brief

## What It Is

Contextual leisure discovery app. User says who they are, what they're into, and when — gets a scored, explained feed of places and events. Not a map with pins. A decision engine.

**One sentence**: Google Maps tells you what exists. LazyDay tells you where to go.

## The Problem

Planning leisure in a new city (or even your own) means juggling Google Maps, event sites, review platforms, and friend recommendations. Each tool shows everything — 200 restaurants, 50 parks, dozens of events — without knowing your context. You're solo with a dog on a Tuesday evening? Google doesn't care. You want nature AND a café nearby? That's two separate searches.

## How It Works

User opens the app → selects interests (nature, food, nightlife, active leisure...) → sets company (solo, couple, family, friends + pet) → gets 15-60 scored results with explanations.

Each card answers four questions at a glance:
1. **Why this?** — "You like: nature", "Family friendly", "Pet friendly"
2. **Can I go now?** — "Open now" / "Closed" / "Starts at 19:00"
3. **How far?** — "11 min walk", "2.4 km"
4. **Is it good?** — Rating 4.8 (2.7k reviews)

## Technical Architecture

```
Angular 21 PWA          NestJS 11 API           PostgreSQL 16 + PostGIS
  ↓                       ↓                       ↓
Profile Store        Scoring Engine           3,069 venues
(interests,          (5-dimension             1,753 Google-enriched
 company, pet,        composite score)        1,722 with ratings
 locale, saved)                               10 events (opera.ge)
                     Opening Hours Parser
                     (OSM + Google dual)

                     Google Places API
                     (Pro + Enterprise +
                      Atmosphere enrichment)
```

**Stack**: Angular 21, NestJS 11, TypeORM, PostgreSQL/PostGIS, PrimeNG, Nx monorepo. PWA with service worker.

**Scoring formula**: `0.45×interest + 0.25×distance + 0.15×time + 0.10×quality + 0.05×source`

Modified by: company context (family penalizes nightlife), pet modifier (fact-based from Google `allowsDogs`), interest weight semantics (strict ≥0.7 = hard filter, soft 0.3-0.6 = boost).

## Current Data

| Data | Count | Source |
|---|---|---|
| Venues | 3,069 | OSM + expanded bbox |
| Google-matched | 1,753 (57%) | Google Places Text Search |
| Opening hours | 1,761 (57%) | 1,497 Google + 264 OSM |
| Ratings | 1,722 (56%) | Google Places |
| Pet-friendly data | 523 venues | Google Atmosphere |
| Kid-friendly data | 1,208 venues | Google Atmosphere |
| Events | 10 | opera.ge parser |
| Localization | en: 74%, ka: 54% | OSM + Google |

## What Makes It Different

Five things Google Maps cannot do:

1. **Compound context** — 5+ filters simultaneously (interest + company + pet + time + distance). Google filters one at a time.
2. **Explainability** — every card says WHY it's shown. Google shows stars, not reasoning.
3. **Social context** — "I'm with family + dog" changes the entire feed. Google has no concept of this.
4. **Events + places unified** — ballet at 19:00 next to park open until 22:00 in one scored feed. Google Events and Google Maps are separate products.
5. **Decision reduction** — 15 curated results, not 200. Less choice = better decisions.

## Key Technical Decisions

| Decision | Why |
|---|---|
| No serendipity pool | Random irrelevant venues = noise, not discovery. Research-backed. |
| Dynamic tag classification | Same venue = different primary/secondary tags per request. No DB changes needed. |
| Adaptive radius | Expands ×1.5 if <5 relevant results instead of showing irrelevant nearby. |
| Google Places split by SKU | Pro (free) → Enterprise ($35) → Atmosphere ($70). Total: ~$105 one-time. |
| Fact-based + proxy fallback | Use Google `allowsDogs` when available, fall back to tag-based proxy. |
| Opening hours dual parser | OSM raw strings + Google structured periods, auto-detect format. |
| No hardcoded districts | GPS + coordinate input. Scales to any city without per-city config. |
| City-as-Config model | New city = JSON config entry. No new code for Tier 1 events (SerpApi). |

## Growth & Scaling

### Adding a New City (minutes, not weeks)

```json
{
  "id": "batumi",
  "name": "Batumi",
  "lat": 41.6168,
  "lng": 41.6367,
  "timezone": "Asia/Tbilisi",
  "locales": ["ka", "en", "ru"]
}
```

Pipeline: OSM import (bbox) → Google enrichment (automatic) → SerpApi events (one query) → ready.

Custom parsers only if Google Events covers <70% of local events.

### Competitive Moat Timeline

```
Now:        Intelligence advantage (scoring, explanations, context)
Month 3-6:  Behavioral data (save/hide/click from real users)
Month 6-12: Community data (tips, collections, "been here" badges)
Month 12+:  Local curator network = sustainable moat
```

Data is commodity (Google has more). Intelligence + community = moat.

### Cost at Scale

| Scale | Monthly cost |
|---|---|
| 1 city (Tbilisi) | ~$10 (VPS only) |
| 5 cities | ~$15 (VPS + SerpApi free tier) |
| 20 cities | ~$90 (VPS + SerpApi $50 + minor Google) |
| 50 cities | ~$120 |

No per-city engineering cost for Tier 1 coverage.

### Events Strategy (3 tiers)

| Tier | Method | Coverage | Scale |
|---|---|---|---|
| 1. SerpApi Google Events | One API, any city | 70-80% | Automatic |
| 2. Local parsers | Per-city (TKT.ge, YOLO.ge) | 90%+ | Manual |
| 3. Telegram monitoring | Discovery layer | Signal only | Semi-auto |

### Roadmap

**MVP** (current → deploy): Events via SerpApi + YOLO.ge. Behavioral signals start. Mood presets. Deploy to Cloudflare + Hetzner.

**v1**: Community layer (micro-tips, collections, "been here"). Search/autocomplete. Conversational discovery. More event sources.

**v2**: Behavioral re-ranking. Light gamification. Journey planner. Weather-aware. City expansion. Push notifications.

## Positioning

For travelers and locals who want to **decide what to do**, not **search what exists**.

LazyDay is the friend who knows the city and asks "who are you with, what are you into, when?" — then gives you 10 perfect options with reasons why.
