# UX-5: Daily Feed Rotation

Priority: week 1-2
Effort: 2-3 hours

## Problem

Deterministic scoring = identical feed every day = "app is dead".

## Solution

Tie-breaker sort: seed from date (`hash(deviceId + YYYY-MM-DD)`) shuffles
cards with |Δscore| < 0.05. Top-3 untouched (trust in quality).

### Implementation

In `recommendation.service.ts`, after final scoring and sort:

```typescript
function rotateNearScores(cards: ScoredCard[], seed: string): ScoredCard[] {
  const top3 = cards.slice(0, 3);
  const rest = cards.slice(3);

  // Group cards with similar scores (|Δ| < 0.05 from neighbor)
  // Within each group, shuffle deterministically using seed
  const hash = simpleHash(seed);  // simple string → number hash
  const shuffled = rest.sort((a, b) => {
    if (Math.abs(a.totalScore - b.totalScore) < 0.05) {
      return ((simpleHash(seed + a.id) % 1000) - (simpleHash(seed + b.id) % 1000));
    }
    return b.totalScore - a.totalScore;
  });

  return [...top3, ...shuffled];
}
```

Seed: `deviceId` from request header (or fallback to session ID) + `YYYY-MM-DD`.

### New events boost

Events that appeared in database within last 24 hours: +0.05 to source component.
Field: `created_at` on venue/event entity.

## Files to modify

| File | Action |
|------|--------|
| `apps/api/src/app/recommendation/recommendation.service.ts` | modify (rotation + event boost) |
