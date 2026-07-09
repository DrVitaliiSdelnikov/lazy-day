# UX-11: Saved Tab Badge

Priority: polish
Effort: 30 minutes

## Problem

No reminder about saved events happening today/tomorrow. Without push
notifications, tab badge is the only passive signal.

## Solution

Dot badge on "Избранное" tab (bottom nav mobile / top nav desktop) when any
saved event is today or tomorrow.

### Implementation

In `SavedStore` or computed in `AppShellComponent`:

```typescript
readonly hasUpcomingEvent = computed(() => {
  const saved = this.savedStore.items();
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59);

  return saved.some(item =>
    item.type === 'event' &&
    item.eventDate &&
    new Date(item.eventDate) <= tomorrow &&
    new Date(item.eventDate) >= now
  );
});
```

Badge: 8×8px dot, `background: var(--ld-primary)`, positioned top-right of tab icon.

```html
<div class="nav__tab" ...>
  <ld-icon name="heart" ... />
  @if (hasUpcomingEvent()) {
    <span class="nav__badge"></span>
  }
</div>
```

## Files to modify

| File | Action |
|------|--------|
| `src/app/core/layout/app-shell.component.ts` | modify (badge dot) |
| `src/app/core/stores/saved.store.ts` | verify eventDate field available |
