# Scoring & Ranking

## Overview

Recommendation engine scores candidates using weighted formula:

```
score = 0.45 * interest + 0.25 * distance + 0.15 * time + 0.10 * quality + 0.05 * source
```

After scoring: sort descending, apply diversity reranker (category spread + chain cap), take top 30.

## Dynamic Primary / Secondary Tags

Each venue's tags are classified dynamically **per request** based on user interests:

- **Primary tags**: tags that match the user's expanded interests — why the venue is relevant
- **Secondary tags**: remaining tags — additional traits of the venue

The same venue gets different classification depending on the request:
```
Park with café:
  User asks "nature" → primary: [outdoor, park], secondary: [food, cafe]
  User asks "food"   → primary: [food, cafe],    secondary: [outdoor, park]
```

This replaces static single-category assignment. No DB changes needed — classification happens at query time in `scoreCandidate()`.

## Interest Matching

### Interest Synonym Map

User interests map to DB tags via `INTEREST_SYNONYMS`:
```
nature   -> [outdoor, park, garden, viewpoint]
spa      -> [bath, swimming]
bath     -> [bath]
food     -> [food, restaurant, cafe, bakery]
nightlife -> [nightlife, bar, club]
culture  -> [culture, museum, gallery, theater]
sports   -> [gym, sports]
```
Note: `wellness` tag intentionally excluded — shared between spa and gym, causes false matches.

### Interest Weight Semantics

Weight value determines how the interest affects filtering:

| Weight | Semantics | Behavior |
|---|---|---|
| 0.7 – 1.0 | "I want this" (strict) | Hard filter: venue MUST match at least one strict tag |
| 0.3 – 0.6 | "I prefer this" (soft) | Scoring boost only, no filtering |
| 0.0 – 0.2 | Neutral / ignored | Interest excluded from matching entirely |

### Scoring

Interest score = average of top 2 matching tag weights. No match = 0.0.

Examples:
- `{ nature: 1.0, food: 0.3 }` → hard filter by nature (strict), food boosts score but doesn't add venues
- `{ nature: 0.5, food: 0.5 }` → all soft, no hard filter, both contribute to scoring mix
- `{ food: 0.2 }` → below threshold, treated as "no interests" (show everything)

### Hard Filter

When strict interests exist (weight >= 0.7): venues must match at least one strict tag.
When only soft interests: no hard filter, just scoring.

### Adaptive Radius Fill

If fewer than 5 relevant results at the requested radius, the system expands radius x1.5 (up to 2 attempts, max ~2.25x original) to find more matching venues instead of padding with irrelevant ones.

## Company Context Modifier

After base interest score, a company-specific boost/penalty is applied based on venue tags.

| Company | Boosted tags (×1.3) | Penalized tags (×0.3) |
|---|---|---|
| solo | — | — |
| couple | viewpoint, restaurant, cafe, bar, park, garden, attraction | playground, family |
| family | park, playground, family, museum, swimming, outdoor | nightlife, bar, club |
| friends | bar, restaurant, nightlife, club, entertainment, sports | — |

Penalty does not hard-filter — it demotes. If user explicitly asked for nightlife as family, bars still appear but ranked lower.

Response includes `company_fit` explanation: "Подходит для пары", "Для всей семьи", "Отлично с друзьями".

### Pet-Friendly Modifier

Independent of company — applied on top when `profile.hasPet = true`.

| Boosted (×1.3) | Penalized (×0.3) |
|---|---|
| outdoor, park, garden, viewpoint, playground | museum, cinema, mall, theater, gallery, library |

Restaurants/cafes are neutral — some have terraces, but without venue-level data we don't guess.

Explanation: "Можно с питомцем" on boosted outdoor venues.

See `docs/research/company-context-strategy.md` for full research and Phase 2 plan (venue-level attributes).

## Distance Decay

```
distanceScore = max(0, 1 - distance_m / radiusM)
```

Linear decay. 0m = 1.0, radiusM = 0.0.

## Time Fit

- Events: based on `starts_at` position within `timeWindow` (early = 1.0, late = 0.7, outside = 0.3)
- Places with `opening_hours`: parsed via `opening-hours.ts`, checked against time window midpoint
  - Open → `timeFit = 1.0`
  - Closed → `timeFit = 0.0` (effectively demoted or filtered out)
  - Unknown → `timeFit = 0.8` (neutral)
- Places without `opening_hours`: `timeFit = 0.8` (1,761/2,976 have hours: 1,497 Google + 264 OSM)

### opening_hours parser

Lightweight parser for OSM format. Handles:
- `24/7`
- Simple ranges: `08:00-24:00`
- Day prefixes: `Mo-Su 10:00-22:00`, `Tu-Su 11:00-18:00`
- Semicolon rules: `Mo-Fr 09:00-22:00; Sa-Su 10:00-22:00`
- Comma time ranges: `Mo-Su 09:00-14:00,16:00-21:00`
- Overnight spans: `Mo-Su 18:00-02:00`

Does NOT handle: public holidays (PH), week numbers, month ranges.

## Quality Score

From `places.quality_score` (0-1). Default 0.5 for OSM imports.

## Rating

Google rating preferred over OSM: `google_rating > rating`. 1,722 venues have Google ratings (avg 4.42).
Used in `highly_rated` explanation (>= 4.5) and returned in response `rating` field.

## Diversity Reranker

- Chain cap: max 1 per chain in top 20
- Category spread: max 2 same category consecutive (deferred cards dropped, not appended)

## Explanations

Generated post-scoring, priority-ordered (max 3 per card):

| Priority | Type | Label example | When |
|---|---|---|---|
| 1 | `open_now` | "Сейчас открыто" | Place has opening_hours and is open at requested time |
| 1 | `starts_in` | "Начало через 45 мин" | Event starting within 2h |
| 2 | `walk_time` | "27 мин пешком" | Distance <= 2000m |
| 3 | `free` / `budget_fit` | "Бесплатно" / "В бюджете" | Price match |
| 4 | `matches_interest` | "Тебе нравится: nature" | Primary tag matches user interest (user-facing name) |
| 4 | `company_fit` | "Подходит для пары" / "Для всей семьи" / "Отлично с друзьями" | Company boost applied |
| 4 | `pet_friendly` | "Можно с питомцем" | hasPet + outdoor venue boosted |
| 5 | `highly_rated` | "Высокий рейтинг" | Rating >= 4.5 |
| 6 | `also_has` | "Также: café" | Secondary tag hint for multi-profile venues |

## Response Fields

Each card in the response includes:
- `primaryTags` — tags that matched user interests (why it's shown)
- `secondaryTags` — other venue traits (what else is there)
- `openStatus` — "Открыто" / "Закрыто" / undefined (when hours unknown)
- Tags and openStatus are omitted when empty/unknown.
