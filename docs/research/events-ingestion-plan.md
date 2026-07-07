# Events Ingestion Plan

## Current State

- `events` table exists with full schema (title, startsAt, endsAt, category, tags, priceMin/Max, ticketUrl, status, venueId)
- `fetchEvents()` in recommendation service queries events with PostGIS + time window
- Event scoring works: timeFit, starts_in explanation, mixed with places
- **Zero events in DB** — no ingestion pipeline exists

## Source Analysis (July 2026)

### TKT.ge
- **Structure**: Next.js SPA, client-side rendering. No SSR data in `__NEXT_DATA__` for listing pages.
- **API**: No public REST API found (404 on all probed endpoints).
- **Strategy**: Need headless browser (Puppeteer) or intercept XHR calls from browser devtools to find internal API.
- **Data**: Concerts, festivals, theatre, shows. Has dates, venues, prices, ticket links.
- **Effort**: Heavy — needs reverse-engineering of client-side API calls.
- **Priority**: High but defer to wave 2 after simpler sources.

### biletebi.ge
- **Structure**: Similar SPA approach, minimal SSR.
- **Strategy**: Same as TKT.ge — needs network interception or headless browser.
- **Effort**: Heavy.
- **Priority**: Wave 2.

### opera.ge
- **Structure**: Traditional server-rendered HTML. Playbill page has parseable structure.
- **Data found**: Times (19:00, 15:00), playbill item links (`/eng/playbillinner/214/cast`), month names.
- **Strategy**: Simple HTML parser with cheerio/regex. Extract date + time + title + venue from playbill page.
- **Effort**: Small.
- **Priority**: **Wave 1 — start here**.

### Fabrika Tbilisi
- **URL**: fabrikatbilisi.com or Instagram
- **Strategy**: Check for events page, likely simple HTML or Instagram API.
- **Effort**: Medium.
- **Priority**: Wave 1.

### KHIDI
- **URL**: khidi.ge or Instagram/RA
- **Strategy**: Check events page or Resident Advisor listings.
- **Effort**: Medium.
- **Priority**: Wave 1.

### Resident Advisor (ra.co)
- **URL**: ra.co/events/ge/tbilisi
- **Structure**: Server-rendered, has event listings with dates, venues, genres.
- **Strategy**: HTML parser. Well-structured event pages.
- **Effort**: Medium.
- **Priority**: Wave 1 — good coverage of nightlife/electronic.

## Architecture

### Ingestion Pipeline

```
EventSourceAdapter (per source)
  → fetch raw data (HTML/API)
  → parse to NormalizedEvent[]
  → match venue (by name + coords or google_place_id)
  → deduplicate (source + title + date + venue)
  → classify category/tags
  → save to DB
```

### NormalizedEvent interface

```typescript
interface NormalizedEvent {
  title: string;
  titleEn?: string;
  titleKa?: string;
  description?: string;
  startsAt: Date;
  endsAt?: Date;
  venueName: string;          // raw venue string from source
  venueAddress?: string;
  category: string;           // music, theatre, exhibition, nightlife, market, workshop
  tags: string[];
  priceMin?: number;
  priceMax?: number;
  currency: string;
  ticketUrl?: string;
  posterUrl?: string;
  source: string;             // 'opera.ge', 'ra.co', etc.
  sourceEventId: string;      // unique ID from source for dedup
}
```

### Source Adapter interface

```typescript
interface EventSourceAdapter {
  readonly sourceName: string;
  fetch(): Promise<NormalizedEvent[]>;
}
```

### DB: event_sources table

Track ingestion state per source:
```sql
CREATE TABLE event_sources (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  adapter_type TEXT NOT NULL,  -- 'html_parser', 'api', 'headless'
  last_fetched_at TIMESTAMPTZ,
  last_event_count INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Venue Matching Strategy

1. Exact match: source venue name == venue.name (case-insensitive)
2. Fuzzy match: Levenshtein distance < 3 on normalized name
3. Google Place ID match: if source provides address, geocode → find nearest venue
4. Manual whitelist: `event_sources.config.venue_map = { "Opera House": "venue-uuid-xxx" }`
5. Create new venue: if no match and has coordinates

### Deduplication

Key: `source + sourceEventId + startsAt`

If event already exists with same key:
- Update title/description/price if changed
- Update status if changed (scheduled → cancelled)
- Update lastVerifiedAt

### Admin Endpoints

```
POST /v1/admin/ingestion/events/run           — run all enabled sources
POST /v1/admin/ingestion/events/source/:name   — run one source
GET  /v1/admin/ingestion/events/sources        — list sources with stats
```

## Implementation Phases

### Phase 1: Infrastructure + opera.ge (start here)
- Migration 012: event_sources table
- EventIngestionService with adapter pattern
- OperaGeAdapter: HTML parser for opera.ge/eng/playbill
- Venue matching (exact name → manual whitelist)
- Admin endpoints
- Mixed feed in recommendations (already works)

### Phase 2: RA + Fabrika + KHIDI
- ResidentAdvisorAdapter: ra.co/events/ge/tbilisi parser
- FabrikaAdapter: events page parser
- KhidiAdapter: program page parser
- Better venue matching (fuzzy + geocode)

### Phase 3: TKT.ge + biletebi.ge
- Headless browser or API reverse-engineering
- Broader event coverage
- Ticket links integration

## Category Mapping

| Source category | LazyDay category | Tags |
|---|---|---|
| Concert, Live Music | music | [music, live, concert] |
| Opera, Ballet | theater | [culture, theater, opera] or [culture, theater, ballet] |
| Exhibition | exhibition | [culture, exhibition] |
| Club night, DJ set | nightlife | [nightlife, club, electronic] |
| Market, Fair | market | [shopping, market, outdoor] |
| Workshop, Class | workshop | [culture, workshop] |
| Festival | festival | [entertainment, festival, outdoor] |
| Comedy, Stand-up | entertainment | [entertainment, comedy] |
| Kids event | family | [family, kids] |
| Sport event | sports | [sports] |

## Success Metrics

- Events in DB > 0 (start)
- Events with valid venue match > 80%
- Events in time window (next 7 days) > 10 at any given time
- Mixed feed: ratio events / places when `mode=mixed`
- CTR on event cards vs place cards
