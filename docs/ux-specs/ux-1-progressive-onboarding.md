# UX-1: Progressive Onboarding for Ghost Path

Priority: **3 — high**
Effort: 1 day (pre-deploy scope)

## Problem

"Лень отвечать — просто покажи ленту" leads to feed without interests or company.
Scoring works as "show everything by distance" — user sees no intelligence and
leaves with verdict "generic catalog". Ghost-path users are the most impatient —
exactly the ones who can't be met with a raw feed.

## Principle

Profile is built piece by piece right in the feed, no screens or modals.
One hint per session, each applied in one tap, each instantly improves what user sees.

---

## Pre-deploy scope (trimmed)

- [x] Tune-block for interests at position 6 in feed
- [x] "Показать" button triggers re-fetch
- [x] localStorage dismiss (simple: done/dismissed/pending)
- [ ] Session cooldown counter (3 sessions, dismissed-1 → 3 sessions → retry → never) — deferred to week 1
- [ ] Company tune-block (step 2: "Кто обычно с вами?" + 4 icon-buttons + pet toggle) — deferred to week 1
- [ ] Partial onboarding detection (skipped step 1 but did step 2 → show only interests) — deferred to week 1
- [ ] Network error handling ("Не получилось обновить" toast, keep selection, block stays) — deferred to week 1

---

## Ghost-path defaults

When user taps "Лень отвечать" on welcome:

```typescript
interests = {}           // show everything (no filtering)
company = 'solo'
hasPet = false
location = CityConfig.center (source='default')  // per UX-2
timeWindow = 'now'
onboardingCompleted = true  // mark as "done" to not re-show onboarding
```

Feed opens immediately — that's the ghost-path promise.

---

## Tune-block: Interests

### When to show

```typescript
const showTuneBlock =
  Object.keys(profileStore.interests()).length === 0  // no interests set
  && tuneState !== 'done'                              // not completed
  && tuneState !== 'never'                             // not permanently dismissed
  && !meta?.fallback                                   // no night fallback active (UX-3)
  && cards().length >= 1;                              // feed has content
```

### Position

Insert at index 5 (after 5 cards). If fewer than 6 cards → last element.

### Component: `FeedTuneBlockComponent`

```html
<div class="tune-block">
  <button class="tune-block__dismiss" (click)="dismiss()">Позже</button>
  <p class="tune-block__title">Лента станет точнее</p>
  <p class="tune-block__subtitle">Выберите 2–3 интереса — пересоберём мгновенно</p>
  <div class="tune-block__chips">
    @for (opt of interestOptions; track opt.slug) {
      <button class="ld-chip" [class.ld-chip--active]="selected().has(opt.slug)"
        (click)="toggle(opt.slug)">
        <ld-icon [name]="opt.icon" [size]="14" />
        {{ opt.label }}
      </button>
    }
  </div>
  @if (selected().size > 0) {
    <button class="ld-btn ld-btn--primary tune-block__apply" (click)="apply()">
      Показать
    </button>
  }
</div>
```

**Style:**
- Background: `--ld-primary-soft`, border-radius: 20px, no shadow.
- Distinct from content cards (no ld-card class).
- "Позже" — ghost link, top-right corner, 12px, `--ld-text-3`.
- Chips: same as onboarding interest chips (reuse `interestOptions` array).

**Inputs:** `interestOptions` (same array from onboarding component).
**Outputs:** `(applied)` emits selected interests map, `(dismissed)` emits void.

### Behavior

1. User taps chips → toggles selection (multi-select).
2. After first selection, "Показать" button appears.
3. Tap "Показать":
   - Save interests to profileStore.
   - Emit `(applied)` → parent triggers `loadFeed()` with feed loader.
   - Tune-block removed from DOM.
   - Scroll to top.
   - Set `ld-hints.interestsTune = 'done'` in localStorage.
4. Tap "Позже":
   - Set `ld-hints.interestsTune = 'dismissed'` (pre-deploy: permanent).
   - Tune-block removed.

### State (localStorage)

```typescript
// Pre-deploy: simple state
type TuneState = 'pending' | 'done' | 'dismissed';

// Read/write via localStorage key: 'ld-hints'
interface LdHints {
  interestsTune: TuneState;
  // Future: companyTune, sessionCount, swipePeek, locationTooltip
}
```

---

## Discover component integration

In the template, between card iteration:

```typescript
// In component class
readonly showTuneBlock = computed(() => {
  const hints = this.getHints();
  return Object.keys(this.profileStore.interests()).length === 0
    && hints.interestsTune !== 'done'
    && hints.interestsTune !== 'dismissed'
    && !this.feedMeta()?.fallback
    && this.cards().length >= 1;
});

// In template, within @for loop:
@for (card of cards(); track card.id; let i = $index) {
  @if (i === 5 && showTuneBlock()) {
    <app-feed-tune-block
      [interestOptions]="interestOptions"
      (applied)="onTuneApplied($event)"
      (dismissed)="onTuneDismissed()" />
  }
  <app-result-card ... />
}
```

`onTuneApplied(interests)`:
1. `profileStore.setInterests(interests)`
2. `loadFeed()`
3. `window.scrollTo({ top: 0, behavior: 'smooth' })`

---

## Week 1 additions (out of pre-deploy scope)

### Session cooldown
- Session = app start with >30 min gap (compare `Date.now()` vs `ld-hints.lastSeen`).
- After first "Позже": show again after 3 sessions.
- After second "Позже": never show again (`interestsTune = 'never'`).

### Company tune-block (step 2)
- Condition: interests set AND company never changed.
- Show on 3rd session at position 6.
- 4 icon-buttons + pet toggle.
- Same dismiss rules.

### Partial onboarding detection
- User did onboarding but skipped step 1 (interests) → show interest tune-block.
- User did interests but skipped step 2 → show company tune-block.

---

## Files to create/modify

| File | Action |
|------|--------|
| `src/app/features/discover/feed-tune-block/feed-tune-block.component.ts` | create |
| `src/app/features/discover/discover.component.ts` | modify (insert tune-block) |
| `src/app/core/stores/profile.store.ts` | verify setInterests exists |
| `src/app/core/utils/ld-hints.ts` | create (localStorage helper) |