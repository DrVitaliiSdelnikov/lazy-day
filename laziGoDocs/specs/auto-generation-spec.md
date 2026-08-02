# LaziGo — Auto-Generation Route Spec

## Problem

Current `generate()` builds routes algorithmically from DB venues.
No curated quality, no context awareness (companions, nightlife), points cluster in one spot on short routes.

## Goal

Curated routes as primary source, dynamic generation as fallback.
Filters determine which route fits. Incompatible filters excluded at UI level.

---

## 1. Filters

### Primary (visible, chips)

**Mood** (single-select, default by time of day):
- Виды (scenic)
- Поесть (food)
- Культура (culture)
- Зелень (nature)
- Кофе (coffee)
- Вечерний движ (nightlife) — available only after 17:00

**Time** (single-select, default "2-3 часа"):
- ~1 час → Tier A routes
- 2-3 часа → Tier A-B routes
- Полдня → Tier B-C routes
- Весь день → Tier C routes

**Companions** (multi-select, can be empty):
- С детьми (kids)
- С собакой (dog)

### Compatibility matrix

| Mood | Kids | Dog |
|------|------|-----|
| scenic | yes | yes |
| food | yes | yes |
| culture | yes | no (museums don't allow dogs) |
| nature | yes | yes |
| coffee | yes | yes |
| nightlife | **no** | **no** |

**UI behavior:**
- Selecting "nightlife" → companions chips hide (animated collapse)
- Selecting "kids" or "dog" → "nightlife" chip becomes disabled (grayed, not hidden)
- Deselecting companions → "nightlife" re-enables
- Deselecting "nightlife" → companions re-appear

### Secondary (behind "Уточнить" expander)

- Темп: Не спеша / Обычно / Бодро (chips)
- Горки: Можно в горку / Полегче (chips, Tbilisi-specific)

---

## 2. Curated Routes (seed data)

### Source documents
- `compass_artifact_wf-7b61...` — 30 general routes (A1-A10, B1-B10, C1-C10)
- `compass_artifact_wf-b4e9...` — 10 nightlife routes (4 bar crawls, 3 techno, 3 mixed)
- `compass_artifact_wf-fb7b...` — 9 family routes (5 kids, 3 dog, 1 with 3 variants)

**Total: 49 curated routes.**

### DB schema

```sql
CREATE TABLE curated_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,        -- 'A1', 'B7', 'NIGHT_3', 'FAM_RIKE'
  tier TEXT NOT NULL,                -- 'easy', 'medium', 'full_day', 'night', 'family'
  theme TEXT NOT NULL,               -- 'Первый вкус Старого города'
  theme_en TEXT,
  moods TEXT[] NOT NULL,             -- ['scenic', 'culture']
  companions TEXT[] DEFAULT '{}',    -- ['kids'], ['dog'], ['kids','dog'], []
  duration_hours NUMERIC NOT NULL,   -- 1.5, 3, 7
  distance_km NUMERIC,
  terrain TEXT DEFAULT 'flat',       -- 'flat', 'uphill', 'steep'
  taxi_needed BOOLEAN DEFAULT false,
  points JSONB NOT NULL,             -- [{name, name_en, lat, lng, category, duration_min, note}]
  description TEXT,
  description_en TEXT,
  guide_notes TEXT,                   -- "friend voice" tips
  guide_notes_en TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE seen_routes (
  device_id TEXT NOT NULL,
  route_id UUID NOT NULL REFERENCES curated_routes(id),
  seen_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (device_id, route_id)
);
```

### Mood mapping per route

| Routes | Moods |
|--------|-------|
| A1, A3, A6, B1, B4, B6, C1, C5 | culture |
| A2, A4, A5, B2, B3, C3, C10 | scenic |
| A9, B7, B8, C6 | food |
| B3, B10, C4, C9 | nature |
| A7, A8, B5, B8, C6 | coffee |
| C8, NIGHT_1-10 | nightlife |
| A10, B10, FAM_1-9 | family (kids/dog) |

### Companions mapping

| Companions | Routes |
|------------|--------|
| kids | A10, B10, C9, FAM_RIKE, FAM_MTATSMINDA, FAM_VAKE, FAM_DEDAENA, FAM_MUSHTAIDI, FAM_WATERFRONT, FAM_BOTANICAL, FAM_MZIURI |
| dog | FAM_VAKE_DOG, FAM_TURTLE_DOG, FAM_LISI_DOG, FAM_WATERFRONT, FAM_MZIURI |
| kids + dog | FAM_DEDAENA, FAM_WATERFRONT, FAM_MZIURI |
| nightlife (no companions) | C8, NIGHT_1-10 |

---

## 3. Route Selection Logic

```
Input: mood, duration, companions[], device_id

1. Filter curated_routes:
   - mood IN route.moods
   - duration maps to tier(s)
   - companions compatibility:
     - companions = [] → any route WITHOUT companion restrictions
     - companions = ['kids'] → route.companions includes 'kids' OR route.companions = []
     - companions = ['dog'] → route.companions includes 'dog' OR route.companions = []
     - nightlife mood → companions must be []
   - NOT IN seen_routes for this device_id

2. If matches found:
   - Pick best match (prefer exact mood match > partial)
   - Return curated route with points + guide_notes
   - Add "Ещё интересные места" sidebar (45 POI minus points in route)

3. If no matches (all seen or no fit):
   - Return { allSeen: true }
   - Frontend shows: "Вы видели все наши подборки — соберите свой!"
   - Switch to manual mode

4. "Seen" tracking:
   - Mark as seen when user taps "Собрать заново" (rebuild)
   - NOT when they first see it (they might like it)
   - Endpoint: POST /v1/routes/mark-seen { deviceId, routeId }
```

### Duration → Tier mapping

| Duration filter | Tiers to search |
|----------------|-----------------|
| ~1 час | easy |
| 2-3 часа | easy, medium |
| Полдня | medium, full_day |
| Весь день | full_day |
| (nightlife) | night |

---

## 4. District Spreading (dynamic generation fallback)

When `generate()` runs dynamically (no curated route available):

**For "2-3 часа" duration:**
- Points must come from 2-3 neighboring districts (not cluster in one)
- Use `areas.bbox` to determine which district each venue belongs to
- After picking first point → next point must be in the same or adjacent district
- Adjacent = bbox overlaps or centers within 2km
- Minimum distance between consecutive points: 300m (no "across the street" hops)

**For "~1 час":**
- Points from 1-2 districts (shorter walk, tighter cluster is OK)

**For "Полдня" / "Весь день":**
- Points from 3-5 districts (wide coverage encouraged)
- Taxi segments expected between distant points

---

## 5. "Ещё интересные места" Sidebar

On result screen, next to the route timeline:

- Shows 45 curated POIs from compass_artifact Part 1
- Filtered: remove any POI already in the current route
- Sorted by distance from route centroid
- Each item: name, category icon, hook, "+" button to add
- Adding inserts into route (same as current "nearby" logic)
- Geolocation of user optionally reorders the route after adding

### POI source
- 45 POIs from compass_artifact (many already in DB as `must_see`)
- New ones need to be added via migration (match by name/coords to avoid duplicates)
- Stored with `walk_tier = 'curated'` to distinguish from OSM-imported venues

---

## 6. UX: "Собери мне" Screen

Per compass_artifact UX spec (hybrid B+C pattern):

**Single bottom sheet, NOT wizard:**
```
┌──────────────────────────────────┐
│ Окей, соберу за тебя             │
│ Пару штрихов — или жми "Собрать" │
│                                  │
│ Настроение                       │
│ [Виды] [Поесть] [Культура]       │
│ [Зелень] [Кофе] [Вечерний движ]  │
│                                  │
│ Сколько времени                  │
│ [~1ч] [2-3ч] [Полдня] [Весь день]│
│                                  │
│ С кем                (hidden if  │
│ [С детьми] [С собакой] nightlife)│
│                                  │
│ Уточнить (по желанию) ▸          │
│  (Темп, Горки — chips)           │
│                                  │
│ [  ✨ Собрать маршрут  ]         │  ← always active
└──────────────────────────────────┘
```

**"Собрать" always active** — zero input = smart defaults:
- Mood by time of day (morning=scenic, afternoon=culture, evening=food, night=nightlife)
- Duration = 2-3 часа
- Companions = none
- Start = geolocation

**After result:**
- "Не то?" → rebuild (marks current as seen, picks next curated)
- "Изменить" → manual mode with current points pre-selected
- "Ещё интересные места" → sidebar with 45 POI

---

## 7. Implementation Order

**Phase 1: Filters + UI** (~3h)
- Add nightlife mood chip
- Add companions chips (kids/dog)
- Compatibility matrix (hide/disable logic)
- Pass new params to API

**Phase 2: Seed curated routes** (~4h)
- Migration: `curated_routes` + `seen_routes` tables
- Seed 49 routes with points, moods, companions, tiers
- Match points to existing venues in DB by name/coords

**Phase 3: Selection logic** (~3h)
- Endpoint: select curated route by filters
- Seen tracking (mark on rebuild)
- allSeen fallback → switch to manual
- "Ещё интересные места" endpoint (45 POI minus route points)

**Phase 4: District spreading** (~2h)
- Assign districts to venues via areas.bbox
- Spreading logic in `generate()` for dynamic fallback
- Min 300m between points

**Phase 5: 45 POI migration** (~2h)
- Match existing venues, add missing ones
- Set walk_tier = 'curated' for new POIs

---

## 8. NOT doing now

- Bottom sheet redesign (current form layout works, optimize later)
- "Как в прошлый раз" (remember last filters) — after user data
- Post-hoc refine chips ("Быстрее / Короче") — after baseline works
- Hills filter (behind expander, phase 2+)
- Weather-based defaults (have data, but low priority)
