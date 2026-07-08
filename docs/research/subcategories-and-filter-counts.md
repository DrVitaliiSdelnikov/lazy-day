# Research: Subcategories & Filter Pre-Validation

## 1. Subcategory Progressive Disclosure

### Idea
User selects "Culture" → sub-chips appear: `Museums (6) · Theaters (8) · Galleries (4)`. Tap to narrow.

### Analysis

**For:**
- More precise results ("theater" vs "all culture")
- Foursquare/TripAdvisor use this pattern
- Gives user control without complex settings

**Against:**
- +1-2 taps contradicts "lazy" positioning
- Small dataset per subcategory (31 theaters total → maybe 3 in 5km radius → feels empty)
- Mobile UI complexity (sub-chips, animations, overflow)
- Weight system already handles this (`culture:1 + theater:0.8`)

**Recommendation:**
Don't add subcategories BEFORE results. Add **post-result refinement chips** — user gets results first, then can filter by sub-type from cached data. Pattern: Google Search tabs (All · Images · Videos).

```
User selects "Culture" preset
  → API returns 20 results (museums, theaters, galleries, artworks)
  → UI shows: [All (20)] [Theaters (8)] [Museums (6)] [Galleries (4)] [Art (2)]
  → Tap "Theaters" → client-side filter → instant
```

No extra API call. Counts computed from already loaded cards. Zero latency.

### Implementation (when ready)

```typescript
// Computed from allCards
subcategoryCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const card of this.allCards()) {
    counts.set(card.category, (counts.get(card.category) ?? 0) + 1);
  }
  return counts;
});
```

Phase: v1 (after deploy, based on user feedback).

---

## 2. Filter Pre-Validation (counts before search)

### Problem
User selects interest "Karting" → hits search → 0 results. Frustrating. User thinks app is broken.

### Solution: Availability counts API

Before user commits to a search, show how many results each filter would return. Disable or gray out filters with 0 results.

### Option A: Aggregation endpoint

```
GET /v1/meta/filter-counts?lat=41.75&lng=44.79&radiusM=5000&timeFrom=...&timeTo=...
→ {
    "interests": {
      "food": 145, "nature": 12, "culture": 28, "nightlife": 8,
      "active": 3, "entertainment": 5, "gym": 16, "sports": 4,
      "spa": 2, "shopping": 6, "family": 8
    },
    "types": { "place": 180, "event": 4 },
    "openNow": 95
  }
```

Frontend uses this to:
- Show count badge on each interest chip: `Food (145)`, `Active (3)`
- Gray out interests with 0: `Karting` grayed if no kartings in radius
- Show total events available for type filter

**Cost:** One extra SQL query per filter panel open. Lightweight — just COUNT + GROUP BY on same PostGIS index.

### Option B: Piggyback on main request

Return counts alongside results:

```json
{
  "sessionId": "...",
  "cards": [...],
  "availableCounts": {
    "food": 145, "nature": 12, "gym": 16, ...
  }
}
```

Frontend updates filter UI after first load. No separate endpoint.

**Pro:** No extra request. **Con:** Counts only available after first search, not before.

### Option C: Client-side estimation

Count from cached venue data (if we preload venue list). But we don't preload — data comes from API per request.

### Recommendation: Option A for v1

Lightweight aggregation endpoint called when user opens interest panel. Returns counts per interest for current location + radius. UI disables zero-count interests, shows count badges.

### SQL sketch

```sql
SELECT
  unnest(tags) AS tag,
  count(*) AS cnt
FROM places p
JOIN venues v ON p.venue_id = v.id
WHERE p.status = 'active'
  AND ST_DWithin(
    ST_MakePoint(v.lng, v.lat)::geography,
    ST_MakePoint($2, $1)::geography,
    $3
  )
GROUP BY tag
ORDER BY cnt DESC;
```

Map tags back to interest categories via INTEREST_SYNONYMS (reverse lookup).

### UX Impact

| Without pre-validation | With pre-validation |
|---|---|
| Select "Karting" → search → 0 results → frustration | "Karting (0)" grayed → user picks something else |
| "Why is this empty?" | "Ah, no karting nearby, but 3 active options" |
| User blames app | User understands limitation |

### Implementation phases

1. **MVP (now):** "Show more" + adaptive radius covers most empty cases
2. **v1:** Aggregation endpoint + count badges on interest chips
3. **v2:** Real-time counts update as user changes radius/location
