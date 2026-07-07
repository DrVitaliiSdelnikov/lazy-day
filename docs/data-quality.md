# Data Quality

## OSM Import Pipeline

Source: Overpass API (OpenStreetMap) for Tbilisi bbox `[41.64, 44.70, 41.80, 44.90]`.

Pipeline: `POST /v1/admin/ingestion/osm` -> `OsmImportService.importFromOverpass()` -> upsert venues + places.

### Category Mapping

`osm-category-map.ts` maps OSM tags to LazyDay categories + tag arrays.

Example: `amenity=restaurant` -> category `restaurant`, tags `[food, restaurant]`.

Full tag vocabulary in DB: `food, restaurant, cafe, bar, nightlife, fast_food, bakery, culture, museum, gallery, theater, library, entertainment, cinema, club, outdoor, park, garden, viewpoint, attraction, artwork, playground, family, shopping, mall, wellness, swimming, gym, sports, bath`.

### Known Issue (2026-07-06): Permanently Closed Venues

OSM import does NOT check for closed/defunct venues. Missing filters:

1. **Overpass query** — no exclusion of `disused:*` or `demolished:*` tagged nodes.
2. **processElement()** — no check for `opening_hours = "closed"` or presence of `disused:amenity` tags.
3. **DB schema** — `places` table has no `status` column (active/closed/permanently_closed).
4. **SQL query** — `fetchPlaces()` has no status filter.

Result: permanently closed restaurants, defunct cafes etc. appear in recommendations.

**Fix**:
1. Add `status` column to `places` (varchar, default 'active').
2. Migration: `010_add_place_status.sql`.
3. OSM import: detect closed venues via `disused:*` tags and `opening_hours` containing "closed" or "off".
4. `fetchPlaces()`: add `WHERE p.status = 'active'` filter.
5. Re-run OSM import to update existing records.

## Tag Vocabulary vs User Interests

User-facing interest names (from onboarding/profile) must map to DB tag vocabulary.

See `docs/scoring.md` "Vocabulary Mismatch" section.

Interest synonym map bridges user language to DB tags.
Note: `wellness` tag is intentionally excluded — it's shared between spa and gym categories, causing false matches (gyms appearing for spa interest).
```
nature   -> [outdoor, park, garden, viewpoint]
spa      -> [bath, swimming]
bath     -> [bath]
food     -> [food, restaurant, cafe, bakery]
nightlife -> [nightlife, bar, club]
culture  -> [culture, museum, gallery, theater]
sports   -> [gym, sports]
```
