# Data Enrichment Pipeline

How venue data is sourced, matched, and enriched.

## Sources

| Source | What | Count | Method |
|---|---|---|---|
| OpenStreetMap | Venues: name, coords, tags, hours | 3,168 | Overpass API bbox query |
| Google Places Pro | placeId, photos, types | 1,755 matched | Text Search (free tier) |
| Google Enterprise | rating, ratingCount, openingHours | ~1,256 | Place Details ($35/1K) |
| Google Atmosphere | allowsDogs, goodForChildren | 607/1,292 local | Place Details ($40/1K) |
| Gemini Flash-Lite | atmosphere, occasion, venue_role, duration | 3,168 (100%) | Batch prompt ($0.30 total) |

## Pipeline Order

```
1. OSM import          POST /v1/admin/ingestion/osm
2. Google Pro match     POST /v1/admin/ingestion/google-enrich?limit=200
3. Google Enterprise    POST /v1/admin/ingestion/google-enrich-enterprise?limit=200
4. Google Atmosphere    POST /v1/admin/ingestion/google-enrich-atmosphere?limit=200
5. Facet mapping        POST /v1/admin/ingestion/map-facets
6. Gemini enrichment    POST /v1/admin/ingestion/gemini-enrich?limit=500
7. IDF recalculation    POST /v1/admin/ingestion/recalculate-idf
```

Each phase depends on the previous (Pro gets placeId, Enterprise needs placeId, etc.).

## Facet System

### Facet Types

| Type | Values (examples) | Source |
|---|---|---|
| cuisine | georgian, european, japanese, fast_food | Google types mapping |
| format | restaurant, cafe, bar, food_court | Google types mapping |
| atmosphere | cozy, romantic, instagram_worthy, lively | Gemini enrichment |
| occasion | date, exploring, solo, friends, family | Gemini enrichment |
| price_tier | 1-4 ($ to $$$$) | Google Enterprise |

### IDF (Inverse Document Frequency)

Rare facets get higher weight than common ones.

```
idf(facet) = log(N_venues / (1 + n_venues_with_facet))
```

Examples:
- `cuisine:georgian` IDF = 2.83 (very common in Tbilisi)
- `cuisine:sushi` IDF = 6.68 (rare)
- `atmosphere:instagram_worthy` IDF = 4.12

Stored in `facet_idf` table. Recalculated daily at 04:00 UTC by `FacetMapperService.recalculateIdf()`.

## Enrichment Refresh

- **Weekly cron** (Sunday 03:00 UTC): Re-enriches 200 stalest venues via Google Enterprise
- **Daily IDF refresh** (04:00 UTC): Recalculates all IDF values
- **Daily impression maintenance** (05:00 UTC): Cleans stale impression_agg rows
- **Google ToS**: `place_id` storable forever. All other fields: 30-day TTL. `enriched_at` tracks freshness.

## Event Sources

| Source | Type | Status | Refresh |
|---|---|---|---|
| opera.ge | Opera/ballet | Active | Daily 02:00 UTC |
| Google Events (SerpApi) | Mixed | Active | Daily 02:00 UTC |
| yolo.ge | Concerts/parties | Active | Daily 02:00 UTC |
| tkt.ge | Tickets (8 categories) | Disabled (CF block) | Push-model via GH Actions |
| biletebi.ge | Tickets | Disabled (CF block) | Push-model via GH Actions |

## Migrations

| # | What |
|---|---|
| 001-015 | Core schema (venues, places, events, users, interactions) |
| 016 | biletebi.ge event source |
| 017 | tkt.ge event source |
| 018 | Facets + personalization (facet columns, facet_idf, impression_agg, user_taste_profile, osm_id) |
| 019 | Extend interaction_action enum (route, taxi, ticket_click, card_click, decide_open) |

## Cost

| Service | Cost | Frequency |
|---|---|---|
| Google Pro | Free (10K/mo) | One-time + refresh |
| Google Enterprise | ~$35/1K venues | One-time + weekly refresh |
| Google Atmosphere | ~$40/1K venues | One-time |
| Gemini Flash-Lite | ~$0.30 total | One-time |
| SerpApi | Free (100/mo) | 3 queries/day |
