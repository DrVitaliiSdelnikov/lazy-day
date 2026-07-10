# UX-23: Reactive Session Refinement

Priority: **week 1-2** (after UX-1 tune-block is stable)
Effort: 1-1.5 days

## Problem

User scrolls past 8+ cards without clicking or saving. The feed showed them
"food" but they wanted specifically "cafe" — or "culture" but specifically
"museums". Current system can't detect this in real-time. User leaves thinking
"generic catalog".

## Principle

React to behavioral dissatisfaction signal, not profile gaps.
One inline prompt per feed load. Never annoying — appears only when
the data says "this isn't working".

---

## Trigger logic (client-side)

```typescript
interface ScrollTracker {
  viewedCount: number;      // cards scrolled past (IntersectionObserver)
  clickedAny: boolean;      // any card_click or save in this feed load
  feedLoadId: string;       // reset on each loadFeed()
}
```

**Show refinement block when ALL true:**
1. `viewedCount >= 8` — user saw enough content to judge
2. `clickedAny === false` — zero engagement signal
3. Active category is "wide" (has ≥2 sub-tags with ≥3 results each)
4. No tune-block (UX-1) already shown in this session
5. No night fallback active (UX-3)
6. Not already dismissed this session
7. Feed is not in "Decide for me" mode

**Cancel trigger on:** any `card_click`, `save`, or `hide` event resets
`clickedAny = true` → block never appears.

### Scroll detection

IntersectionObserver on each `<app-result-card>`, threshold 0.5 (50% visible).
When observed → increment `viewedCount`. Lightweight — no scroll event listeners.

```typescript
// In discover component
private scrollObserver?: IntersectionObserver;
private viewedCards = new Set<string>();

ngAfterViewInit() {
  this.scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !this.viewedCards.has(e.target.id)) {
        this.viewedCards.add(e.target.id);
      }
    });
  }, { threshold: 0.5 });
}

// Reset on each loadFeed()
private resetScrollTracker() {
  this.viewedCards.clear();
  this.feedClickedAny = false;
}
```

---

## Sub-tag extraction (client-side from existing data)

No API change needed. Cards already have `primaryTags: string[]`.
Count tag frequency across current `cards()`:

```typescript
readonly refinementTags = computed(() => {
  const cards = this.cards();
  const tagCounts = new Map<string, number>();

  for (const c of cards) {
    for (const tag of c.primaryTags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  // Remove the parent category tag (it matches everything)
  const parentTag = this.getActiveParentTag(); // e.g., 'food', 'culture'
  tagCounts.delete(parentTag);

  // Filter: only tags with ≥3 results, max 6 chips
  return [...tagCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({ tag, count }));
});

readonly isWideCategory = computed(() => this.refinementTags().length >= 2);
```

### Real data validation

Tested on local DB:

| Category | Sub-tags with ≥3 results | Refinable? |
|---|---|---|
| food (60 cards) | cafe: 26, restaurant: 19 | ✅ yes |
| culture (55 cards) | gallery: 12, theater: 9, museum: 8 | ✅ yes |
| active (2 cards) | gym: 2, sports: 2 | ❌ no (too few cards) |
| nature | park, garden, viewpoint | ✅ likely |

Categories "active" and "spa" are too small — refinement won't trigger. Correct behavior.

---

## UI: inline refinement block

Same visual pattern as tune-block (UX-1) — `--ld-primary-soft` background,
radius 20, no shadow. Inserted at position 9 (after 8th card that triggered it).

```html
<div class="refine-block">
  <button class="refine-block__dismiss" (click)="dismissRefinement()">×</button>
  <p class="refine-block__title">{{ 'refine.title' | translate }}</p>
  <div class="refine-block__chips">
    @for (t of refinementTags(); track t.tag) {
      <button class="ld-chip" (click)="applyRefinement(t.tag)">
        {{ t.tag | translate }} ({{ t.count }})
      </button>
    }
  </div>
</div>
```

### Behavior on tap

1. User taps "cafe" chip
2. Client filters current cards to only those with `primaryTags.includes('cafe')`
3. If filtered count ≥ 5 → show filtered results, remove refinement block
4. If filtered count < 5 → client-side filter + message "Кафе рядом мало — добавили похожее"
   (show filtered first, then remaining cards sorted by relevance)
5. Scroll to top
6. Track: `interaction_events { eventType: 'refine', context: { tag: 'cafe', category: 'food' } }`

