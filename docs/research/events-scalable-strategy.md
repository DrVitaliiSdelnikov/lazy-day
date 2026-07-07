# Research: Scalable Events Data Strategy

## Problem

LazyDay needs events (concerts, exhibitions, nightlife, markets, theatre) to answer "where should I go tonight". Current opera.ge adapter gives 10 events. All major Georgian event platforms (TKT.ge, biletebi.ge, RA.co) are heavy SPAs without public APIs — require headless browsers for scraping. This doesn't scale to new cities and countries.

We need a solution that works for Tbilisi MVP AND scales to 10+ cities without writing a custom parser per local website.

## Three Strategic Approaches

### A. Aggregator API (buy data)

Use a provider that already aggregates events from thousands of sources globally.

| Provider | Coverage | Free tier | Paid | Categories | Format |
|---|---|---|---|---|---|
| **PredictHQ** | 300K+ cities, 200+ sources, 19 categories | Yes (evaluation) | Contact sales | concerts, conferences, festivals, sports, community, performing arts, exhibitions | REST JSON |
| **SerpApi (Google Events)** | Global (anything Google indexes) | 100 searches/mo | $50/mo (5K) | All (Google aggregates from schema.org markup) | REST JSON |
| **Ticketmaster Discovery** | 230K+ events, mainly US/EU/AU | 5,000/day free | Free | concerts, sports, arts, family | REST JSON |
| **Songkick** | Global music events | Developer access | Unknown | concerts, festivals | REST JSON |
| **JamBase** | US/EU music | Unknown | Paid | concerts, festivals | REST JSON |

**Best fit for LazyDay**:

**SerpApi Google Events** — most promising for multi-city scaling:
- Google already aggregates events from ALL local sources (TKT.ge, biletebi.ge, RA.co, Facebook, Instagram, venue websites) via schema.org markup
- One API call per city gives structured JSON: title, date, venue, address, ticket links, images
- Works for ANY city — no per-city parser needed
- 100 free/mo for testing, $50/mo for 5K calls = enough for 50 cities daily
- Returns `events_results[]` with structured fields

**PredictHQ** — best data quality but likely expensive:
- 19 categories, impact scoring, real-time updates
- Free tier for evaluation
- Professional/Enterprise pricing not public — likely $500+/mo
- Best for demand intelligence, may be overkill for discovery app

**Ticketmaster** — good but limited geography:
- No Georgia/Tbilisi coverage confirmed
- Strong for US/EU cities if expanding there
- 5,000 calls/day free

### B. Smart Scraping (build scrapers)

Build headless browser scrapers for each source.

| Approach | Pros | Cons |
|---|---|---|
| **Puppeteer/Playwright per site** | Full control, free | Per-site parser, breaks when site changes, needs headless runtime, doesn't scale to new cities |
| **Apify/Crawlee cloud** | Managed infrastructure, actor marketplace | $49+/mo, still per-site logic |
| **Schema.org crawler** | Scrape any site that has JSON-LD `@type: Event` | Many sites don't have it, still needs crawler infrastructure |

**Verdict**: Doesn't scale. Each new city = 5-10 new parsers. Maintenance nightmare.

### C. Hybrid (recommended)

Use aggregator API as primary, keep adapter pattern for high-value local sources.

```
Tier 1 — Aggregator API (80% of events)
  SerpApi Google Events → covers ALL cities automatically
  One adapter, one API key, any city

Tier 2 — Direct API (where available)
  Ticketmaster Discovery → US/EU expansion
  Eventbrite API → community/workshop events
  PredictHQ → if budget allows, best quality

Tier 3 — Custom parsers (only for critical local sources)
  opera.ge → already built, high quality
  Per-city specialty sources when aggregator misses them
```

## Recommended Architecture

### City-as-Config Model

Instead of per-city code, each city is a **configuration entry**:

```typescript
interface CityConfig {
  id: string;              // 'tbilisi', 'batumi', 'berlin'
  name: string;
  country: string;
  lat: number;
  lng: number;
  radiusKm: number;
  timezone: string;
  locales: string[];       // ['ka', 'en', 'ru']

  // Event sources — ordered by priority
  eventSources: EventSourceConfig[];

  // Place sources
  osmBbox: [number, number, number, number];
  googlePlacesEnabled: boolean;
}

interface EventSourceConfig {
  type: 'google_events' | 'predicthq' | 'ticketmaster' | 'custom_parser';
  enabled: boolean;
  query?: string;          // for Google Events: "events in Tbilisi"
  adapter?: string;        // for custom: 'opera.ge'
  refreshIntervalMin: number;
  config?: Record<string, unknown>;
}
```

Adding a new city = adding a config JSON. No new code.

### Ingestion Pipeline (scaled)

