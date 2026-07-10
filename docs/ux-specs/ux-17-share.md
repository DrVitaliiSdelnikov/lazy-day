# UX-17: Share — Distribution Channel

Priority: **pre-deploy (blocker for growth)**
Effort: 2-3 hours

## Problem

Share buttons exist in UI but do nothing. Share is not a feature — it's the
primary distribution channel. "Look what it suggested" forwarded in chat is
how lazy users find the app. Without share, there's no organic growth.

## Solution

### 1. Native share (mobile)

```typescript
async share(card: RecommendationCard) {
  const url = `https://lazigo.app/detail/${card.type}/${card.id}`;
  const text = `${card.title} — ${card.categoryLabel || card.category}`;

  if (navigator.share) {
    await navigator.share({ title: 'LaziGo', text, url });
  } else {
    // Clipboard fallback (desktop)
    await navigator.clipboard.writeText(`${text}\n${url}`);
    // Show toast "Ссылка скопирована"
  }
}
```

### 2. Share URL format

`lazigo.app/detail/{type}/{id}` — already a route in the app.

On mobile: opens full detail page.
On desktop: redirects to discover with modal (or full page if no feed context).

### 3. Share points

| Location | Trigger |
|---|---|
| Detail page — share icon button | Primary |
| Detail page — action row share button | Duplicate for discoverability |
| Result card — long press / share icon (future) | v1 |
| "Реши за меня" result (future) | v1 |

### 4. i18n

```json
"share": {
  "copied": "Link copied",
  "title": "LaziGo"
}
```

## Interaction with SSR (week 1)

Without SSR, shared links show generic OG tags in messenger previews.
Week 1: API middleware for `/detail/*` returns HTML with dynamic og:title,
og:description, og:image from venue/event data.

Minimal pre-deploy: share works functionally (correct URL, native share dialog),
just with generic preview card.

## Files to modify

| File | Action |
|------|--------|
| `src/app/features/detail/detail.component.ts` | implement share() method, wire buttons |
| `src/app/features/discover/discover.component.ts` | share from modal |
| `public/assets/i18n/*.json` | add share.copied key |
