# UX-20: Detail SSR Preview (Dynamic OG Tags)

Priority: **week 1** (after share is live)
Effort: 3-4 hours

## Problem

When someone shares `lazigo.app/detail/place/uuid` in a chat, the messenger
fetches the URL and reads OG tags. Without SSR, it gets the static generic
tags from `index.html` — "LaziGo — What to do in Tbilisi" with no venue info.

The shared link looks like every other link. No title, no rating, no photo.
Share as distribution channel is crippled.

## Solution

Lightweight SSR only for `/detail/*` routes — not full Angular SSR.

### API middleware approach

NestJS middleware that intercepts requests to `/detail/:type/:id` with
a bot User-Agent (Telegram, WhatsApp, Facebook, Twitter crawlers):

```typescript
@Middleware()
export class OgMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const match = req.path.match(/^\/detail\/(place|event)\/(.+)$/);
    if (!match || !this.isBot(req)) return next();

    const [, type, id] = match;
    const card = await this.cardsService.getCard(type, id);
    if (!card) return next();

    res.send(this.renderOgHtml(card));
  }

  private isBot(req: Request): boolean {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    return /telegrambot|whatsapp|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot/
      .test(ua);
  }

  private renderOgHtml(card: RecommendationCard): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="${escape(card.title)}" />
  <meta property="og:description" content="${escape(card.categoryLabel)} · ${card.rating ? card.rating + '★' : ''}" />
  <meta property="og:image" content="${card.photoUrl || 'https://lazigo.app/assets/og-image.png'}" />
  <meta property="og:url" content="https://lazigo.app/detail/${card.type}/${card.id}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta http-equiv="refresh" content="0;url=https://lazigo.app/detail/${card.type}/${card.id}" />
</head>
<body>Redirecting...</body>
</html>`;
  }
}
```

### Architecture

- API serves both `/v1/*` (JSON) and `/detail/*` (HTML for bots, redirect for humans)
- Or: Cloudflare Worker at the edge that intercepts bot requests, fetches
  card data from API, returns OG HTML. Non-bot requests pass through to SPA.

Cloudflare Worker is cleaner — no changes to API, works at CDN level.

### Photo as OG image

Cards with `photoUrl` (from Google Places) → use as OG image.
Cards without → use generic branded OG image.

## Files to create

| File | Action |
|------|--------|
| `apps/api/src/app/og/og.middleware.ts` | create (or Cloudflare Worker) |
| OR `workers/og-preview.ts` | Cloudflare Worker alternative |
