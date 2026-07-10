# UX-22: Chain Venue Deprioritization

Priority: **week 1**
Effort: 2-3 hours

## Problem

"Decide for me" showing McDonald's or Starbucks kills the magic. User expects
a discovery — getting a chain they already know destroys trust in the product's
intelligence. Same applies to the main feed: chains are filler, not discovery.

## Current state

**Database has the data:**
- `places.is_chain` (boolean) — set during OSM import
- `places.chain_key` (text) — groups same-chain venues (e.g., "mcdonalds")

**But it's not used:**
- API response doesn't include `isChain` or `chainKey`
- Scoring diversity limits chains to 1 per category, but doesn't deprioritize
- "Decide for me" has a client-side keyword hack (fragile, English-only)

## Solution

### 1. API: pass `isChain` in card response

```typescript
// In recommendation.service.ts card builder
isChain: c.is_chain || false,
```

Add to `RecommendationCard` type:
```typescript
isChain?: boolean;
```

### 2. Scoring: chain penalty

In `scoreCandidate`, after company/pet modifiers:

```typescript
if (c.is_chain) {
  interestScore = interestScore * 0.7; // 30% penalty — chains are less "discovery"
}
```

This naturally pushes chains down without hard-filtering them.

### 3. "Decide for me": hard exclude chains

```typescript
readonly decideCards = computed(() => {
  const nonChain = this.cards().filter(c => !c.isChain && c.explanations?.length > 0);
  if (nonChain.length >= 2) return nonChain.slice(0, 4);
  return this.cards().filter(c => !c.isChain).slice(0, 4);
});
```

Remove client-side `CHAIN_KEYWORDS` hack.

### 4. Chain detection improvement

Current `is_chain` in DB may be incomplete. Improve with:
- Google types containing "chain" indicators
- Known chain list for Tbilisi (McDonald's, KFC, Wendy's, Subway, Dunkin',
  Starbucks, Costa Coffee, Carrefour, Spar, Goodwill, Nikora, Ori Nabiji)
- Venues with same `chain_key` appearing 3+ times = auto-mark as chain

### 5. Feed label (future)

Don't hide chains from feed entirely — some people want McDonald's.
But never show chains in:
- "Decide for me" (hard exclude)
- Top-3 positions of feed (soft — scoring penalty handles this)
- "Locals' choice" badge (K5, v2)

## Files to modify

| File | Action |
|------|--------|
| `apps/api/src/app/recommendation/recommendation.service.ts` | pass isChain, add scoring penalty |
| `libs/shared-models/src/lib/types.ts` | add isChain to RecommendationCard |
| `src/app/features/discover/discover.component.ts` | use isChain instead of keyword hack |
