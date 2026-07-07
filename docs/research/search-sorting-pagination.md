# Research: Search Algorithm, Sorting & Pagination

## Problem Statement

Current behavior: scoring returns top 10-30 results sorted by composite score (0.45 interest + 0.25 distance + 0.15 time + 0.10 quality + 0.05 source). This means a karting track 6.5km away loses to a gym 500m away — even if user wants karting specifically. User has no control over what matters more.

Three questions to answer:
1. How should the search algorithm work for different user intents?
2. What sort options should be available?
3. How should pagination work?

## 1. Search Algorithm: Intent Detection

Not every search has the same intent. Three patterns:

### Pattern A: "What's around me?" (exploratory)
- User has broad interests (nature + food)
- Wants variety, nearby, open now
- **Current algorithm is good for this** — composite score balances all factors

### Pattern B: "Find me a gym" (specific category)
- User wants ONE type of place
- Distance matters but not as much — willing to go farther for a good gym
- **Current algorithm is bad for this** — 7 nearby gyms crowd out the one great gym 4km away
- Need: more results, quality/rating weighted higher

### Pattern C: "What's special tonight?" (time-bound)
- User wants events or time-sensitive places
- Time fit matters most
- **Current algorithm is decent** — timeFit helps, but events compete with places

### Proposed: Adaptive Scoring

Instead of one fixed formula, adjust weights based on query characteristics:

```
Exploratory (multiple interests, no strict):
  score = 0.40×interest + 0.30×distance + 0.15×time + 0.10×quality + 0.05×source

Specific category (one strict interest):
  score = 0.30×interest + 0.15×distance + 0.15×time + 0.30×quality + 0.10×source
  ↑ quality weight UP, distance weight DOWN — show best, not just closest

Time-bound (short time window or events requested):
  score = 0.35×interest + 0.20×distance + 0.30×time + 0.10×quality + 0.05×source
  ↑ time weight UP
```

Detection heuristic:
- One strict interest (≥0.7) + no soft interests → Pattern B (specific)
- Time window < 4 hours → Pattern C (time-bound)
- Multiple interests or all soft → Pattern A (exploratory)

### Alternative: User-Controlled Priority

Instead of auto-detecting, let user explicitly set what matters:

```
Sort by: [Smart (default)] [Closest] [Best rated] [Most relevant]
```

Each mode uses different weight formula. "Smart" = current adaptive approach.

## 2. Sort Options

### Option 1: Single composite score (current)
**Pro**: Simple, one ranked list
**Con**: User can't control what matters. Closest gym always wins over best-rated gym farther away.

### Option 2: Explicit sort modes

| Mode | Formula | When useful |
|---|---|---|
| **Smart** (default) | Adaptive composite (see above) | First-time, exploratory |
| **Closest** | Pure distance (+ interest filter) | "What's walkable right now" |
| **Best rated** | Rating desc (+ interest filter + min distance) | "Best gym in the city" |
| **Most relevant** | Interest match score only (+ min quality) | "Most matching to my interests" |
| **Opening soon / now** | timeFit desc → distance | "What's open right now" |

### Implementation

```typescript
enum SortMode {
  SMART = 'smart',         // adaptive composite
  CLOSEST = 'closest',     // distance asc
  BEST_RATED = 'best',     // rating desc
  RELEVANT = 'relevant',   // interest score desc
  OPEN_NOW = 'open',       // open first, then by distance
}
```

In API request: `"sort": "closest"` or `"sort": "best"`. Default: `"smart"`.

Each mode still applies interest hard filter (strict interests ≥0.7) — sort doesn't change WHAT is shown, only ORDER.

### UX: Sort chips in toolbar

```
[Smart ✓] [Closest] [Top rated] [Open now]
```

Horizontal scroll chips below presets bar. One tap to switch. Results re-sort without re-fetch (all data is there, just re-ordered).

**Key insight**: sort modes don't need server round-trip if we return enough candidates. Client-side re-sort from cached results = instant UX.

## 3. Pagination

### Current: No pagination
- Returns top 30 results (sliced from scored candidates)
- `hasMore: true/false` — but `/more` endpoint returns empty (TODO)
- User sees all results at once

