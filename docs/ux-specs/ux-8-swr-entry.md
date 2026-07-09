# UX-8: Stale-While-Revalidate Entry

Priority: week 1
Effort: 3-4 hours

## Problem

Every app open shows loader animation even when context hasn't changed.
Returning users should see content instantly.

## Solution

Show last feed from cache immediately, then silently revalidate in background.

### Implementation

```typescript
// Cache in localStorage
const FEED_CACHE_KEY = 'ld_feed_cache';

interface FeedCache {
  cards: RecommendationCard[];
  timestamp: number;
  context: { lat: number; lng: number; interests: string[]; timeWindow: string };
}

// On app entry:
ngOnInit() {
  const cache = this.loadFeedCache();

  if (cache && !this.isContextChanged(cache.context)) {
    // Show cached feed immediately
    this.allCards.set(cache.cards);
    this.loaded.set(true);

    // Silent background revalidate
    this.silentRevalidate();
    return;
  }

  // No cache or context changed significantly → normal load with loader
  this.loadFeed();
}
```

### Context change detection

Revalidate silently (no loader) unless:
- Position moved > 500m
- Different timeWindow
- More than 6 hours elapsed
- Interests changed

If context changed significantly → show loader "пины сбегаются" as usual.

### Silent revalidate

```typescript
silentRevalidate() {
  this.api.discover(params).subscribe(res => {
    const changed = this.hasSignificantDifference(this.allCards(), res.cards);
    if (changed) {
      this.allCards.set(res.cards);
      // Optional: brief inline notification "Обновили под текущее время"
    }
    this.saveFeedCache(res.cards);
  });
}
```

### "Обновили" notification

If silent revalidate returns different results: subtle inline text
(not toast, not loader) above feed: "Обновили под текущее время" — auto-hide 3s.

### Loader policy after SWR

Feed loader "пины сбегаются" is used ONLY for:
- First-ever load (no cache)
- Explicit context change by user (preset tap, filter change)
- Significant context drift (>500m, different timeWindow)

NOT for: returning to app with valid cache.

## Files to modify

| File | Action |
|------|--------|
| `src/app/features/discover/discover.component.ts` | modify (SWR logic) |
| `src/app/core/utils/feed-cache.ts` | create (cache read/write) |
