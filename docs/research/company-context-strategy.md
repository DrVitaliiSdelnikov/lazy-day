# Research: Company Context (solo/couple/family/friends) — Strategy

## Current State

`company` field exists in frontend (onboarding, context bar, settings) and is sent to API in `profile.company`. But API **completely ignores it** — no scoring, no filtering, no effect on results.

DB has `company_type` enum created in migration 002 but no table uses it.

## Research Findings

### How Industry Leaders Handle Social Context

**Yelp** — structured venue attributes:
- API `attributes` parameter: `GoodForKids`, `DogsAllowed`, and similar boolean flags per venue.
- Category aliases: `kids_activities` as a searchable category.
- Attributes are **venue-side metadata**, not user-side context. The user filters by them explicitly.

**Foursquare** — venue attributes:
- Structured boolean attributes: `wheelchair_accessible`, `outdoor_seating`.
- No explicit "good for groups/kids" attributes in core API.
- Category hierarchy handles this implicitly: "Playground" is inherently family-friendly.

**TripAdvisor** — "Travelling as" filter:
- Reviews tagged by travel context: solo, couple, family, friends, business.
- Users filter reviews by matching context — not venues, but **opinions about venues**.
- Research finding: satisfaction ratings differ significantly by group type. Couples give highest hotel ratings, business travelers lowest.
- Key insight: the **same venue** gets different scores from different group types.

**Google Maps** — implicit:
- "Popular with tourists", "Local favorites" — crowd-derived context.
- No explicit solo/family filter. Uses behavioral signals instead.

### Academic Research

**GEVR (Group Event Venue Recommendation)**:
- Separates individual preference generation from group aggregation.
- Different group decision strategies for different social relationship strengths.
- Key: group composition changes how individual preferences combine, not what venues exist.

**Context-Aware Group POI Recommendation (KCGRS, 2025)**:
- POI preference depends on the group AND context (time, previous visits).
- Uses knowledge graphs to learn domain-specific embeddings.

