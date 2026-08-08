# LaziGo — Scoring Engine Deep Dive

## Overview

Every place/event gets a score 0.0-1.0+ that determines its position in the feed.
Score = weighted sum of 5 base components + additive modifiers.

Source: `apps/api/src/app/recommendation/recommendation.service.ts` → `scoreCandidate()`

---

## 1. Base Formula

```
score = 0.45 * interestScore
      + 0.25 * distanceDecay
      + 0.15 * timeFit
      + 0.10 * cardQuality
      + 0.05 * sourceConfidence
      + petBoost          (0 to 0.25, additive)
      + personalization   (0 to 0.20, additive, ramps over 15 signals)
      + priceBoost        (0 to 0.06, additive)
```

**Weights** (`WEIGHTS` const):
| Component | Weight | Range | Meaning |
|-----------|--------|-------|---------|
| interestMatch | 0.45 | 0.0 - 1.0 | How well venue matches user interests |
| distanceDecay | 0.25 | 0.0 - 1.0 | Linear decay: `1 - distance/radius` |
| timeFit | 0.15 | 0.0 - 1.0 | Is venue open/relevant at requested time? |
| cardQuality | 0.10 | 0.0 - 1.0 | Data completeness (quality_score + photo bonus) |
| sourceConfidence | 0.05 | 0.6 (fixed) | Source reliability (all canonical = 0.6) |

---

## 2. Interest Score (0.45 weight)

### How interests map to venue tags

User says "food" → engine expands via `INTEREST_SYNONYMS`:
```
food → [food, restaurant, cafe, bakery, bar, fast_food, wine, brewery, ...]
```

Each venue has `tags[]` from OSM/enrichment. Engine matches tags against expanded interests.

### Calculation

1. For each venue tag, check if it's in `expandedWeights` map
2. Matching tags → `primaryTags`, non-matching → `secondaryTags`
3. `interestScore` = average of top-2 matching weights

```
No interests specified → 0.5 (neutral)
No tags match         → 0.0
1 tag matches (w=0.8) → 0.8
2 tags match (0.8+0.6)→ 0.7 (average)
```

### Interest weight semantics

| Weight | Meaning | Effect |
|--------|---------|--------|
| >= 0.7 | **Strict** ("I want this") | Hard filter: venue MUST match at least one strict tag |
| 0.3-0.6 | **Soft** (mild preference) | Scoring boost only, no filtering |
| < 0.3 | **Ignored** | Below threshold, not used |

### Presets → Interests

Each mood preset maps to a fixed interest set:
```
chill    → {nature: 0.8, outdoor: 0.6, park: 0.4}
food     → {food: 1.0, restaurant: 0.8, cafe: 0.6, bakery: 0.4}
culture  → {culture: 1.0, museum: 0.8, gallery: 0.7, theater: 0.6}
nightlife→ {nightlife: 1.0, bar: 0.8, club: 0.7}
...
```

---

## 3. Distance Decay (0.25 weight)

```
distance = 1 - (venue_distance_m / search_radius_m)
```

| Distance | Radius 4km | Radius 10km |
|----------|-----------|-------------|
| 0 m | 1.00 | 1.00 |
| 500 m | 0.875 | 0.95 |
| 2 km | 0.50 | 0.80 |
| 4 km | 0.00 | 0.60 |
| 10 km | - | 0.00 |