**Key decision: client-side filtering, NOT API re-request.**
Why: cards are already loaded, sub-tags are a subset. No network latency,
instant response. API request only if user then scrolls to "show more".

### Behavior on dismiss

- `×` or scroll past → block disappears for this session
- `ld-hints.refineDismissed = sessionTimestamp` in localStorage
- No cooldown across sessions — each new feed load is a fresh chance

---

## API changes

**None for MVP.** Client-side filtering from existing `primaryTags`.

### Future (v1): `tags` filter in DiscoverRequest

When "show more" is needed after refinement:

```typescript
export interface DiscoverRequest {
  // ... existing fields
  refineTags?: string[];  // strict filter by specific tags
}
```

In scoring: if `refineTags` present, require at least one match (hard filter).
Deferred — client-side filtering is sufficient for first 60 cards.

---

## Interaction with other features

| Feature | Rule |
|---|---|
| UX-1 tune-block | Mutually exclusive: "one hint per session" |
| UX-3 night fallback | Don't show refinement during fallback |
| "Decide for me" (K1) | Don't show refinement if overlay is open |
| Mood presets | Refinement resets when preset changes |
| Feed reload | Reset scroll tracker, refinement state |

---

## i18n

```json
"refine": {
  "title": "Не совсем? Сузим поиск:",
  "few_results": "рядом мало — добавили похожее"
}
```

```json
"refine": {
  "title": "Not quite? Narrow it down:",
  "few_results": "few nearby — added similar"
}
```

```json
"refine": {
  "title": "არ არის ზუსტად? დავაზუსტოთ:",
  "few_results": "ცოტაა ახლოს — დავამატეთ მსგავსი"
}
```

### Tag labels

Sub-tags need human-readable labels. Reuse existing `lInterest()` map from
recommendation service for API-returned tags. On client, map common tags:

```typescript
const TAG_LABELS: Record<string, Record<string, string>> = {
  restaurant: { ru: 'Рестораны', en: 'Restaurants', ka: 'რესტორნები' },
  cafe: { ru: 'Кафе', en: 'Cafes', ka: 'კაფეები' },
  bar: { ru: 'Бары', en: 'Bars', ka: 'ბარები' },
  bakery: { ru: 'Пекарни', en: 'Bakeries', ka: 'პურსაცხობები' },
  museum: { ru: 'Музеи', en: 'Museums', ka: 'მუზეუმები' },
  gallery: { ru: 'Галереи', en: 'Galleries', ka: 'გალერეები' },
  theater: { ru: 'Театры', en: 'Theaters', ka: 'თეატრები' },
  park: { ru: 'Парки', en: 'Parks', ka: 'პარკები' },
  garden: { ru: 'Сады', en: 'Gardens', ka: 'ბაღები' },
  viewpoint: { ru: 'Смотровые', en: 'Viewpoints', ka: 'ხედები' },
  // ... extend as needed
};
```

---

## State model

```typescript
// Per feed-load state (resets on loadFeed)
interface RefinementState {
  viewedCardIds: Set<string>;
  clickedAny: boolean;
  dismissed: boolean;
  appliedTag: string | null;
}
```

No persistence needed — entirely session-scoped.
`interaction_events` captures the refinement for future re-ranking.

---

## Metrics

| Metric | Target | How to measure |
|---|---|---|
| Refinement block CTR | > 25% | refine events / refinement_shown impressions |
| Post-refinement click rate | > 40% | card_click after refine / sessions with refine |
| Show frequency per session | < 0.3 | refinement_shown / total sessions |
| False trigger rate | < 10% | manual review: was refinement actually needed? |

---

## Files to create/modify

| File | Action |
|------|--------|
| `src/app/features/discover/refine-block/refine-block.component.ts` | create |
| `src/app/features/discover/discover.component.ts` | add IntersectionObserver, scroll tracker, refinement logic |
| `public/assets/i18n/*.json` | add refine.* + tag label keys |
| `src/app/core/utils/tag-labels.ts` | create (tag→label map) |

## Implementation order

1. **Scroll tracker** — IntersectionObserver on result cards, viewedCount signal
2. **Tag extraction** — computed from cards().primaryTags
3. **Trigger logic** — computed combining scroll + clicks + wide category
4. **Refine block component** — chips, dismiss, visual matching tune-block
5. **Client-side filtering** — filter cards by selected tag, cascade if few
6. **i18n** — refine.* keys + tag labels
7. **Tracking** — refine event in interaction_events
