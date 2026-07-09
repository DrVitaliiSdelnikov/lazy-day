# UX-10: Language Fallback for Names

Priority: polish
Effort: 1 hour

## Problem

Some places have names only in Georgian or English. Missing name = empty card title.

## Solution

Fallback chain: `name` (ru) → `name_en` → `name_ka` → raw `name` from source.
No language label shown — "(en)" looks more like a bug than Latin script.

### Implementation

In recommendation service, when building card response:

```typescript
function resolveName(venue: VenueEntity, locale: string): string {
  if (locale === 'ru') return venue.name || venue.name_en || venue.name_ka || venue.originalName || 'Без названия';
  if (locale === 'en') return venue.name_en || venue.name || venue.name_ka || venue.originalName || 'Unnamed';
  return venue.name || venue.name_en || venue.originalName || 'Unnamed';
}
```

### Schema

Verify `venue` entity has `name`, `name_en`, `name_ka` fields.
If not, add in next migration. Current `name` field likely has mixed languages from OSM.

## Files to modify

| File | Action |
|------|--------|
| `apps/api/src/app/recommendation/recommendation.service.ts` | modify (name resolution) |
