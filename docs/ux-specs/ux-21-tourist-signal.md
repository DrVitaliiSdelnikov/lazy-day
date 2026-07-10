# UX-21: Tourist vs Local Signal

Priority: **week 1-2**
Effort: 1-2 hours

## Problem

Locals and tourists have different JTBD:
- Local: "что нового?" → boost fresh, less-known places
- Tourist: "что must-see?" → boost highly_rated, culture, viewpoints

Currently scoring treats both identically.

## Solution

One boolean question, big effect.

### Onboarding addition

Step 0 (before interests) or end of step 1:
"Вы в Тбилиси впервые?" → Yes / No / Живу здесь

Maps to `profileStore.localLevel`:
- `tourist` (first time) → boost `highly_rated` ×1.3, boost `culture`/`viewpoint` ×1.2
- `visitor` (been before) → neutral
- `local` → slight boost to lower-rated hidden gems, deprioritize obvious landmarks

### Scoring change

In `scoreCandidate`, after company/pet modifiers:

```typescript
if (profile.localLevel === 'tourist') {
  if (c.google_rating >= 4.5) interestScore = Math.min(1, interestScore * 1.3);
  if (tags.includes('viewpoint') || tags.includes('culture')) {
    interestScore = Math.min(1, interestScore * 1.2);
  }
}
```

### Profile store

```typescript
localLevel: 'tourist' | 'visitor' | 'local';  // default: 'local'
```

### i18n

```json
"onboarding": {
  "local_question": "Are you in Tbilisi for the first time?",
  "local_tourist": "First time",
  "local_visitor": "Been before",
  "local_local": "I live here"
}
```

## Files to modify

| File | Action |
|------|--------|
| `src/app/core/stores/profile.store.ts` | add localLevel |
| `src/app/features/discover/onboarding/onboarding.component.ts` | add question |
| `apps/api/src/app/recommendation/recommendation.service.ts` | scoring modifier |
| `libs/shared-models/src/lib/types.ts` | add to DiscoverRequest.profile |
