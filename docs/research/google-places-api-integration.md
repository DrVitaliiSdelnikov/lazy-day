# Google Places API Integration Plan

## Why

Three problems solved at once:
1. **Opening hours coverage**: 849/2976 (29%) places have hours from OSM → Google has ~95%
2. **Venue attributes**: `allowsDogs`, `goodForChildren`, `outdoorSeating` → replace proxy tag logic with facts
3. **Multi-category**: OSM gives 1 category → Google gives multiple `types` per place

## API Overview (Places API New, v1)

**Base URL**: `https://places.googleapis.com/v1/places`

**Auth**: API key via `X-Goog-Api-Key` header

**Key endpoints**:
- `POST /v1/places:searchNearby` — find places by location + type
- `POST /v1/places:searchText` — find places by name + location bias
- `GET /v1/places/{place_id}` — get details by place_id

**Field mask**: `X-Goog-FieldMask` header — controls which fields are returned AND which pricing tier applies. Critical for cost control.

## Fields We Need

### Tier: Pro ($17/1,000 after free tier)

| Field | Type | Use |
|---|---|---|
| `id` | string | Google place_id for future lookups |
| `displayName` | object | Localized name (`text`, `languageCode`) |
| `types` | string[] | Multiple categories (e.g., `["restaurant", "food", "point_of_interest"]`) |
| `primaryType` | string | Main category |
| `primaryTypeDisplayName` | object | Localized main category name |
| `accessibilityOptions` | object | `wheelchairAccessibleParking`, `wheelchairAccessibleEntrance`, etc. |
| `businessStatus` | enum | `OPERATIONAL`, `CLOSED_TEMPORARILY`, `CLOSED_PERMANENTLY` |

### Tier: Enterprise ($20/1,000 after free tier)

| Field | Type | Use |
|---|---|---|
| `regularOpeningHours` | object | Weekly schedule with `periods[]` and `weekdayDescriptions[]` |
| `currentOpeningHours` | object | Next 7 days schedule (accounts for holidays) |
| `rating` | float | Google rating (1.0-5.0) |
| `priceLevel` | enum | `PRICE_LEVEL_FREE` to `PRICE_LEVEL_VERY_EXPENSIVE` |

### Tier: Enterprise + Atmosphere ($40/1,000 after free tier)

| Field | Type | Use |
|---|---|---|
| `allowsDogs` | boolean | Can bring dogs |
| `goodForChildren` | boolean | Suitable for kids |
| `outdoorSeating` | boolean | Has outdoor seating |
| `liveMusic` | boolean | Has live music |
| `servesBeer` | boolean | Serves beer |
| `servesWine` | boolean | Serves wine |
| `restroom` | boolean | Has restroom |

## Pricing (2026)

**Free tier changed March 2025** — no more $200 pooled credit. Per-SKU free thresholds:

| SKU | Free/month | Then per 1,000 |
|---|---|---|
| Essentials | 10,000 | $5 |
| Pro | 5,000 | $17 |
| Enterprise | 1,000 | $20 |
| Enterprise + Atmosphere | 1,000 | $40 |

**Cost rule**: billed at the HIGHEST SKU field in your request. One `rating` field moves entire call from Pro ($17) to Enterprise ($20). One `allowsDogs` moves it to $40.

### Cost Estimate for LazyDay

We have ~2,976 places. One-time enrichment:

| Strategy | SKU | Free | Paid calls | Cost |
|---|---|---|---|---|
| Pro only (types, businessStatus, accessibility) | Pro | 2,976 < 5,000 free | 0 | **$0** |
| + opening hours + rating | Enterprise | 1,000 free | 1,976 | **$39.52** |
| + allowsDogs, goodForChildren, outdoorSeating | Enterprise+Atmosphere | 1,000 free | 1,976 | **$79.04** |

**Recommendation**: Two-pass enrichment:
1. **Pass 1 (Pro, free)**: types, businessStatus, primaryType, accessibilityOptions → 0 cost
2. **Pass 2 (Enterprise, ~$40)**: regularOpeningHours, rating → only for places missing OSM hours
3. **Pass 3 (Atmosphere, ~$80)**: allowsDogs, goodForChildren, outdoorSeating → optional, defer

Monthly refresh: only new/changed places (delta), not full re-enrichment.

## Rate Limits

- Per-project, per-method quotas
- Default: ~600 QPM for Place Details, ~600 QPM for Nearby Search
- Nearby Search: max 20 results per page, 60 per query
- Recommendation: batch with 100ms delay between calls → ~10 req/sec → 2,976 places in ~5 min

## Opening Hours Format (Google vs OSM)

### Google `regularOpeningHours.periods[]`

```json
{
  "periods": [
    {
      "open": { "day": 1, "hour": 9, "minute": 0 },
      "close": { "day": 1, "hour": 22, "minute": 0 }
    },
    {
      "open": { "day": 2, "hour": 9, "minute": 0 },
      "close": { "day": 2, "hour": 22, "minute": 0 }
    }
  ],
  "weekdayDescriptions": [
    "Monday: 9:00 AM – 10:00 PM",
    "Tuesday: 9:00 AM – 10:00 PM"
  ]
}
```

- `day`: 0=Sunday, 1=Monday, ..., 6=Saturday
- 24/7: single period with `open: { day: 0, hour: 0, minute: 0 }`, no `close`
- Already structured — no parsing needed (unlike OSM raw strings)

### Migration path

Store Google format in `opening_hours` column as-is (already jsonb). Update `checkOpenStatus()` to handle both:
- `{ raw: "Mo-Su 10:00-22:00" }` → OSM format (existing parser)
- `{ periods: [...], weekdayDescriptions: [...] }` → Google format (new parser, simpler)

