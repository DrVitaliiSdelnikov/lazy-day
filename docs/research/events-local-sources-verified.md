# Events: Verified Local Sources & Patterns

Extracted from analysis of local scraping research. Only verified, actionable items.

## Confirmed Sources

| Source | Type | Coverage | robots.txt | Method |
|---|---|---|---|---|
| **TKT.ge** | Ticketing platform | Concerts, festivals, theatre, sports — widest Georgia coverage | Allows content, blocks checkout | Puppeteer (SPA) |
| **Biletebi.ge** | Ticketing platform | Concerts, cinema, theatre, sports, museums | Allows scanning, blocks AI training | Puppeteer (SPA, NOT static) |
| **YOLO.ge** | Experiences platform | Experiences, concerts, nightlife, festivals, masterclasses, gastro | Allow: / (fully open) | Cheerio (verify if static) |
| **Tiksit.com** | Ticketing (newer) | Concerts, hikes, tours, water activities | Unknown — check | TBD |
| **opera.ge** | Official playbill | Opera, ballet repertoire | Open | Cheerio (done, adapter exists) |
| **Telegram channels** | Community | Event announcements, nightlife, community events | Public content, no restrictions | Cheerio via `t.me/s/channel` |

### Telegram Channels (verified active)
- `@georgiaafisha` — "all events Tbilisi and Batumi", links to YOLO
- `@tbilisi_events` — event announcements
- `@tbilisi_afisha` — event listings

### NOT to use
- **Instagram** — ToS explicitly forbids scraping. Blocked.
- **Facebook Events** — Graph API restricted, language barrier. Skip.

## Confirmed Pipeline Patterns

### Dedup Key
```
normalize(title) + startDate + normalize(venueName)
```
- Normalize: lowercase, remove special chars, transliterate ka→en for comparison
- If match: merge fields from highest-reliability source

### Source Reliability Ranking
```
TKT.ge / Biletebi.ge  →  highest (official ticket data)
Google Events (SerpApi) →  medium (structured, verified by Google)
YOLO.ge               →  medium (curated platform)
opera.ge / venues      →  medium (official but narrow)
Telegram              →  low (unverified, no ticket links)
```

### Freshness / Staleness Logic
```
Seen in current fetch        → status: 'scheduled' (active)
Not seen for 2 fetch cycles  → status: 'tentative'
Not seen for 4 fetch cycles  → status: 'past'
Event time has passed        → status: 'past' (immediate)
```

### Category Mapping
```
YOLO categories → LazyDay tags:
  concerts    → [music, concert]
  nightlife   → [nightlife, club]
  festivals   → [entertainment, festival, outdoor]
  cinema      → [entertainment, cinema]
  theatre     → [culture, theater]
  exhibitions → [culture, exhibition]
  masterclass → [culture, workshop]
  gastro      → [food, experience]
```

### Telegram Web Preview Parser
```typescript
// Selector for public channel web preview
const url = 'https://t.me/s/georgiaafisha';
const $ = cheerio.load(html);
$('.tgme_widget_message_text').each((i, el) => {
  const text = $(el).text();
  // Extract: dates, venue names, ticket links via regex
});
```

## Legal Summary
- TKT.ge: content pages allowed, checkout/search blocked — we only read event listings ✓
- Biletebi.ge: scanning allowed, AI training blocked — we're not training AI ✓
- YOLO.ge: Allow: / — fully open ✓
- Telegram: public channels = public content ✓
- Instagram: ToS forbids scraping — skip ✗
- Rate limiting: respect all sites, 1-2 req/sec max, off-peak hours preferred

## Infrastructure Notes
- Puppeteer: ~200-500MB RAM per instance. Hetzner CX22 (4GB) = 2-3 parallel sessions max
- Check mobile versions (`m.tkt.ge`) — may be simpler HTML
- Check for JSON-LD `@type: Event` in initial HTML before resorting to Puppeteer
- SerpApi Google Events should be tested FIRST — may cover 70%+ without any scrapers