**Key academic consensus**:
- Social context (who you're with) is a **post-filter / re-ranking signal**, not a hard filter.
- It modifies the scoring weights, not the candidate pool.
- A park is still a park for solo or family — but a **nightclub** is irrelevant for family.

---

## Analysis: Three Possible Approaches

### Approach A: Tag Boost/Penalty Matrix (Recommended)

Each company type defines boost/penalty multipliers for tags. Applied as a modifier to `interestMatch`.

```
COMPANY_TAG_MODIFIERS:

solo:
  boost: []                    // neutral — no modification
  penalty: []                  // solo can go anywhere

couple:
  boost: [viewpoint, restaurant, bar, cafe, park, garden]  // romantic spots
  penalty: [playground, family]                             // less relevant

family:
  boost: [park, playground, family, museum, swimming]       // kid-friendly
  penalty: [nightlife, bar, club]                           // inappropriate

friends:
  boost: [bar, restaurant, nightlife, club, entertainment, sports]
  penalty: []                                                // friends go anywhere
```

**How it works**:
- After computing `interestScore`, apply company modifier:
  - Tag in `boost` list → score × 1.3
  - Tag in `penalty` list → score × 0.3
  - No match → no change
- This means: family asking for "nature" gets parks boosted AND playgrounds boosted, nightclubs penalized.
- Solo asking for "nature" gets the same parks with no modification.

**Pros**: Simple, predictable, no new data needed. Works with existing tags.
**Cons**: Static rules, not learned from behavior. May miss nuances.

### Approach B: Venue Suitability Attributes (Yelp-style)

Add boolean attributes to places: `good_for_kids`, `good_for_groups`, `romantic`, `outdoor_seating`.

```sql
ALTER TABLE places ADD COLUMN attributes jsonb DEFAULT '{}';
-- { "good_for_kids": true, "outdoor_seating": true, "romantic": false }
```

**How it works**:
- When `company = family`, boost venues where `attributes.good_for_kids = true`.
- When `company = couple`, boost venues where `attributes.romantic = true`.

**Pros**: More accurate per-venue. Venue-specific, not category-level.
**Cons**: Requires data enrichment. OSM has very limited attribute data. Need Google Places API or manual curation.

### Approach C: Hybrid — Tag Matrix Now + Attributes Later

Start with Approach A (tag boost/penalty — works immediately with existing data).
Add Approach B attributes when data sources become available (Google Places, user feedback "is this kid-friendly?").

When both exist: `companyModifier = tagModifier × 0.5 + attributeModifier × 0.5`

---

## Recommendation: Approach C (Hybrid)

### Phase 1 — Implement Now (Tag Boost/Penalty Matrix)

```typescript
const COMPANY_MODIFIERS: Record<string, { boost: string[]; penalty: string[] }> = {
  solo: { boost: [], penalty: [] },
  couple: {
    boost: ['viewpoint', 'restaurant', 'cafe', 'bar', 'park', 'garden', 'attraction'],
    penalty: ['playground', 'family'],
  },
  family: {
    boost: ['park', 'playground', 'family', 'museum', 'swimming', 'outdoor'],
    penalty: ['nightlife', 'bar', 'club'],
  },
  friends: {
    boost: ['bar', 'restaurant', 'nightlife', 'club', 'entertainment', 'sports'],
    penalty: [],
  },
};
```

Apply in `scoreCandidate()`:
```typescript
// After base interestScore calculation:
if (company && COMPANY_MODIFIERS[company]) {
  const mod = COMPANY_MODIFIERS[company];
  const hasBoostedTag = tags.some(t => mod.boost.includes(t));
  const hasPenaltyTag = tags.some(t => mod.penalty.includes(t));

  if (hasBoostedTag) interestScore = Math.min(1.0, interestScore * 1.3);
  if (hasPenaltyTag) interestScore = interestScore * 0.3;
}
```

**Penalty behavior**: `family` + `nightlife` venue:
- If user asked for "nightlife" (interest=1.0), penalty reduces to 0.3 → still shows but ranked very low.
- If user didn't ask for nightlife, interestScore is already 0.0 → hard-filtered out.
- This means: family never sees nightclubs unless they explicitly asked for them.

**Boost behavior**: `couple` + park with viewpoint:
- viewpoint tag already matched by "nature" interest → interestScore boosted 1.3x → ranked higher.
- A restaurant nearby that matched "food" interest also gets couple boost → both compete fairly.

### Phase 2 — Future (Venue Attributes)

- Add `attributes jsonb` column to places.
- Enrich from Google Places API (`wheelchair_accessible`, `outdoor_seating`, `good_for_children`).
- Add user feedback mechanism: "Is this kid-friendly?" → crowdsource attributes.
- Combine tag-level and attribute-level modifiers.

### Edge Cases

| Scenario | Behavior |
|---|---|
| `company = null` | No modification — same as solo |
| `company = family` + `interests = { nightlife: 1 }` | Nightclub gets penalty (×0.3) but still shows — user explicitly asked |
| `company = couple` + `interests = { nature: 1 }` | Viewpoints get boost, playgrounds get penalty — romantic nature |
| `company = friends` + no interests | No interest filter active, friends boost applied to bars/restaurants |
| Venue has both boosted AND penalized tags | Both apply: boost × penalty = e.g., 1.3 × 0.3 = 0.39 |

### Explanation Integration

New explanation type when company modifier was decisive:
```typescript
{ type: 'company_fit', label: 'Подходит для пары' }  // couple + viewpoint
{ type: 'company_fit', label: 'Для всей семьи' }      // family + playground
```

---

## Sources

- [GEVR: Event Venue Recommendation for Groups](https://arxiv.org/pdf/1903.10512)
- [Knowledge-based Context-Aware Group Recommender (KCGRS)](https://www.sciencedirect.com/science/article/abs/pii/S0167923625000867)
- [Group Learning in Recommendation Systems](https://www.nature.com/articles/s41598-026-36356-x)
- [TripAdvisor "Travelling as" Rating Differences](https://www.sciencedirect.com/science/article/abs/pii/S1567422317300625)
- [Yelp API Attributes](https://docs.developer.yelp.com/docs/plans)
- [Foursquare Categories and Attributes](https://docs.foursquare.com/data-products/docs/categories)
- [Context Boosting Collaborative Recommendations](https://www.researchgate.net/publication/222547572_Context_Boosting_Collaborative_Recommendations)
- [Top-k Context-Aware Tour Recommendations for Groups](https://link.springer.com/chapter/10.1007/978-3-030-04497-8_15)
