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

### Scoring

Interest score = average of top 2 matching tag weights (from user's interest values 0.0-1.0). No match = 0.0.

### Hard Filter (no serendipity)

When user has explicit interests, candidates with **zero primary tags are excluded**. No serendipity pool — research (see `docs/research/categorization-and-ranking-strategy.md`) shows random unrelated venues are noise, not discovery. True serendipity must be *unexpected but relevant* (within the interest domain).

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

See `docs/research/company-context-strategy.md` for full research and Phase 2 plan (venue-level attributes).

## Distance Decay

```
distanceScore = max(0, 1 - distance_m / radiusM)
```

Linear decay. 0m = 1.0, radiusM = 0.0.

## Time Fit

- Events: based on `starts_at` position within `timeWindow` (early = 1.0, late = 0.7, outside = 0.3)
- Places: hardcoded 0.8 (TODO: parse `opening_hours`)

## Quality Score

From `places.quality_score` (0-1). Default 0.5 for OSM imports.

## Diversity Reranker

- Chain cap: max 1 per chain in top 20
- Category spread: max 2 same category consecutive (deferred cards dropped, not appended)

## Explanations

Generated post-scoring, priority-ordered:
1. `starts_in` — event starting within 2h
2. `walk_time` — if distance <= 2000m
3. `free` / `budget_fit` — price match
4. `matches_interest` — "Тебе нравится: nature" (user-facing interest name, not raw tag)
5. `highly_rated` — rating >= 4.5
6. `also_has` — "Также: café" (secondary tag hint for multi-profile venues)

## Response Fields

Each card in the response includes:
- `primaryTags` — tags that matched user interests (why it's shown)
- `secondaryTags` — other venue traits (what else is there)
- These are omitted when empty.
