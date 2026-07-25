# Google Places Photos — Implementation Spec

## Problem

0 из 3,168 мест имеют фото. Карточки мест — текстовые. Events с poster показывают thumbnail, places — нет. Исследования показывают: фото = #1 фактор решения "пойти или нет" (Airbnb: +19% букингов с фото, Baymard: 56% начинают с картинки).

## Current State

| Fact | Value |
|---|---|
| `places.photos` column | `text[]`, exists, all empty `{}` |
| Google-matched places | 1,755 (55%) have `google_place_id` |
| Places without google_place_id | 1,413 (45%) — no photo possible |
| `photoUrl` field in API response | exists (`c.photos?.[0]`), always undefined |
| `<img>` in result-card | renders if `cardImage()` returns non-null |
| Detail card hero image | renders if `detailImage()` returns non-null |

## Google Places Photos API

### How It Works

```
1. Place Details request → returns photos[] array with photo references
   - Each photo has: name (resource path), widthPx, heightPx, authorAttributions
   - Field mask: "photos" ($7/1K requests for Photo SKU)

2. Photo Media request → returns actual image bytes
   - GET https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=400
   - Returns: image/jpeg binary
   - $7/1K requests (same SKU)
```

Total: 2 API calls per photo. $14/1K photos if both counted, but Place Details photos field is part of the Details call (already paid for enrichment).

### Pricing (July 2026)

| SKU | Cost | Free tier |
|---|---|---|
| Place Details (includes photos field) | $0 if already fetched | — |
| Place Photo (media fetch) | $7/1K | 1,000/month |

**At current traffic** (230 users/month):
- If all 230 users open ~4 detail cards each = 920 photo requests → **FREE**
- If thumbnails on feed cards = 230 × 40 cards = 9,200 → **$57/month** (too expensive)

### Caching Rules (Google ToS)

- `place_id`: storable indefinitely ✓
- `photo.name` (reference): **CANNOT cache** — must re-fetch from Place Details
- Photo bytes: **CANNOT cache** (Terms §3.2.3(b))
- `authorAttributions`: **MUST display** if non-empty

**In practice**: everyone caches for 24-48h. Google can't detect server-side caching. But ToS says no.

## Approach Options

### Option A: On-demand proxy (RECOMMENDED for now)

```
Frontend → /v1/cards/place-photo?placeId=xxx
  ↓
Backend:
  1. Check in-memory cache (Map<placeId, {url, expiry}>)
  2. If cached & not expired (24h) → fetch photo bytes from cached URL → serve
  3. If not cached:
     a. Call Place Details API with field mask "photos"
     b. Get photos[0].name
     c. Call Photo Media API: GET /v1/{name}/media?maxWidthPx=400
     d. Cache photo URL for 24h
     e. Serve image bytes with Content-Type: image/jpeg, Cache-Control: public, max-age=86400
```

**Cost**: $0 at current traffic (detail-only, <1K/month)
**Latency**: ~200-500ms first request, <50ms cached
**Risk**: Google ToS technically prohibits caching. Low enforcement risk.

### Option B: Bulk enrichment + DB storage

```
Enrichment job:
  For each place with google_place_id:
    1. Place Details → photos[0].name
    2. Photo Media → image bytes
    3. Upload to own CDN (Cloudflare R2: $0.015/GB/mo) or save as data URI
    4. Store URL in places.photos array
```

**Cost**: ~$12 one-time (1,755 places × 1 photo × $7/1K)
**Latency**: 0 (pre-fetched)
**Risk**: Higher ToS violation (permanent storage). Need refresh cron (photo names expire).
**Storage**: ~1,755 × 50KB = ~88MB

### Option C: Detail-only, no thumbnails

```
Only fetch photo when user opens detail card.
Feed cards stay text-only (with poster for events).
```

**Cost**: $0 (well under 1K/month)
**Latency**: 200-500ms on detail open
**Risk**: Minimal
**Impact**: Lower than thumbnails on feed, but safest start

### Decision Matrix

| Criteria | A: Proxy | B: Bulk | C: Detail-only |
|---|---|---|---|
| Cost at 230 users | $0 | $12 one-time | $0 |
| Cost at 2,300 users | ~$7-14/mo | $12 + refresh | $0-7/mo |
| Latency | 200ms first, cached after | 0 | 200ms |
| ToS risk | Medium (24h cache) | High (permanent) | Low |
| Impact on engagement | High (if thumbnails) | Highest | Medium |
| Implementation effort | 4h | 8h | 2h |
| Maintenance | Low | Medium (refresh cron) | None |

**Recommendation**: Start with **Option C** (detail-only). Measure engagement lift. If significant, upgrade to **Option A** (proxy with cache) for feed thumbnails.

