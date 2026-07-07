# UX Improvements Analysis

Date: 2026-07-07

Based on comprehensive UX review document. Analysis of proposed features vs current state, agreements, disagreements, and adjusted priorities.

## Current State vs Proposed Features

### Already Done (3 of 6 top priorities)

| Proposed Feature | Status | Gap |
|---|---|---|
| **Explainable recommendations** | Done — 8 explanation types, localized ru/en/ka, primary/secondary tags, colored badges, company_fit, pet_friendly, open_now, highly_rated | Missing: `confidence` field, `sourceCompleteness`. Not critical for MVP |
| **Save/Hide/Visited** | Partial — save/hide in UI + API (`/v1/interactions`). ProfileStore persists saved/hidden IDs | Missing: `visited` status, behavioral aggregation job, undo |
| **Availability awareness** | Data ready — openStatus (59% coverage), timeFit scoring, opening hours parser (OSM + Google dual format) | Missing: UI sections (open now / starts soon / later today). See disagreement below |

### Not Done (3 of 6 top priorities)

| Proposed Feature | Status | Effort |
|---|---|---|
| **Events layer** | Zero events in DB. Schema exists (`events` table, `event_occurrences`). Scoring works (timeFit, starts_in). No ingestion pipeline | Heavy — parsers for 4-7 Georgian sites |
| **Fast-start onboarding** | Current: 3-step (interests → company+pet → location). No mood presets | Medium — add presets as shortcuts |
| **Offline-first / weak-device** | PWA service worker configured. No compact payload, no @defer for map, no offline packs | Medium |

## Agreements

1. **Events = #1 priority gap**. Without events, LazyDay answers "where can I go" but not "where should I go tonight". This is the most expensive missing piece for a leisure discovery product.

2. **List-first, map-second**. Already implemented correctly — no map on first screen. Document confirms this is right.

3. **Compact payload (`?compact=1`)**. Good idea — currently sending primaryTags, secondaryTags, all explanations even when mobile doesn't need them all. Quick win.

4. **Geofabrik instead of public Overpass**. Current OSM import hits public Overpass API — doesn't scale. Country extract is more reliable and respectful.

5. **Google Places cost strategy (split by SKU)**. Already doing this — Pro → Enterprise → Atmosphere in separate passes. Document validates the approach.

6. **Skeleton UI**. Already implemented. Document confirms this is better than spinners on weak devices.

## Disagreements (marked for reconsideration)

### 1. Mood presets replacing interest chips — RECONSIDER

Document proposes: replace interest selection with mood presets ("Спокойный вечер", "Живо", "Культурно").

**Concern**: mood ≠ interest. "Спокойно" could mean park, spa, quiet café, or home cooking class. Interest chips are more precise for scoring. A user who picks "Спокойный вечер" might get results they didn't expect.

**Proposed compromise**: Add presets as **shortcuts** that map to interest+company combinations, not replacements:
- "Спокойный вечер" → { nature: 0.7, food: 0.5, company: couple }
- "Живо с друзьями" → { nightlife: 1, food: 0.5, company: friends }
- "Семейный день" → { nature: 0.8, culture: 0.5, company: family }

Keep interest chips available for fine-tuning after preset selection.

**Status**: Worth exploring. Need to test with users whether presets or chips produce better first-session satisfaction.

### 2. Availability sections in UI — RECONSIDER

Document proposes: split feed into sections "Открыто сейчас / Скоро начинается / На потом сегодня / На улице".

**Concern**: After strict interest filtering, typical results = 8-12 cards. Splitting into 3-4 sections creates sections of 2-3 cards each — visually fragmented, feels empty. Sections make sense with 30+ results.

**Proposed compromise**: Sort by availability (open first, then by score within open/closed), show availability badge on each card. Only create sections when result count > 15.

**Status**: Worth A/B testing. Sections might feel "curated" even if small.

### 3. Offline district packs — DEFER

Document proposes: precomputed offline bundles per district (Вера, Старый город, Ваке).