**Events without venue**: distance = 0.85 (don't sink when radius expands)

---

## 4. Time Fit (0.15 weight)

Checks if venue is open/relevant at requested time using `checkOpenStatus()`.

| Status | timeFit |
|--------|---------|
| Open | 1.0 |
| Opens soon (< 1hr) | 0.7 |
| Unknown hours | 0.5 |
| Closed | 0.0 (hard filtered out) |

Events: always 1.0 if within timeWindow.

---

## 5. Card Quality (0.10 weight)

```
quality = quality_score (0.0-1.0 from DB) + (hasPhoto ? 0.15 : 0)
```

`quality_score` based on data completeness (rating, hours, description, etc.)

---

## 6. Modifiers (additive)

### 6.1 Pet Boost (when `hasPet: true`)

**Additive** — adds directly to final score, not multiplicative.

| Condition | petBoost | Source |
|-----------|----------|--------|
| `allowsDogs: true` | +0.25 | Google Atmosphere API |
| `outdoorSeating: true` | +0.15 | Google Atmosphere API |
| `allowsDogs: false` + no outdoor | penalty: interestScore × 0.1 | Google |
| Tag proxy (terrace/outdoor/garden) | +0.12 | OSM/enrichment tags |
| Tag penalty (indoor-only tags) | interestScore × 0.3 | OSM tags |

### 6.2 Company Modifier

Multiplicative on interestScore:

| Company | Boost tags | Penalty tags | Effect |
|---------|-----------|-------------|--------|
| family | park, playground, family_friendly | nightlife, club, bar | ×1.3 / ×0.3 |
| couple | viewpoint, romantic, wine | fast_food | ×1.3 / ×0.3 |
| friends | bar, entertainment, social | - | ×1.3 |
| solo | cafe, museum, quiet | - | ×1.3 |

**Google attribute**: family + `goodForChildren: true` → ×1.3 boost (fact-based, overrides tags)

### 6.3 Chain Penalty

Chains (McDonald's, Starbucks) get multiplied by:
- Tourist: ×0.90
- Local: ×0.80
- Default: ×0.85

### 6.4 Personalization (TasteProfileService)

Cosine similarity between user's facet profile and venue facets.
- Weight `w_personal`: 0 → 0.20 (ramps up over 15 interactions)
- Cold start: w_personal = 0, no effect
- After 15 signals: up to +0.20 additive

### 6.5 Price Boost

Gaussian fit between user's preferred price tier and venue's price tier.
- Max boost: +0.06 (β coefficient)
- No price data: no effect

---

## 7. Post-scoring Pipeline

After scoring, several steps modify the final result set:

### 7.1 Hard Filters (before scoring)

- Hidden venues (`hiddenIds`) removed
- Budget filter (if set)
- Interest hard filter: strict interests (≥0.7) require at least one tag match
- **Events bypass**: events pass hard filter for culture/active/nightlife/entertainment/food

### 7.2 Availability Filter

- Closed venues removed (open/unknown kept)
- Events within timeWindow kept

### 7.3 Facet Filter

If user selected facets (e.g. "date_night"), only venues with ALL selected facets kept.

### 7.4 Diversity (MMR-style)

`applyDiversity()`: ensures variety in results
- λ = 0.6 (relevance vs diversity balance)
- Prevents 15 cafes in a row — mixes categories

### 7.5 Impression Discount

`0.85^n` where n = number of times shown without engagement.
- First show: ×1.0
- Shown 3 times, not clicked: ×0.61

### 7.6 Session Dithering

Deterministic noise (mulberry32 PRNG with session seed).
- Prevents identical results across refreshes
- Same session = same order (pagination-safe)

### 7.7 Epsilon Exploration

1 in 8 slots replaced with an "explore" candidate:
- Not in current results
- Has some interest match (≥0.3)
- Cold venues prioritized (no Google rating = bonus)
- Never-shown venues prioritized

### 7.8 Adaptive Radius

If fewer than 5 relevant results → expand radius ×1.5 (up to 2× original).

### 7.9 Night Fallback

If late night (21:00-06:00) and few results → re-run with tomorrow's timeWindow.
typeFilter respected in fallback.

---

## 8. Scoring Examples

### Example 1: Nearby restaurant, user wants food

```
interestScore = 1.0 (food matches food)
distance = 0.9 (400m in 4km radius)
timeFit = 1.0 (open)
quality = 0.65 (has photo)
source = 0.6

score = 0.45×1.0 + 0.25×0.9 + 0.15×1.0 + 0.10×0.65 + 0.05×0.6
      = 0.45 + 0.225 + 0.15 + 0.065 + 0.03
      = 0.92
```

### Example 2: Same restaurant but user has pet

```
base = 0.92
petBoost = 0.25 (allowsDogs: true)
score = 0.92 + 0.25 = 1.17 → sorts above non-pet places
```

### Example 3: Far museum, user wants culture

```
interestScore = 0.9 (culture + museum match)
distance = 0.3 (2.8km in 4km radius)
timeFit = 1.0 (open)
quality = 0.5 (no photo)
source = 0.6

score = 0.45×0.9 + 0.25×0.3 + 0.15×1.0 + 0.10×0.5 + 0.05×0.6
      = 0.405 + 0.075 + 0.15 + 0.05 + 0.03
      = 0.71
```

---

## 9. Key Design Decisions

1. **Distance is NOT king** (0.25 weight). A great match 2km away beats a mediocre match 200m away.
2. **Pet boost is additive, not multiplicative**. Old ×1.5 on interestScore was invisible when interestScore was already at cap. Additive +0.25 always works.
3. **Events bypass interest hard filter**. Music events don't have "culture" tags but should show for culture users.
4. **Diversity prevents category flooding**. MMR λ=0.6 ensures you don't get 15 cafes.
5. **Impression discount prevents stale feeds**. 0.85^n pushes seen-but-ignored places down.
6. **Chain penalty** keeps McDonald's below local gems.
