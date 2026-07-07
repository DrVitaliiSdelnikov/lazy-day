# LazyDay — Project Status

Last updated: 2026-07-07

## What It Is

Contextual leisure discovery app for Tbilisi. User says what they're into (nature, food, nightlife), who they're with (solo, couple, family, friends), whether they have a pet — and gets personalized venue recommendations ranked by relevance, distance, opening hours, and ratings.

Stack: Angular 21 PWA + NestJS 11 API + PostgreSQL/PostGIS + Google Places API.

## How We Got Here

### Day 1 (2026-07-06): The Problem

Started with a working app that had a critical recommendation quality issue. User selects `nature + bath + spa` and gets 30 results full of restaurants, bakeries, and bars. One bath out of 30. Also permanently closed venues in results.

**Root cause investigation** revealed:
- Interest vocabulary mismatch: user says "nature", DB has "outdoor/park" — no bridge
- Serendipity floor too high: non-matching venues get 0.1 score, close ones compensate with distance
- No venue status tracking: OSM imports everything, never checks if closed
- Company field (solo/couple/family/friends) collected by frontend but completely ignored by API

### Day 1-2 (2026-07-06 → 07): Core Scoring Rebuild

1. **Interest Synonym Map** — bridges user language to DB tags: `nature → [outdoor, park, garden, viewpoint]`
2. **Removed serendipity pool** — research showed random irrelevant venues = noise, not discovery
3. **Dynamic primary/secondary tags** — same venue classified differently per request (park+cafe: nature user sees park, food user sees cafe)
4. **Closed venues infrastructure** — migration, OSM detection, SQL filter
5. **Scoring rebalance** — interest weight 0.35→0.45, time weight 0.20→0.15

Result: `nature + bath + spa` → 8 results: 4 parks, 3 viewpoints, 1 bath. Zero noise.

### Day 2 (2026-07-07): Context & Data Enrichment

6. **Company context scoring** — tag boost/penalty matrix per group type (family penalizes nightlife, couple boosts viewpoints, friends boosts bars)
7. **Pet-friendly modifier** — `hasPet` flag with outdoor boost, indoor penalty
8. **Opening hours parser** — OSM format parser, closed venues demoted
9. **Interest weight semantics** — weight ≥0.7 = hard filter ("I want this"), 0.3-0.6 = soft boost, <0.3 = ignored
10. **Google Places API integration** — 4-phase enrichment:
    - Pro (free): 1,753 venues matched, multi-category types, accessibility
    - Enterprise (~$35): opening hours (29%→59% coverage), ratings (1,722 venues, avg 4.42)
    - Atmosphere (~$70): real allowsDogs (294 true), goodForChildren (1,110 true), outdoorSeating (548)
11. **Localization** — venue titles + all explanations in ru/en/ka

## Current State

### Data

| Data | Coverage | Source |
|---|---|---|
| Venues total | 2,976 | OSM Overpass |
| Google matched | 1,753 (59%) | Google Places Text Search |
| Opening hours | 1,761 (59%) | 1,497 Google + 264 OSM |
| Ratings | 1,722 (58%) | Google Places |
| allowsDogs | 523 (294 allow) | Google Atmosphere |
| goodForChildren | 1,208 (1,110 friendly) | Google Atmosphere |
| outdoorSeating | 548 | Google Atmosphere |
| liveMusic | 226 | Google Atmosphere |
| Accessibility | 672 | Google Pro |
| Events | 0 | No source yet |

### Scoring Pipeline

```
Request: { lat, lng, radius, timeWindow, interests, company, hasPet, locale }
    ↓
PostGIS candidates (places WHERE status='active' + events WHERE status='scheduled')
    ↓
Hard filters (hidden, budget)
    ↓
Score each candidate:
  1. Interest match (synonym expansion → primary/secondary tag classification)
  2. Company modifier (tag boost/penalty matrix)
  3. Pet modifier (Google allowsDogs fact → outdoorSeating fallback → tag proxy)
  4. Family modifier (Google goodForChildren fact → tag proxy fallback)
  5. Distance decay (linear, 0m=1.0, radius=0.0)
  6. Time fit (opening hours: Google periods / OSM raw / unknown=0.8)
  7. Quality score
    ↓
Interest hard filter (strict interests ≥0.7 required, soft interests score-only)
    ↓
Adaptive radius (expand ×1.5 if <5 relevant results, up to 2x)
    ↓
Diversity reranker (category spread, chain cap)
    ↓
Localized response (title by locale, explanations in ru/en/ka, openStatus, primaryTags, secondaryTags)
```