```
CityConfig[]
  ↓
Scheduler (cron per city, staggered)
  ↓
For each city → for each eventSource:
  ↓
EventSourceAdapter.fetch(city, config)
  ↓
NormalizedEvent[]
  ↓
Venue matching (Google Place ID or name+coords)
  ↓
Dedup (source + sourceEventId + startsAt)
  ↓
Category classification
  ↓
Save to DB (events table)
  ↓
Mark stale events (not seen in last 2 fetches → status = 'tentative')
```

### Google Events via SerpApi — How It Works

```typescript
// One adapter for ALL cities
class GoogleEventsAdapter implements EventSourceAdapter {
  async fetch(city: CityConfig): Promise<NormalizedEvent[]> {
    const response = await fetch(
      `https://serpapi.com/search.json?engine=google_events&q=events+in+${city.name}&hl=${city.locales[0]}&api_key=${API_KEY}`
    );
    const data = await response.json();

    return data.events_results.map(e => ({
      title: e.title,
      startsAt: parseDate(e.date.start_date, city.timezone),
      endsAt: e.date.end_date ? parseDate(e.date.end_date, city.timezone) : undefined,
      venueName: e.venue?.name,
      venueAddress: e.address?.[0],
      ticketUrl: e.ticket_info?.[0]?.link,
      source: 'google_events',
      sourceEventId: e.event_location_map?.link || e.title + e.date.start_date,
      category: classifyCategory(e.title, e.description),
      tags: extractTags(e),
      posterUrl: e.thumbnail,
      currency: city.country === 'GE' ? 'GEL' : 'EUR',
    }));
  }
}
```

One query per city → dozens of events from ALL local sources Google knows about.

### Cost Model

| Scale | SerpApi calls/mo | Cost | Cities covered |
|---|---|---|---|
| MVP (1 city, daily) | 30 | Free (100/mo) | Tbilisi |
| v1 (5 cities, daily) | 150 | Free | Tbilisi, Batumi, Kutaisi, Berlin, Barcelona |
| v2 (20 cities, 2x daily) | 1,200 | $50/mo | Any 20 cities |
| Scale (50 cities, 3x daily) | 4,500 | $50/mo | Any 50 cities |

Compare: 50 custom parsers × maintenance cost >> $50/mo.

### Data Quality Layers

```
Raw events from SerpApi
  ↓
Dedup (same event from multiple Google sources)
  ↓
Venue match (Google Place ID for known venues)
  ↓
Category classifier (title + description → concert/exhibition/nightlife/etc)
  ↓
Quality score (has date? has venue? has ticket link? has image?)
  ↓
Freshness check (re-fetch, mark stale if gone)
  ↓
Ready for recommendations
```

### Migration from Current Adapter Pattern

Current `EventSourceAdapter` interface stays. Add `GoogleEventsAdapter` as another adapter type:

```
adapters Map:
  'opera.ge'       → OperaGeAdapter (custom parser, Tier 3)
  'google_events'  → GoogleEventsAdapter (aggregator, Tier 1)
  'ticketmaster'   → TicketmasterAdapter (direct API, Tier 2) — future
```

No breaking changes. Current opera.ge adapter continues to work as Tier 3 complement.

## Decision Matrix

| Criterion | Custom Parsers | Aggregator API | Hybrid |
|---|---|---|---|
| Time to first event in new city | Days-weeks (build parser) | Minutes (add config) | Minutes |
| Maintenance | High (sites change) | Low (API stable) | Low |
| Coverage breadth | Narrow (only parsed sites) | Wide (Google indexes everything) | Wide + deep |
| Data freshness | Depends on scrape frequency | Real-time (Google) | Mixed |
| Cost | Free but labor-heavy | $0-50/mo | $0-50/mo |
| Legal risk | Moderate (scraping TOS) | Low (using API) | Low |
| Scales to 50 cities | No | Yes | Yes |

## Recommendation

1. **Immediately**: Sign up for SerpApi free tier (100/mo), test with `"events in Tbilisi"` query
2. **MVP**: GoogleEventsAdapter as primary source. Keep opera.ge as complement for high-quality theatre data
3. **v1**: Add CityConfig model. Each new city = one JSON entry
4. **v2**: Add Ticketmaster/PredictHQ for cities where Google Events has gaps
5. **Long-term**: Custom parsers only for sources Google doesn't index (private Telegram channels, etc.)

## Sources

- [SerpApi Google Events API](https://serpapi.com/google-events-api)
- [PredictHQ Events API](https://www.predicthq.com/apis/event-api)
- [PredictHQ Pricing](https://www.predicthq.com/pricing)
- [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
- [Songkick Developer API](https://www.songkick.com/developer)
- [9 Best Event Data APIs 2026](https://visionvix.com/best-event-data-api/)
- [Google Events Structured Data](https://developers.google.com/search/docs/appearance/structured-data/event)
- [JamBase Data API](https://data.jambase.com/)
