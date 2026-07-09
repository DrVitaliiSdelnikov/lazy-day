# UX-15: Route Navigation (not just a point)

Priority: **pre-deploy**
Effort: 1-2 hours

## Problem

Tapping address in detail opens... nothing useful. "Маршрут" button should
open actual navigation, not a static map pin.

## Solution

Two actions on detail page:

### 1. "Маршрут" button → Google Maps navigation

```typescript
openRoute(card: RecommendationCard) {
  const { lat, lng } = card;
  let url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  // Named pin when Google Place ID available
  if (card.googlePlaceId) {
    url += `&destination_place_id=${card.googlePlaceId}`;
  }

  // Walking mode for short distances
  if (card.distanceM && card.distanceM < 2500) {
    url += '&travelmode=walking';
  }
  // else: don't pass travelmode — Google Maps auto-selects

  // Origin NOT passed — device uses current position
  window.open(url, '_blank');
}
```

### 2. "На карте" ghost link → Google Maps view

Next to address text, small ghost link:

```typescript
openOnMap(card: RecommendationCard) {
  let url = `https://www.google.com/maps/search/?api=1&query=${card.lat},${card.lng}`;
  if (card.googlePlaceId) {
    url += `&query_place_id=${card.googlePlaceId}`;
  }
  window.open(url, '_blank');
}
```

### Detail template changes

```html
<!-- Address row -->
<div class="detail__address">
  <ld-icon name="map-pin" [size]="14" />
  <span>{{ card.address }}</span>
  <button class="ld-btn ld-btn--ghost detail__map-link"
    (click)="openOnMap(card)">На карте</button>
</div>

<!-- Action row -->
<div class="detail__actions">
  <button class="ld-btn ld-btn--primary" (click)="openRoute(card)">
    <ld-icon name="route" [size]="16" /> Маршрут
  </button>
  ...
</div>
```

### Card data requirements

Need `googlePlaceId` in `RecommendationCard` model. Check if already passed
from API (venues have `google_place_id` in DB from enrichment).

If not in response → add to API card mapping:
```typescript
// In recommendation.service.ts card builder
googlePlaceId: venue.google_place_id || undefined,
```

### Distance display

Already have `distanceM` in card. For walking threshold (2.5km), use this value.
If distance unknown → don't pass `travelmode` (let Google decide).

## Files to modify

| File | Action |
|------|--------|
| `src/app/features/detail/detail.component.ts` | modify (route + map actions) |
| `libs/shared-models/src/lib/recommendation.ts` | modify (add googlePlaceId) |
| `apps/api/src/app/recommendation/recommendation.service.ts` | modify (pass googlePlaceId) |
