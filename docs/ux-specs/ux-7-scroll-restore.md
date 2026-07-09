# UX-7: Scroll Position Restore

Priority: week 1
Effort: 3-4 hours

## Problem

Returning from detail page re-fetches feed and resets scroll to top.
User loses their position — especially painful on mobile where detail is a full page.

## Solution

Cache last feed response + scroll position. Restore on back-navigation without re-fetch.

### Implementation

```typescript
// In discover component
private feedCache = signal<{ cards: RecommendationCard[]; scrollY: number } | null>(null);

// Before navigating to detail:
onOpenDetail(card: RecommendationCard) {
  this.feedCache.set({
    cards: this.allCards(),
    scrollY: window.scrollY,
  });
  // navigate...
}

// On init, check if returning from detail:
ngOnInit() {
  const cache = this.feedCache();
  if (cache && this.isBackNavigation()) {
    this.allCards.set(cache.cards);
    this.loaded.set(true);
    requestAnimationFrame(() => window.scrollTo(0, cache.scrollY));
    return;
  }
  // normal init...
}
```

### Back-navigation detection

Use Angular Router events or `NavigationEnd` with `navigation.extras.state`.
Or simpler: set a flag `navigatedToDetail = true` before navigation, check on init.

### Desktop modal

Desktop already shows detail in modal overlay — scroll restore is automatic
(feed stays in background). No change needed for desktop.

### Cache invalidation

Clear `feedCache` when:
- User changes filters/preset/context (new feed request)
- User explicitly refreshes
- More than 5 minutes elapsed (data may be stale)

## Files to modify

| File | Action |
|------|--------|
| `src/app/features/discover/discover.component.ts` | modify (cache, restore) |
