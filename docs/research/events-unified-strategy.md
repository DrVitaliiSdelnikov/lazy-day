# Events: Unified Strategy (consolidated)

Two research documents merged: scalable aggregator approach + local scraping approach.

## Core Insight

Neither approach alone is sufficient:
- **Aggregator only** (SerpApi Google Events): scales to 50 cities but may miss niche local events in Tbilisi (small galleries, community markets, Telegram-only announcements)
- **Scrapers only** (TKT.ge, Biletebi.ge, YOLO.ge, Telegram): deep Tbilisi coverage but doesn't scale — each new city = weeks of parser development

**Answer: layered architecture with clear tier separation.**

## Unified Source Tiers

### Tier 1 — Aggregator (city-agnostic, scales automatically)
| Source | Method | Coverage | Cost | Scale |
|---|---|---|---|---|
| SerpApi Google Events | REST API | Global — Google indexes TKT, Biletebi, YOLO, venue sites via schema.org | $0-50/mo | Any city |
| Ticketmaster Discovery | REST API | US/EU/AU, 230K+ events | Free (5K/day) | Western cities |

**Why this matters**: Google Events already scrapes TKT.ge, Biletebi.ge, YOLO.ge FOR US. One API call returns structured data from all these sources without us building parsers.

### Tier 2 — Local scrapers (deep coverage for priority cities)
| Source | Method | Coverage | Effort |
|---|---|---|---|
| TKT.ge | Puppeteer (SPA) | Concerts, theatre, sports, festivals — main Georgian ticketing | Heavy |
| Biletebi.ge | Puppeteer (SPA) | Concerts, cinema, theatre, museums | Heavy |
| YOLO.ge | Cheerio (Allow: /) | Local experiences, concerts, exhibitions, tours | Medium |
| opera.ge | Cheerio (done) | Opera/ballet repertoire | Done |

**When to build**: only for priority cities where Tier 1 misses >30% of relevant events. Verify by comparing SerpApi results vs manual check of source site.

### Tier 3 — Monitoring / discovery layer
| Source | Method | Coverage |
|---|---|---|
| Telegram channels | Web preview scraping (`t.me/s/channel`) | Early signals, community events, nightlife |
| Venue Instagram | Future | Event announcements from specific venues |

**Role**: not source of truth. Discovery layer that surfaces events to verify against Tier 1/2.

## Architecture

### City-as-Config (unchanged from scalable strategy)

```typescript
interface CityConfig {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  locales: string[];
  eventSources: EventSourceConfig[];
}

interface EventSourceConfig {
  type: 'google_events' | 'tkt_ge' | 'biletebi' | 'yolo' | 'opera_ge' | 'telegram' | 'ticketmaster';
  enabled: boolean;
  refreshIntervalMin: number;
  config: Record<string, unknown>;
}
```

Tbilisi config example:
```json
{
  "id": "tbilisi",
  "name": "Tbilisi",
  "country": "GE",
  "lat": 41.7151,
  "lng": 44.8271,
  "timezone": "Asia/Tbilisi",
  "locales": ["ka", "en", "ru"],
  "eventSources": [
    { "type": "google_events", "enabled": true, "refreshIntervalMin": 720 },
    { "type": "opera_ge", "enabled": true, "refreshIntervalMin": 1440 },
    { "type": "yolo", "enabled": true, "refreshIntervalMin": 1440 },
    { "type": "tkt_ge", "enabled": false, "refreshIntervalMin": 1440 },
    { "type": "telegram", "enabled": false, "refreshIntervalMin": 360, "config": { "channels": ["afisha_tbilisi", "tbilisi_events"] } }
  ]
}
```

Berlin config example (no local scrapers needed):
```json
{
  "id": "berlin",
  "name": "Berlin",
  "eventSources": [
    { "type": "google_events", "enabled": true, "refreshIntervalMin": 720 },
    { "type": "ticketmaster", "enabled": true, "refreshIntervalMin": 1440 }
  ]
}
```

### Ingestion Pipeline

```
Scheduler (cron per city, staggered)
  ↓
For each city.eventSources (enabled, by tier):
  ↓
Tier 1: GoogleEventsAdapter.fetch(city)     → NormalizedEvent[]
Tier 2: TktGeAdapter.fetch() (if enabled)   → NormalizedEvent[]
Tier 3: TelegramAdapter.fetch() (if enabled) → NormalizedEvent[]
  ↓
Merge all NormalizedEvent[] for the city
  ↓
Dedup (title similarity + date + venue proximity)
  ↓
Venue matching (Google Place ID → existing venue → geocode → create)
  ↓
Category classification (title + description → concert/theatre/nightlife/etc)
  ↓
Quality scoring (has date? venue? ticket link? image? source reliability)
  ↓
Upsert to DB
  ↓
Mark stale (not refreshed in 2 cycles → status 'tentative' → 4 cycles → 'past')
```

