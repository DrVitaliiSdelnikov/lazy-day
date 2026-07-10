# UX-22: Chain Venue Deprioritization

Priority: **week 1**
Effort: 4-5 hours (detection + scoring + cleanup)

## Problem

"Decide for me" showing McDonald's or Starbucks kills the magic. Chains in
top-3 of feed signal "generic catalog", not "smart discovery". But chains
shouldn't be hidden — at 2 AM McDonald's is better than nothing.

## Architecture: soft in feed, hard in "Decide for me"

Two layers:
1. **Scoring penalty** on final score (not interest component) — pushes chains down
2. **"Decide for me"** hard filter with graceful degradation

## 1. Scoring: final score multiplier (not interest penalty)

**Why NOT `interestScore * 0.7`**: interest match at Starbucks is real — you
like coffee, this is coffee. "Chainness" is about low discovery value, not
interest mismatch. Plus math: interest weighs 0.45, so ×0.7 = only −13.5%
of final score, and with weak interest match the penalty vanishes entirely.

**Correct approach**: multiply final score after all components.

```typescript
const CHAIN_SCORE_MULTIPLIER = 0.85; // config, not inline literal

// After all components and modifiers:
if (c.is_chain) finalScore *= CHAIN_SCORE_MULTIPLIER;
```

Effect is predictable and equal for all profiles. `score_breakdown` in
`interaction_events` preserves honest component scores + separate
`chainPenalty` field — clean signal for future re-ranking.

**Only for places** — events are never chain-penalized.

## 2. "Decide for me": graceful degradation

All three tiers must cascade to the end — empty result at 2 AM is worse
than a chain:

```typescript
readonly decideCards = computed(() => {
  const all = this.cards();
  const ideal = all.filter(c => !c.isChain && (c.explanations?.length ?? 0) > 0);
  if (ideal.length >= 2) return ideal.slice(0, 4);
  const nonChain = all.filter(c => !c.isChain);
  if (nonChain.length >= 2) return nonChain.slice(0, 4);
  return all.slice(0, 4); // at night, McDonald's is better than nothing
});
```

Remove client-side `CHAIN_KEYWORDS` hack after API provides `isChain`.

## 3. Chain detection (3 sources, ranked by reliability)

### Source A: OSM `brand:wikidata` (best, ~1.0 confidence)

OSM Name Suggestion Index tags chains with `brand` and `brand:wikidata`.
McDonald's, Starbucks, PSP, Aversi — all tagged.

```sql
-- In OSM import: detect chains by brand tag
is_chain = tags->>'brand:wikidata' IS NOT NULL
         OR tags->>'brand' IS NOT NULL;
```

One condition in OSM import. Highest confidence.

### Source B: Known chain list (manual, high confidence)

Tbilisi-specific chains not always in OSM brand:
```
McDonald's, KFC, Wendy's, Subway, Dunkin', Starbucks, Costa Coffee,
PSP, Entrée, Purpur, Dunkin' Donuts,
Aversi, GPC, PSP Pharmacy,
Nikora, Ori Nabiji, Carrefour, Spar, Goodwill
```

**Note on supermarkets**: see §5 below.

### Source C: `chain_key` frequency (careful, threshold 5+)

Venues with same `chain_key` appearing 5+ times → likely chain.

**Danger**: generic names like "თონე" (bakery), "Wine Shop", "Pharmacy"
produce false positives on independent venues. Maintain exclusion list:
```
თონე, tone, wine shop, wine bar, pharmacy, аптека, пекарня, bakery,
მარკეტი, mini market, shop
```

### What NOT to use

~~Google types "chain" indicator~~ — doesn't exist in Places API. No such
field or type. Remove to avoid searching for nonexistent data.

## 4. API: pass `isChain` in card response

```typescript
// In recommendation.service.ts card builder
isChain: c.is_chain || false,
```

Add to `RecommendationCard` type:
```typescript
isChain?: boolean;
```

**Never show "chain" label to user** — negative labeling of someone's
business is unnecessary. Flag works silently in scoring only.

## 5. Adjacent problem: supermarkets in leisure feed

Carrefour, Spar, Nikora, Ori Nabiji are grocery stores. If they appear in
a leisure discovery feed, the real bug is in category mapping — chain
penalty treats the symptom.

**Check**: how many `shop=supermarket` venues are in `places` with
`status=active`? If significant — exclude `supermarket` category from feed
entirely (same logic as `accessModel: 'membership'` for gyms).

```sql
SELECT COUNT(*) FROM places p
JOIN venues v ON p.venue_id = v.id
WHERE p.status = 'active' AND p.category IN ('supermarket', 'convenience');
```

## 6. Metrics

| Metric | Target | How to measure |
|---|---|---|
| Chain share in feed top-10 | < 10% | Sample 20 sessions, count chains in top-10 |
| Chain in "Decide for me" | 0% (unless only option) | interaction_events where eventType='decide_open' |
| False positive rate | < 5% | Manual review of 50 flagged `is_chain=true` venues |

## Files to modify

| File | Action |
|------|--------|
| `apps/api/src/app/recommendation/recommendation.service.ts` | final score multiplier, pass isChain |
| `apps/api/src/app/ingestion/osm-import.service.ts` | detect brand:wikidata in import |
| `libs/shared-models/src/lib/types.ts` | add isChain to RecommendationCard |
| `src/app/features/discover/discover.component.ts` | use isChain, remove CHAIN_KEYWORDS |
| `src/app/features/discover/decide-for-me/decide-for-me.component.ts` | graceful degradation |

## Implementation order

1. **OSM brand detection** — add `is_chain` flag based on `brand:wikidata` tag in import
2. **API pass-through** — `isChain` in card response
3. **Scoring multiplier** — `CHAIN_SCORE_MULTIPLIER = 0.85` on final score
4. **Client cleanup** — replace keyword hack with `isChain` from API
5. **Supermarket audit** — check and exclude if needed
6. **Validate** — manual sample of 50 flagged venues
