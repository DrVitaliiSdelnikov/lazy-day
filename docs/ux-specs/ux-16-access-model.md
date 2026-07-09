# UX-16: Venue Access Model (solves "gym problem")

Priority: **pre-deploy** (feed quality)
Effort: 0.5-1 day

## Problem

Fitness centers and gym chains appear in feed for "Активно" interest. But gyms
require membership — they're not spontaneous visits. Showing them in "куда сходить
сейчас" feed is misleading and degrades trust.

## Solution

New venue attribute `accessModel` classifies how a user accesses a place:

| Value | Meaning | Examples | Feed behavior |
|-------|---------|----------|---------------|
| `open` | Free entry | Parks, cafes, viewpoints | Default — always in feed |
| `ticket` | Pay per visit | Swimming pools, climbing walls, ice rinks, museums | In feed — casual, spontaneous |
| `membership` | Subscription/membership | Fitness centers, gym chains | **Hard-filtered from feed by default** |

### Why membership is excluded

The feed answers "куда сходить сейчас". Membership venues are not spontaneous
by definition — you either already go there or you don't. Showing them:
- Misleads users who can't actually enter
- Pollutes "Активно" results (3 gyms push out 3 climbing walls)
- Creates false-negative "this app shows irrelevant stuff"

### Explicit access

Category "Фитнес и залы" in full category list (behind "Ещё N" expansion).
Selecting it lifts the membership filter. This preserves data without
polluting default experience.

## Database

### Migration

```sql
-- Migration 014 (or next available)
ALTER TABLE venues ADD COLUMN access_model TEXT NOT NULL DEFAULT 'open';
CREATE INDEX idx_venues_access ON venues (access_model);
```

### Classification script

One-time script to classify existing venues:

```typescript
async classifyAccessModel() {
  // Membership: fitness centers from OSM + Google types
  await this.repo.createQueryBuilder()
    .update(VenueEntity)
    .set({ accessModel: 'membership' })
    .where("tags->>'leisure' = 'fitness_centre'")
    .orWhere("google_types::text LIKE '%gym%'")
    .orWhere("google_types::text LIKE '%fitness%'")
    .execute();

  // Ticket: museums, swimming, climbing, bowling, etc.
  await this.repo.createQueryBuilder()
    .update(VenueEntity)
    .set({ accessModel: 'ticket' })
    .where("tags->>'tourism' = 'museum'")
    .orWhere("tags->>'leisure' IN ('swimming_pool', 'ice_rink', 'bowling_alley')")
    .orWhere("tags->>'sport' IN ('climbing', 'karting')")
    .orWhere("google_types::text LIKE '%museum%'")
    .orWhere("google_types::text LIKE '%bowling%'")
    .orWhere("google_types::text LIKE '%swimming%'")
    .execute();

  // Everything else stays 'open' (default)
}
```

## Scoring pipeline change

### Step 4 — Hard filters (recommendation.service.ts)

Add to existing hard filters:

```typescript
// Step 4: Hard filters
if (venue.accessModel === 'membership' && !requestedCategories.includes('gym')) {
  return null; // filtered out
}
```

Where `requestedCategories` comes from user's explicit interest selection.
If user explicitly selected "Фитнес и залы" (slug: `gym`), the filter is lifted.

### Category list update

```typescript
// In discover presets or full category list
{ slug: 'gym', label: 'Фитнес и залы', icon: 'run', liftsFilter: 'membership' }
```

This category is NOT in the default 8 onboarding chips (per earlier cleanup).
It appears only in the full "Ещё N" expanded list or in sidebar categories.

## Venue entity change

```typescript
@Column({ type: 'text', default: 'open' })
accessModel: 'open' | 'ticket' | 'membership';
```

## Future reuse

The `accessModel` attribute can be extended for:
- `coworking` — membership-based workspaces
- `club` — private clubs
- Same filtering logic applies.

## Edge cases

| Case | Behavior |
|------|----------|
| Venue with both gym and pool | Classify by primary tag (OSM leisure tag takes precedence) |
| Hotel gym (open to guests) | Classified as `membership` — correct, non-guest can't enter |
| Free outdoor gym (street workout) | OSM tag = `leisure=fitness_station` ≠ `fitness_centre` → stays `open` |
| Google type "gym" on a climbing wall | Check OSM tag first; if `sport=climbing` → `ticket` overrides |
| User searches for gym (future search) | Search bypasses feed filters — returns all including membership |

## Files to create/modify

| File | Action |
|------|--------|
| `apps/api/src/app/entities/venue.entity.ts` | modify (add accessModel column) |
| Migration 014 | create (ALTER TABLE + classification) |
| `apps/api/src/app/recommendation/recommendation.service.ts` | modify (hard filter) |
| `apps/api/src/app/ingestion/ingestion.service.ts` | modify (classify on import) |
| `src/app/features/discover/discover.component.ts` | modify (gym category in expanded list) |
