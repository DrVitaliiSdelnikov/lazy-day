# UX-4: Hide — Discoverability, Reversibility, Signal

Priority: **4 — high**
Effort: 0.5 day (pre-deploy scope)

## Problem

Swipe "hide" is a gesture that (a) nobody discovers on their own, (b) once found
accidentally, hides a favorite place forever, (c) as a signal for future re-ranking
is noisy: "hid" doesn't say why.

## Three layers — phased delivery

| Layer | What | When |
|-------|------|------|
| A. Discoverability | Desktop hover icon + detail "Скрыть" | pre-deploy |
| B. Reversibility | Undo toast 6s with "Вернуть" | pre-deploy |
| C. Signal | Reason chips + interaction API | week 1 |
| A+ | Swipe peek animation | week 1 |
| B+ | "Скрытые" screen in profile | week 2 |

---

## Pre-deploy scope

### 1. Undo toast on hide (6 seconds)

When user swipes to hide (or taps hide in detail):

```html
<div class="ld-toast ld-toast--undo">
  <span>Скрыто</span>
  <button class="ld-toast__action" (click)="undoHide()">Вернуть</button>
</div>
```

- Duration: **6 seconds** (longer than standard 2.5s — important action).
- "Вернуть" restores card to feed at original position and removes from hiddenIds.
- Only one undo-toast at a time (new hide replaces previous).
- Toast auto-dismisses after 6s → hide is permanent.

**Implementation:** `ToastService` or simple signal in discover component.

```typescript
readonly undoableHide = signal<{ card: RecommendationCard; index: number; timer: any } | null>(null);

onHideCard(card: RecommendationCard) {
  // Clear previous undo timer
  const prev = this.undoableHide();
  if (prev) clearTimeout(prev.timer);

  const index = this.cards().findIndex(c => c.id === card.id);
  this.profileStore.addHiddenId(card.id);

  const timer = setTimeout(() => {
    this.undoableHide.set(null);
  }, 6000);

  this.undoableHide.set({ card, index, timer });
}

undoHide() {
  const u = this.undoableHide();
  if (!u) return;
  clearTimeout(u.timer);
  this.profileStore.removeHiddenId(u.card.id);
  this.undoableHide.set(null);
}
```

### 2. Desktop hover hide icon

On desktop (≥1024px), result-card shows `eye-off` icon on hover, next to heart:

```html
<!-- In result-card template -->
@if (isDesktop) {
  <button class="card__hide-btn" (click)="hide.emit(); $event.stopPropagation()"
    aria-label="Скрыть">
    <ld-icon name="eye-off" [size]="16" />
  </button>
}
```

Style: appears on `.ld-card:hover`, positioned top-right next to heart.
Opacity 0 → 1 on hover, transition 150ms.
On touch devices: hidden (touch has swipe gesture).

### 3. Detail "Скрыть" action

Already exists in action row. Verify it triggers same `onHideCard` flow with undo toast.

---

## Week 1: Reason chips + Signal

### Undo toast v2

```html
<div class="ld-toast ld-toast--undo">
  <div class="ld-toast__main">
    <span>Скрыто</span>
    <button class="ld-toast__action" (click)="undoHide()">Вернуть</button>
  </div>
  <div class="ld-toast__reasons">
    <span class="ld-toast__why">Почему?</span>
    <button class="ld-toast__reason" (click)="setReason('far')">Далеко</button>
    <button class="ld-toast__reason" (click)="setReason('not_mine')">Не моё</button>
    <button class="ld-toast__reason" (click)="setReason('been')">Уже был</button>
  </div>
</div>
```

- "Почему?" label: 11px, `--ld-text-3`.
- Reason chips: small, muted style.
- Tap on reason → closes toast immediately, records reason.
- Reason is optional — if toast times out, reason = null.

### Interaction API

Uses existing `interaction_events` table (migration 013) with `context` JSONB field:

```
POST /v1/interactions
{
  action: 'hide',
  targetType: 'place' | 'event',
  targetId: string,
  context: {
    reason: 'far' | 'not_mine' | 'been' | null
  }
}
```

Maps to `interaction_events.event_type = 'hide'`, reason stored in `context` JSONB.

Future re-ranking semantics (document now, implement later):
- `far` — don't penalize interest, penalize distance tolerance
- `not_mine` — negative weight to place tags
- `been` — not negative, marker "explored" (candidate for future "Been here")
- `null` — weak general negative

Hiding operates on (device, target) pair — `hiddenIds` already works this way.

### Swipe peek animation (one-time)

On first-ever feed load, after 1.5s, first card slides −24px left revealing
red zone with `eye-off` icon, then returns (600ms ease-out).

- `ld-hints.swipePeek = 'done'` in localStorage.
- `prefers-reduced-motion` → skip animation, show one-time toast instead:
  "Свайп влево по карточке — скрыть"

---

## Week 2: "Скрытые" screen

Profile → "Скрытые места и события (N)" link.

- Compact card list: title, category icon, hide date.
- "Вернуть" button on each card.
- "Вернуть все" ghost button in header.
- Empty state: "Ничего не скрыто"
- Hidden events auto-removed when event date has passed.
- Hidden places — permanent until restored.

---

## Files to create/modify (pre-deploy)

| File | Action |
|------|--------|
| `src/app/features/discover/discover.component.ts` | modify (undo toast, undoableHide signal) |
| `src/app/features/discover/result-card/result-card.component.ts` | modify (desktop hover icon) |
| `src/app/features/detail/detail.component.ts` | verify hide action |
| `src/app/core/stores/profile.store.ts` | verify removeHiddenId exists |