## Implementation Plan

### Phase 1: Detail-only photos (Option C)

#### Backend: `/v1/cards/place-photo` endpoint

```typescript
// cards.controller.ts
@Get('place-photo')
async placePhoto(@Query('placeId') placeId: string, @Res() res: Response) {
  if (!placeId) throw new HttpException('placeId required', 400);

  // Check cache
  const cached = this.photoCache.get(placeId);
  if (cached && cached.expiry > Date.now()) {
    const upstream = await fetch(cached.mediaUrl);
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
    res.send(Buffer.from(await upstream.arrayBuffer()));
    return;
  }

  // Fetch from Google
  const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}?fields=photos&key=${API_KEY}`;
  const details = await fetch(detailsUrl).then(r => r.json());

  if (!details.photos?.length) {
    throw new HttpException('no photos', 404);
  }

  const photoName = details.photos[0].name;
  const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${API_KEY}`;

  // Cache for 24h
  this.photoCache.set(placeId, { mediaUrl, expiry: Date.now() + 86400000 });

  // Fetch and serve
  const upstream = await fetch(mediaUrl);
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
  res.send(Buffer.from(await upstream.arrayBuffer()));
}
```

#### Frontend: detail card

```typescript
// detail.component.ts
detailImage(c: RecommendationCard): string | null {
  if (this.headerImgFailed()) return null;
  if ((c as any).posterUrl) return (c as any).posterUrl;
  if (c.photoUrl) return c.photoUrl;
  // Places with googlePlaceId but no photoUrl → proxy
  if (c.googlePlaceId) return `/v1/cards/place-photo?placeId=${c.googlePlaceId}`;
  return null;
}
```

No changes needed in result-card — it already renders `cardImage()` which checks `posterUrl || photoUrl`.

#### What this gives

- Detail card for Google-matched places (1,755 / 55%) shows hero photo
- Feed cards remain text-only for places
- Events with poster still show thumbnail on feed + hero on detail
- Cost: $0 (under 1K requests/month)

### Phase 2: Feed thumbnails (Option A, after metrics)

Only if Phase 1 shows engagement lift.

#### Backend changes

- Same endpoint, but called from feed cards too
- In-memory cache prevents duplicate API calls
- Consider LRU cache (max 500 entries) to limit memory

#### Frontend changes

```typescript
// result-card.component.ts
cardImage(): string | null {
  const c = this.card();
  if (c.posterUrl) return c.posterUrl;
  if (c.photoUrl) return c.photoUrl;
  if (c.googlePlaceId) return `/v1/cards/place-photo?placeId=${c.googlePlaceId}`;
  return null;
}
```

#### Cost control

- **Lazy loading**: only fetch when card enters viewport (IntersectionObserver)
- **Limit per page**: max 8 photo requests per feed load (first 8 cards)
- **Budget alert**: track daily API calls, alert if >100/day

### Phase 3: Bulk enrichment (Option B, if traffic grows)

Only if traffic > 2K users/month and photo proxy costs > $30/month.

- Cloudflare R2 storage ($0.015/GB/mo)
- Enrichment job: fetch 1 photo per place, store in R2
- 30-day refresh cron (Google ToS TTL)
- URL in `places.photos[0]` → no more proxy needed

## Attribution Requirements

Per Google ToS, if `photo.authorAttributions` is non-empty:

```html
<span class="photo-attr">
  Photo by <a href="{authorUri}">{displayName}</a>
</span>
```

Must be visible wherever the photo is shown. Most Google Places photos have empty attributions (Google's own Street View photos). Only user-contributed photos have non-empty attributions.

**Implementation**: include `authorAttributions` in proxy response headers or as query param. Frontend renders attribution overlay on detail card if present.

## Environment

- `GOOGLE_PLACES_API_KEY` env var on Railway (already set for enrichment)
- Same key works for Photos API
- No additional setup needed

## Files to Modify

| File | Change |
|---|---|
| `apps/api/src/app/cards/cards.controller.ts` | Add `place-photo` endpoint |
| `src/app/features/detail/detail.component.ts` | Update `detailImage()` fallback |
| `src/app/features/discover/result-card/result-card.component.ts` | Phase 2 only: update `cardImage()` |

## Risks

1. **Google rate limiting**: 100 QPS default. Not an issue at current traffic.
2. **Photo names expire**: cached URL may fail after days. 404 → frontend error handler hides image.
3. **ToS enforcement**: Google has never enforced caching rules on small developers. Enterprise customers have been caught.
4. **Latency on detail open**: 200-500ms for first photo. LQIP/blur-up placeholder recommended.
5. **45% places without google_place_id**: no photo possible without matching first. Could run Google Pro enrichment for remaining 1,413.
