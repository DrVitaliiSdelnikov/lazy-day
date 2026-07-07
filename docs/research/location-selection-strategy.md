# Research: Location Selection Strategy

## Problem

Current approach: 6 hardcoded Tbilisi districts in onboarding (Старый город, Вера, Ваке, Сабуртало, Мтацминда, Дигоми). This doesn't scale:

- New city = manually research and add 5-10 districts
- District names differ by language (Georgian, English, Russian names)
- District boundaries are fuzzy — user doesn't always know which "district" they want
- Some areas span districts (Lisi lake is between Vake and Didube)
- Tourist doesn't know district names at all

At 10 cities × 8 districts = 80 hardcoded entries to maintain. At 50 cities = impossible.

## Core Question

How does user tell the app WHERE they want recommendations? Four fundamentally different intents:

| Intent | Example | Frequency |
|---|---|---|
| "Where I am now" | Walking around, want something nearby | ~60% of sessions |
| "Where I'll be later" | Planning evening at a known area | ~25% of sessions |
| "Explore a specific place" | "What's near Lisi lake?" | ~10% of sessions |
| "Anywhere in city" | Tourist: "best of Tbilisi" | ~5% of sessions |

## Options

### Option A: GPS Only
User location = device GPS. No manual selection.

**Pro**: Zero config, zero maintenance, scales to any city
**Con**: Desktop users get fallback (wrong). Can't plan ahead ("I'll be near opera tonight"). Can't explore other areas.

**Verdict**: Necessary but not sufficient. Must be the default, but need manual override.

### Option B: Hardcoded Districts (current)
Predefined list of neighborhoods per city.

**Pro**: Quick tap, familiar names for locals
**Con**: Doesn't scale. Tourist doesn't know "Сабуртало". Boundaries are arbitrary. Maintenance burden per city.

**Verdict**: Delete. Replace with something scalable.

### Option C: Address / Place Search (autocomplete)
Text input with autocomplete → geocode to lat/lng.

```
[🔍 Search location: "Lisi lake" ]
  → Lisi Lake, Tbilisi, Georgia
  → Lisi Karting, Tbilisi
  → ...
```

**Implementation options**:
1. **Google Places Autocomplete** — best quality, $2.83/1000 sessions (session pricing)
2. **Apple MapKit JS** — 25K free/day, good quality
3. **Mapbox Search** — free tier available, session-based pricing
4. **Nominatim (OSM)** — free, self-hostable, lower quality for POI names
5. **Our own venues DB** — search our 3000+ venues by name, free, instant

**Pro**: Works for any city. User types what they know. Scalable.
**Con**: Requires typing (slower than tap). Autocomplete needs external API or good local search.

**Verdict**: Best scalable option. Use our own venue DB as primary (free), Google/Mapbox as fallback.

### Option D: Map Tap (pick point on map)
Show map → user taps location → recommendations around that point.

**Pro**: Visual, intuitive, works for "I'll be HERE"
**Con**: Heavy (needs map JS library). Bad on weak devices. Slow to load. Requires map tiles (Google/Mapbox = cost). Not good for "find me X" — user doesn't know WHERE X is.

**Verdict**: Nice to have for v1, but NOT primary input. Map = secondary view, not entry point.

### Option E: Recent / Saved Locations
Remember user's frequent locations: "Home", "Work", "Favorite café area".

**Pro**: One-tap for repeat users. Very personal.
**Con**: Empty on first use. Needs multiple sessions to build. Storage.

**Verdict**: v2 feature. Build on top of behavioral data.

### Option F: "Where I am" + "Around a place" (recommended)

Two simple modes, no districts:

```
Location: [📍 My location] [🔍 Search a place...]
```

- **My location** (default): GPS → fallback to last known → fallback to city center
- **Search a place**: autocomplete input → geocode → set as center point

On selecting a place, radius adjusts automatically (or user can tweak).

**Pro**: Two buttons. Covers 95% of intents. Scales to any city. No district maintenance.
**Con**: Loses "quick district tap" for locals. But locals know place names — autocomplete covers this.

## Recommended: Option F

### How It Works

#### First open
```
[📍 Using your location] [🔍 Or search a place...]
```
GPS requested → if granted, done. If denied, show search input.

#### User taps search
```
[🔍 "lisi la..." ]
  Lisi Lake           (2.1 km)
  Lisi Karting        (2.3 km)
  Lisi Swimming Pool  (2.5 km)
```

Results from **our own venues DB** first (free, fast, relevant), then geocode API fallback for addresses/areas.

#### After selection
```
📍 Near: Lisi Lake (2.1 km away)  [✕ clear]
```
Recommendations recalculate around selected point. Clear → back to GPS.

### Autocomplete: Our Venues vs External API

**Tier 1 — Our venues DB (free, instant)**:
```sql
SELECT name, name_en, lat, lng,
       ST_Distance(ST_MakePoint(lng,lat)::geography, ST_MakePoint($2,$1)::geography) AS dist
FROM venues
WHERE name ILIKE '%' || $3 || '%' OR name_en ILIKE '%' || $3 || '%'
ORDER BY dist
LIMIT 5;
```
3000+ venues with names in ka/en. Covers "Lisi", "Fabrika", "Opera", "Vake Park" etc.

**Tier 2 — Geocode API (fallback for addresses/areas)**:
Only called if venue search returns < 3 results. Options:
- Google Geocoding: $5/1000 calls
- Nominatim: free, self-hostable
- Mapbox: free tier available

For MVP: our venue DB only. Covers 90%+ of use cases.

### What Happens to Districts

- **Remove from onboarding** — replace with "Allow location" + "Or search a place"
- **Remove hardcoded district list** — no more per-city configuration
- **Keep city concept** — CityConfig still exists for OSM bbox, timezone, event sources
- **City detection** — auto-detect from GPS coordinates (reverse geocode) or let user set in settings

### Onboarding Change

Current 3 steps: interests → company+pet → location (district picker)

New 3 steps: interests → company+pet → location (GPS permission + fallback search)

```
Step 3: "Where are you?"
  [📍 Use my location]  ← primary CTA
  [🔍 Search a place]   ← secondary
  [Skip]                ← use city center
```

### Radius Behavior

| Source | Default radius | Adjustable |
|---|---|---|
| GPS (walking around) | 2-5 km | Yes, via slider/preset |
| Searched place (planning) | 3-5 km | Yes |
| City center (fallback) | 10 km | Yes |

User shouldn't think about radius explicitly. Presets help: "Час рядом" = 1.5km, "Evening" = 5km, default = context-dependent.

## Migration Path

### Phase 1 (MVP — minimal)
- Add search input to context bar (our venues DB autocomplete)
- Keep GPS as default
- Remove district picker from onboarding (replace with GPS + search)
- Delete hardcoded districts array

### Phase 2 (v1)
- Add geocode fallback (Nominatim or Google) for addresses
- "Recent locations" (last 3-5 searched places, stored in localStorage)
- Map tap as secondary option (in @defer)

### Phase 3 (v2)
- Saved locations ("Home", "Work", custom labels)
- Auto-detect city from coordinates
- Multi-city seamless experience

## API Impact

Zero API changes needed. `lat` and `lng` in recommendation request already accept any coordinates. The change is purely frontend — HOW we get those coordinates.

## Cost

| Component | Cost |
|---|---|
| Our venues DB autocomplete | Free |
| Nominatim geocode (self-hosted) | Free |
| Google Geocoding (if needed) | $5/1000 |
| Map tiles (if map picker added) | $7/1000 loads (Google) or free (Mapbox first 50K) |

MVP: **$0** — venue DB search only.
