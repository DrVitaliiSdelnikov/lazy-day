# SEO Implementation Guide

## Current State

- `index.html`: has `<title>` and `<meta description>` (Russian only)
- No `robots.txt`
- No `sitemap.xml`
- No Open Graph / Twitter Card meta tags
- No JSON-LD structured data
- No `hreflang` for multi-language
- No canonical URL
- Angular SPA — without SSR, Google sees only index.html content
- `public/` folder copies files as-is to build root → use for robots.txt, sitemap.xml

## What We Can Do Without Deploy (locally)

| File | Location | Purpose | Needs domain? |
|---|---|---|---|
| `robots.txt` | `public/robots.txt` | Tell crawlers what to index | Placeholder URL ok |
| `sitemap.xml` | `public/sitemap.xml` | List of indexable pages | Placeholder URL ok |
| Meta + OG tags | `src/index.html` | Social sharing preview, SEO | Placeholder URL ok |
| `manifest.webmanifest` | Already exists | PWA install | Already done |
| `ngsw-config.json` | Already exists | Service worker | Already done |

Replace `https://lazigo.app` with actual domain when purchased.

## Files Created

### 1. robots.txt

```
User-agent: *
Allow: /
Disallow: /discover
Disallow: /settings
Disallow: /saved

# Personal feed, settings, saved — not indexable (SPA, no content for bots)
# Landing page, about, detail pages — indexable (when SSR added)

Sitemap: https://lazigo.app/sitemap.xml
```

Why disallow `/discover`? It's a personalized SPA feed — Google sees empty `<app-root>`. No SEO value until SSR.

### 2. sitemap.xml (static MVP)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://lazigo.app/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

Minimal — only landing page. When SSR added: generate dynamically with event/venue URLs.

### 3. index.html meta tags

```html
<!-- Primary -->
<title>LazyDay — Leisure discovery in Tbilisi</title>
<meta name="description" content="Find places and events in Tbilisi matched to your mood, company, and time. Restaurants, parks, concerts, nightlife — curated for you.">

<!-- Open Graph (Facebook, Telegram, WhatsApp) -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://lazigo.app/">
<meta property="og:title" content="LazyDay — What to do in Tbilisi">
<meta property="og:description" content="Personalized leisure discovery. Places, events, restaurants — matched to your interests.">
<meta property="og:image" content="https://lazigo.app/og-image.png">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="ru_RU">
<meta property="og:locale:alternate" content="ka_GE">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="LazyDay — What to do in Tbilisi">
<meta name="twitter:description" content="Personalized leisure discovery. Find your perfect evening.">
<meta name="twitter:image" content="https://lazigo.app/og-image.png">

<!-- Canonical -->
<link rel="canonical" href="https://lazigo.app/">

<!-- Language alternates -->
<link rel="alternate" hreflang="en" href="https://lazigo.app/">
<link rel="alternate" hreflang="ru" href="https://lazigo.app/">
<link rel="alternate" hreflang="ka" href="https://lazigo.app/">
<link rel="alternate" hreflang="x-default" href="https://lazigo.app/">
```

### 4. JSON-LD (WebApplication)

On landing page — tells Google what the app is:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "LazyDay",
  "description": "Contextual leisure discovery in Tbilisi. Find places and events matched to your mood, company, and time.",
  "url": "https://lazigo.app",
  "applicationCategory": "TravelApplication",
  "operatingSystem": "Web",
  "availableLanguage": ["en", "ru", "ka"],
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
</script>
```

### 5. og-image.png

Need to create: 1200×630px image with LazyDay branding for social preview. Placeholder for now.

## What Needs SSR (post-deploy, v1)

| Page | JSON-LD type | Why |
|---|---|---|
| `/detail/event/:id` | `Event` | Google Events rich results carousel |
| `/detail/place/:id` | `LocalBusiness` | Google local business panel |
| Category landing pages | `ItemList` | "Best parks in Tbilisi" SEO pages |

Without SSR these pages render empty HTML — bots can't read JSON-LD injected by Angular.

## Verification Tags (add after domain purchase)

```html
<!-- Google Search Console -->
<meta name="google-site-verification" content="YOUR_CODE">

<!-- Yandex.Webmaster -->
<meta name="yandex-verification" content="YOUR_CODE">
```

## Testing

After deploy:
- [Google Rich Results Test](https://search.google.com/test/rich-results) — validate JSON-LD
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — validate OG tags
- [Twitter Card Validator](https://cards-dev.twitter.com/validator) — validate Twitter meta
- Google Search Console — verify indexing