### Cross-source dedup

Same event appears in Google Events + TKT.ge + Telegram:
```
Key: normalize(title) + startDate + normalize(venueName)
  ↓
If match:
  - Keep highest-reliability source as primary
  - Merge fields: take best of (description, price, image, ticketUrl)
  - Source reliability: TKT/Biletebi > Google Events > YOLO > Telegram
```

### Headless Browser Strategy (for Tier 2)

TKT.ge and Biletebi.ge are SPAs requiring Puppeteer/Playwright.

**Options**:
1. **Self-hosted Puppeteer** on Hetzner VPS — free, but needs headless Chrome runtime
2. **Apify/Crawlee cloud** — $49+/mo, managed infrastructure, actor marketplace
3. **Browserless.io** — $0-99/mo, headless Chrome as a service, API-based

**Recommendation for MVP**: self-hosted Puppeteer on same VPS as API. Add Browserless later if scaling.

**robots.txt compliance**:
- TKT.ge: disallows checkout/search paths, allows content pages
- Biletebi.ge: allows scanning, disallows AI training (we're not training)
- YOLO.ge: Allow: / (fully open)
- Telegram public channels: public content, no restrictions

### Yandex Maps Cross-Check (from earlier research)

**For venues** (not events):
- Yandex Maps has strong coverage in Georgia/CIS with different review/rating pool
- Can cross-check: hours, status, ratings
- `yandex_rating` alongside `google_rating` gives higher confidence
- **Not for events**: Yandex has no events API

**Apple Maps**:
- 25K free calls/day but weak coverage for Georgia
- No events, no ratings
- Defer to v2

## Implementation Phases (revised)

### Phase 1: Google Events + YOLO (weeks 1-2)
- SerpApi account setup (free tier: 100/mo)
- GoogleEventsAdapter: one query per city → structured events
- YOLO.ge adapter: Cheerio parser (Allow: /, static HTML)
- Test: compare results, verify coverage
- Expected: 30-50 events for Tbilisi

### Phase 2: TKT.ge + dedup (weeks 3-4)
- Puppeteer setup on VPS
- TKT.ge adapter: navigate categories, extract events
- Cross-source dedup pipeline
- Expected: 100+ events for Tbilisi

### Phase 3: Biletebi + Telegram (weeks 5-6)
- Biletebi.ge adapter (Puppeteer)
- Telegram web preview parser (Cheerio)
- Source reliability scoring
- Expected: 150+ events

### Phase 4: Monitoring + new cities (weeks 7-8)
- Prometheus metrics (events/day, errors, freshness)
- Add 2-3 new cities (Batumi, Kutaisi) via config
- Stale event cleanup job
- Quality dashboard

## Cost Model

| Component | MVP | v1 (5 cities) | v2 (20 cities) |
|---|---|---|---|
| SerpApi | $0 (100/mo free) | $0 (free) | $50/mo (5K) |
| VPS (Puppeteer + API) | $10/mo (Hetzner) | $10/mo | $20/mo |
| Proxies (if needed) | $0 | $0 | $20-30/mo |
| Google Places (venue matching) | $0 (free tier) | $0 | ~$20/mo |
| **Total** | **$10/mo** | **$10/mo** | **$90-120/mo** |

## Key Decision: When to Build a Local Scraper

Don't build a Tier 2 scraper unless:
1. SerpApi Google Events covers < 70% of events visible on the source site
2. The source site has > 50 relevant events per week
3. The city is a priority market (paying users or strategic)

Always start with Tier 1 (Google Events) for a new city. Measure gap. Build Tier 2 only if gap is significant.

## Sources

- [SerpApi Google Events API](https://serpapi.com/google-events-api)
- [PredictHQ Events API](https://www.predicthq.com/apis/event-api)
- [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
- [Yandex Maps Places API](https://yandex.com/dev/maps/geosearch/)
- [Apple Maps Server API](https://developer.apple.com/documentation/applemapsserverapi/)
- [YOLO.ge](https://yolo.ge)
- [TKT.ge robots.txt](https://tkt.ge/robots.txt)
- [Biletebi.ge robots.txt](https://biletebi.ge/robots.txt)
- Internal: events-ingestion-plan.md, events-scalable-strategy.md
