# UX-13: Linear Onboarding — Hide Tab Bar

Priority: **pre-deploy**
Effort: 1-2 hours

## Problem

Tab bar is visible during welcome/onboarding, allowing navigation away from
the flow before completion. Onboarding should be a focused, linear tunnel.

## Solution

Tab bar hidden until onboarding is completed or skipped.

### Implementation

In `AppShellComponent`:

```typescript
readonly showNav = computed(() => {
  const route = this.router.url;
  return !route.includes('/welcome') && !route.includes('/onboarding');
});
```

```html
@if (showNav()) {
  <nav class="nav">...</nav>
}
```

### Navigation during onboarding

- Welcome: only "Начать" (→ onboarding) and "Лень отвечать" (→ feed with defaults).
- Onboarding: only "Дальше" and "Пропустить" (= complete with defaults for remaining steps).
- No back button, no tab navigation.
- "Пропустить" at any step = mark `onboardingCompleted = true` + apply defaults for unanswered steps.

### Edge case: deep link on fresh install

User arrives via external link `/detail/:type/:id` on clean install:
- Detail page shows immediately (no onboarding gate).
- Welcome/onboarding shown on first navigation to feed (`/discover`).
- Check in `DiscoverComponent.ngOnInit()` already handles this.

### Profile as permanent home

After onboarding, all settings live in Profile (settings page):
- Interests: editable list with same chips.
- Company: same icon buttons.
- Pet toggle.
- Location.
- Tune-blocks (UX-1) link to Profile for manual edits.

## Files to modify

| File | Action |
|------|--------|
| `src/app/core/layout/app-shell.component.ts` | modify (conditional nav) |
| `src/app/features/discover/welcome/welcome.component.ts` | verify no nav leak |
| `src/app/features/discover/onboarding/onboarding.component.ts` | verify skip behavior |