### Why pagination matters
- With expanded categories (130 gyms in 15km), user may want to see more than 10-30
- Scrolling through 130 results is bad UX, but 10 is too few
- Need: progressive loading

### Options

#### A. Cursor-based pagination (recommended)
```
POST /v1/recommendations
  → { cards: [...30], cursor: "abc123", hasMore: true }

GET /v1/recommendations/more?cursor=abc123
  → { cards: [...30], cursor: "def456", hasMore: true }
```

Server stores scored candidates in Redis (TTL 10 min). Cursor = session ID + offset.

**Pro**: Stateful, consistent results, no duplication
**Con**: Needs Redis, memory for stored results

#### B. Offset pagination (simpler)
```
POST /v1/recommendations?page=1&pageSize=20
POST /v1/recommendations?page=2&pageSize=20
```

Server re-runs scoring each time.

**Pro**: Stateless
**Con**: Slower (re-scoring), results may shift between pages

#### C. Client-side pagination (simplest for MVP)

Server returns MORE candidates (e.g., 100 instead of 30). Client shows first 20, "Load more" shows next 20 from cached response.

```
POST /v1/recommendations
  → { cards: [...100], hasMore: false }

Client:
  page 1: cards.slice(0, 20)
  "Load more" → cards.slice(20, 40)
  ...
```

**Pro**: No server changes, instant "load more", works offline
**Con**: Larger initial payload, but with compact mode it's fine

### Recommended: Option C for MVP, Option A for v1

MVP: return 50-100 scored results, client paginates locally.
v1: add Redis cursor pagination for infinite scroll + sort mode switching.

### Page sizes by context

| Context | Recommended page size | Why |
|---|---|---|
| Mobile, exploratory | 10 | Quick decision, don't overwhelm |
| Mobile, specific category | 20 | User is comparison-shopping |
| Desktop | 20-30 | More screen space |
| "Show all" | 50+ (paginated) | User explicitly wants full list |

## Combined Proposal

### MVP (minimal changes)

1. **Return more results**: increase from 30 to 50-100 scored candidates
2. **Client-side "Load more"**: show first 15, button for next 15
3. **One sort toggle**: "Smart" (default) vs "Closest" — just two options
4. **Adaptive scoring**: detect Pattern B (single strict interest) → boost quality weight

### v1

5. **Full sort bar**: Smart / Closest / Top rated / Open now
6. **Client-side re-sort**: cached results, instant switch
7. **Server pagination**: Redis cursor for 100+ results

### v2

8. **Per-category search**: "Show all gyms" → dedicated category view, list mode
9. **Map view toggle**: "Show on map" for spatial browsing
10. **Saved searches**: "Gyms near home" as persistent filter

## Impact on Current Code

### Minimal changes (MVP)

```typescript
// recommendation.service.ts — increase output limit
const cards = diversified.slice(0, 50); // was 30

// Frontend — add "Load more" button
// discover.component.ts
visibleCount = signal(15);
showMore() { this.visibleCount.update(n => n + 15); }
// template: cards().slice(0, visibleCount())
```

### Sort mode (v1)

```typescript
// In DiscoverRequestDto
sort?: 'smart' | 'closest' | 'best' | 'open';

// In scoreCandidate — adjust weights by sort mode
const weights = this.getWeights(dto.sort, hasStrictInterests, timeWindowHours);
```

No breaking changes to existing API. `sort` is optional, defaults to `smart`.

## Open Questions

1. **Should "Closest" ignore scoring entirely?** Or keep interest filter + sort by distance? Recommendation: keep interest filter (don't show restaurants when user wants gyms), sort by distance only.

2. **Should "Best rated" require minimum rating count?** A venue with 5.0 from 1 review vs 4.5 from 500 reviews. Recommendation: yes, require ≥10 ratings for "Best rated" sort, or use Wilson score interval.

3. **Should sort persist across sessions?** Recommendation: no for MVP. Reset to "Smart" each session. User's context changes.

4. **Should pagination cursor expire?** Yes — 10 min TTL. Stale results are worse than re-fetching.