## Enrichment Strategy

### Matching OSM venues to Google Places

Each venue has `name`, `lat`, `lng`. Match strategy:

1. **Text Search** with `textQuery = venue.name` + `locationBias = { circle: { center: { lat, lng }, radius: 50 } }`
2. Take first result if distance < 100m and name similarity > 0.7
3. Store `google_place_id` in venues table for future lookups

Alternative: **Nearby Search** with `includedTypes = [venue.category]` + small radius. Less precise for name matching.

**Recommendation**: Text Search for initial matching (better name precision), Place Details for subsequent refreshes (cheaper, by stored place_id).

### DB Changes

```sql
-- Migration 011
ALTER TABLE venues ADD COLUMN google_place_id TEXT;
CREATE INDEX idx_venues_google_place_id ON venues (google_place_id);

ALTER TABLE places ADD COLUMN attributes JSONB DEFAULT '{}';
-- { "allowsDogs": true, "goodForChildren": false, "outdoorSeating": true, ... }

ALTER TABLE places ADD COLUMN google_types TEXT[] DEFAULT '{}';
-- ["restaurant", "food", "point_of_interest", "establishment"]

ALTER TABLE places ADD COLUMN google_rating NUMERIC(2,1);
ALTER TABLE places ADD COLUMN google_rating_count INTEGER;
```

### Enrichment Service

```
apps/api/src/app/ingestion/
  osm-import.service.ts        (existing)
  google-enrichment.service.ts (new)
```

Pipeline:
1. Query all venues without `google_place_id`
2. For each: Text Search by name+location → get place_id
3. Place Details by place_id → get fields
4. Update venue (`google_place_id`) and place (`attributes`, `google_types`, `opening_hours`, `google_rating`)
5. Admin endpoint: `POST /v1/admin/ingestion/google-enrich`

### Scoring Integration

After enrichment, update `scoreCandidate()`:

```typescript
// Replace proxy pet logic with facts:
if (dto.profile.hasPet) {
  if (c.attributes?.allowsDogs === true) {
    interestScore = Math.min(1.0, interestScore * 1.5); // stronger boost — it's a fact
  } else if (c.attributes?.allowsDogs === false) {
    interestScore *= 0.1; // strong penalty — confirmed no dogs
  }
  // else: no data — fall back to current tag proxy logic
}

// Replace proxy family logic:
if (company === 'family') {
  if (c.attributes?.goodForChildren === true) {
    interestScore = Math.min(1.0, interestScore * 1.3);
  } else if (c.attributes?.goodForChildren === false) {
    interestScore *= 0.3;
  }
}
```

### timeFit with Google hours

```typescript
// In checkOpenStatus():
if (openingHours.periods) {
  // Google format — structured, no parsing needed
  return checkGoogleOpenStatus(openingHours.periods, at);
} else if (openingHours.raw) {
  // OSM format — existing parser
  return checkOsmOpenStatus(openingHours.raw, at);
}
```

## Implementation Phases

### Phase 1: Infrastructure (no API calls yet)
- Migration 011: add columns
- `GoogleEnrichmentService` skeleton
- Admin endpoint
- Update `checkOpenStatus()` to handle Google format
- Update `scoreCandidate()` to use attributes when available

### Phase 2: Pro enrichment (free) — DONE (2026-07-07)
- Text Search matching: venue → google_place_id
- Fetch: types, businessStatus, primaryType, accessibilityOptions
- Store google_types, update place status from businessStatus
- **Results**: 1,753/2,976 matched (59%), 672 with accessibility attrs, 0 errors
- Unmatched 1,223 = small OSM-only points (tones, unnamed cafes) without Google presence

### Phase 3: Enterprise enrichment (~$35) — DONE (2026-07-07)
- Place Details for all matched venues
- Fetch: regularOpeningHours, rating, userRatingCount
- Store structured hours in opening_hours jsonb, google_rating, google_rating_count
- **Results**: 1,753 enriched, 0 errors. 1,497 with Google hours, 1,722 with ratings (avg 4.42)
- Opening hours coverage: 29% → 59% (1,761 total = 1,497 Google + 264 OSM)

### Phase 4: Atmosphere enrichment (~$70) — DONE (2026-07-07)
- Place Details with atmosphere fields
- Fetch: allowsDogs, goodForChildren, outdoorSeating, liveMusic, restroom
- Stored in attributes jsonb, scoring uses facts with tag proxy fallback
- **Results**: 1,058 enriched, 0 errors. allowsDogs: 523 (294 true), goodForChildren: 1,208 (1,110 true), outdoorSeating: 548, liveMusic: 226

## Risks

| Risk | Mitigation |
|---|---|
| API key exposure | Server-side only, env var, never in frontend |
| Cost overrun | Field mask discipline, per-SKU monitoring, budget alerts |
| Rate limiting | 100ms delay between calls, retry with backoff |
| Place ID staleness | Refresh IDs older than 12 months (free call with id-only field) |
| Name mismatch | OSM name (Georgian) vs Google name (Georgian/English) — fuzzy match |
| Duplicate places | Same venue matched to different Google places — dedup by distance |

## Sources

- [Google Places API Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Nearby Search (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Place Types](https://developers.google.com/maps/documentation/places/web-service/place-types)
- [Usage and Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [REST Resource: places](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)
- [Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Google Places API Pricing 2026](https://www.woosmap.com/blog/google-places-api-pricing)
- [Google Places API Limits 2026](https://www.mapsleads.co/blog/google-places-api-limits-2026-complete-reference)