### Scoring Formula

```
score = 0.45 × interest + 0.25 × distance + 0.15 × time + 0.10 × quality + 0.05 × source
```

### API Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /v1/recommendations` | Main recommendation engine |
| `POST /v1/admin/ingestion/osm` | OSM data import |
| `POST /v1/admin/ingestion/google-enrich` | Google Pro enrichment (types, status) |
| `POST /v1/admin/ingestion/google-enrich-enterprise` | Google Enterprise (hours, ratings) |
| `POST /v1/admin/ingestion/google-enrich-atmosphere` | Google Atmosphere (dogs, kids, outdoor) |
| `GET /v1/health` | Health check |
| `GET /v1/cards/:type/:id` | Single venue/event detail |
| `POST /v1/interactions` | User action tracking |
| `GET /v1/meta/categories` | Category tree |

## Key Decisions & Learnings

1. **No serendipity pool** — random irrelevant venues hurt UX more than help discovery. True serendipity = unexpected but within interest domain. Research-backed (SOLAR, FAS-MOEA frameworks).

2. **Dynamic category classification** — don't assign categories statically in DB. Same venue = different classification depending on what user asked for. Zero schema changes needed.

3. **Interest weight = intent strength** — weight 1.0 means "I want this" (hard filter), 0.3 means "nice to have" (scoring boost). This gives users proportional control without explicit "strict/loose" toggle.

4. **Google Places API pricing** — $200 monthly credit retired March 2025. Now per-SKU free thresholds. Pro tier (5,000/month free) covers our entire DB. Enterprise/Atmosphere cost ~$105 total one-time. Field mask discipline critical — one wrong field moves entire call to higher tier.

5. **Tag proxy → fact-based scoring** — started with "outdoor tag = probably pet-friendly" (proxy). After Google enrichment, switched to "allowsDogs=true" (fact) with proxy as fallback. Accuracy jump for venues with Google data.

6. **OSM vocabulary ≠ user vocabulary** — users think "nature", OSM has "outdoor/park/garden". Synonym map is the bridge. `wellness` tag was too broad (matched both spa and gym) — had to exclude it.

7. **Company context = re-ranking, not filtering** — academic consensus: social context modifies scoring weights, doesn't exclude venues. Family + nightlife request still shows bars, just ranked lower.

8. **Opening hours dual format** — OSM stores raw strings ("Mo-Su 10:00-22:00"), Google stores structured periods. Parser auto-detects and handles both. Coverage doubled after Google enrichment.

## What's Next

### Near-term

| Priority | Task | Impact | Effort |
|---|---|---|---|
| 1 | **Events data source** — concerts, exhibitions, shows. Scoring ready, data missing | High (product value) | Medium-high |
| 2 | **Frontend polish** — use new API fields (openStatus, primaryTags, ratings) in UI cards | Medium (UX) | Medium |
| 3 | **Deploy** — frontend on Cloudflare Pages, backend on Hetzner VPS | High (go live) | Medium |

### Post-MVP

| Task | Impact | Effort |
|---|---|---|
| **Behavioral learning** — click/save/hide → personalized re-ranking | High long-term | High |
| **Google Places refresh** — periodic re-enrichment for new/changed venues | Medium | Low |
| **Journey-aware scoring** — "café on the way to park" contextual suggestions | Medium | High |
| **Budget-based filtering** — use Google priceLevel for budget matching | Low | Low |

## Research Documents

- `docs/research/categorization-and-ranking-strategy.md` — serendipity, multi-category, interest weights, cold start
- `docs/research/company-context-strategy.md` — company tag matrix, venue attributes, industry analysis
- `docs/research/google-places-api-integration.md` — pricing, fields, enrichment strategy, results

## Technical Docs

- `docs/scoring.md` — full scoring formula, all modifiers, explanations table
- `docs/data-quality.md` — OSM pipeline, tag vocabulary, venue status
- `docs/api-endpoints.md` — API reference
- `docs/database.md` — tables, migrations (001-011)