**Concern**: For MVP this is overkill. Service worker cache of last results + saved items is sufficient. District packs require precomputation infrastructure, storage management, freshness logic.

**Status**: Defer to v2. Focus on basic SW cache first.

### 4. Background Sync for offline actions — RECONSIDER

Document acknowledges Periodic Background Sync is experimental. Agrees to rely on SW cache + queued mutations.

**Status**: Agree with document's own caveat. Queue hide/save/visited actions in IndexedDB, replay on reconnect.

## What the Document Missed

1. **Venue data quality gap** — 1,223/2,976 venues (41%) have no Google match. No ratings, no hours, no attributes for them. This affects perceived quality significantly.

2. **Venue deduplication** — OSM has duplicates (two McDonald's entries for same physical location). `dedup_candidates` table exists but pipeline not implemented.

3. **Search/autocomplete** — Users can't search by venue name. Only browse through interests. For 3,000 venues this is OK, but for events (potentially hundreds per week) it becomes critical.

4. **Error UX** — No handling for API failures, empty states could be more helpful (document mentions "smart empty states" but in lower priority).

## Adjusted Priority (practical order)

| # | Feature | Why | Effort | Depends on |
|---|---|---|---|---|
| 1 | **Events ingestion** (TKT.ge + opera.ge + Fabrika + KHIDI) | Document's #1 is correct. 4 sources give good MVP coverage for Tbilisi | Heavy | Parsers, venue matching |
| 2 | **Mood presets + availability sort** | Quick UX win. Not sections, but smart sort + preset shortcuts in toolbar | Small | Frontend only |
| 3 | **Compact API + @defer map** | Weak-device discipline. One endpoint change + frontend @defer | Small | API + frontend |
| 4 | **Visited status + behavioral start** | Feedback loop. Extend interactions, start accumulating data for future re-ranking | Medium | DB + API + frontend |
| 5 | **Deploy** | Without deploy, no users → no signals → no data for decisions | Medium | DevOps |
| 6 | **Search/autocomplete** | Becomes critical with events layer | Medium | API + frontend |
| 7 | **Offline cache (basic)** | SW cache last results + saved. Not district packs | Small | Frontend |

## Event Sources (from document, validated)

### Wave 1 (MVP — 4-5 sources)

| Source | Type | What it gives | Priority |
|---|---|---|---|
| **TKT.ge** | Parser | Concerts, festivals, theatre, opera, tickets | High |
| **biletebi.ge** | Parser | Concerts, cinema, theatre, sports | High |
| **opera.ge** | Parser | Stable dates, repertoire, venue anchors | High |
| **Fabrika** | Parser | Markets, exhibitions, community events | High |
| **KHIDI** | Parser | Club nights, nightlife program | High |

### Wave 2 (v1 — 4-5 more)

| Source | Type | Priority |
|---|---|---|
| Bassiani | Parser | High |
| museum.ge | Parser | High |
| Georgia Travel | Parser | Med |
| teatri.ge | Parser | Med |
| Red Events Georgia | Parser | Med |

### Wave 3 (v2 — external/community)

| Source | Type | Priority |
|---|---|---|
| Resident Advisor | Parser | Med |
| Eventbrite API | API | Med |
| Meetup GraphQL | API (paid) | Low |
| Telegram channels | Monitoring | Med |

## Cost Strategy (validated)

Document confirms our approach:
- OSM + Geofabrik as base POI layer
- Google Places for selective enrichment (split by SKU)
- Events from local parsers, not Google
- Foursquare OS Places as optional backfill

Current spend: ~$105 one-time (Enterprise + Atmosphere enrichment). Monthly: near $0 (delta enrichment within free tiers).

## Sources

- Original UX review document (internal, 2026-07-07)
- `docs/research/categorization-and-ranking-strategy.md`
- `docs/research/company-context-strategy.md`
- `docs/research/google-places-api-integration.md`
- `docs/project-status.md`
