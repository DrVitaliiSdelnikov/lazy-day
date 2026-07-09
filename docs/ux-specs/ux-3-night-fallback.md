# UX-3: Night Empty Feed (Time Fallback)

Priority: **2 — critical blocker**
Effort: 1 day

## Problem

At 23:30, `timeWindow=now` + availability filter cuts almost everything.
Adaptive radius expands geography but doesn't help at night — closed everywhere.
User sees emptiness on their first evening visit. Evening is our prime time.

## Principle

Empty feed is forbidden as long as the city has anything for tomorrow.
Fallback is honest: app says what it did and lets user revert.

---

## Backend: Pipeline Step 9 — TIME FALLBACK

Location: `apps/api/src/app/recommendation/recommendation.service.ts`

After step 8 (adaptive radius), add:

```
Step 9: TIME FALLBACK
  if relevantCount < 5
    AND timeWindow == 'now'
    AND city local hour in [21:00, 06:00):
      re-run pipeline with timeWindow = 'tomorrow'
        - places: evaluate openStatus at tomorrow 12:00
        - events: starts_at within tomorrow (00:00-23:59)
      add to response: meta.fallback = 'tomorrow', meta.originalCount = N
  if tomorrow also < 3 results:
      return what exists + meta.fallback = 'exhausted'
```

**Threshold 5** — synced with adaptive radius threshold.
**Night boundary 21:00** — conservative: at 21:30 many places are still open,
fallback simply won't trigger by count condition.

### 24/7 places night boost

In scoring, time component (step 7): if local hour in [23:00, 06:00) and
place has `opening_hours` containing `24/7` or `00:00-24:00`:
add +0.05 to time component. Bars and late-night spots surface before fallback triggers.

### Response meta extension

```typescript
interface DiscoverResponse {
  cards: RecommendationCard[];
  meta?: {
    fallback?: 'tomorrow' | 'exhausted';
    originalCount?: number;
  };
}
```

---

## Frontend changes

### 1. Fallback banner (new inline component)

Shown above card list when `meta.fallback === 'tomorrow'`:

```html
<div class="discover__fallback-banner">
  <span>Сейчас почти всё закрыто — показываем на завтра</span>
  <button class="ld-btn ld-btn--ghost" (click)="forceNow()">Всё равно сейчас</button>
</div>
```

Style: `--ld-surface-2` background, radius 14, 12px text, padding 12px 16px.
Lives as long as user scrolls — not a toast.

### 2. "Всё равно сейчас" behavior

- Sets `forcedTimeWindow = 'now'` for this session (signal, not persisted).
- Re-fetches without fallback logic (server skips step 9 when `forcedNow=true` param).
- If result is empty → night empty state:
  - Icon: `ld-icon name="zzz"` (already registered)
  - Text: "Город спит. Ближайшее — завтра"
  - Primary button: "Показать завтра" → clears `forcedTimeWindow`, re-fetches

`forcedTimeWindow` resets on session end (app restart / >30 min gap — same as UX-1 session definition, but for pre-deploy can simply be a signal that resets on page reload).

### 3. Context bar time chip

When fallback active: time chip shows "Завтра" with `--ld-warn` dot indicator
(same dot style as location default indicator from UX-2).
This signals "auto-decision" vs user's choice.

### 4. Card status badge in tomorrow mode

Places in tomorrow-mode: status badge shows "Завтра с 10:00" instead of
"Открыто"/"Закрыто". Never lie about current open status.

Implementation: when `meta.fallback === 'tomorrow'`, each card's `openStatus`
is rewritten client-side or (better) server returns `tomorrowOpenTime` field.

### 5. Greeting override

When fallback active, replace night greeting:
- Current: "Не спится? Есть варианты."
- With fallback: "Спланируем на завтра?"

### 6. Interaction with UX-1

When fallback is active, tune-blocks are NOT shown.
Check: `meta.fallback !== undefined → skip tune-block insertion`.

---

## API changes

### Request

Add optional `forcedNow: boolean` param to discover endpoint.
When true, server skips step 9 entirely.

### Response

Add optional `meta` field (see type above).

---

## Files to create/modify

| File | Action |
|------|--------|
| `apps/api/src/app/recommendation/recommendation.service.ts` | modify (step 9, 24/7 boost) |
| `apps/api/src/app/recommendation/dto/discover.dto.ts` | modify (forcedNow param) |
| `libs/shared-models/src/lib/recommendation.ts` | modify (meta in response) |
| `src/app/features/discover/discover.component.ts` | modify (banner, greeting, forcedNow) |
| `src/app/features/discover/result-card/result-card.component.ts` | modify (tomorrow badge) |
| `src/app/features/discover/context-bar/context-bar.component.ts` | modify (time chip) |

---

## Edge cases

| Case | Behavior |
|------|----------|
| 20:59 → 21:01 while app open | Next feed refresh triggers fallback if count < 5 |
| User in different timezone | City local time (UTC+4), not device time |
| All 24/7 places already in feed | No fallback needed — count >= 5 |
| Event tonight at 23:00 | Included in "now" results (not yet ended) |
| Forced "now" + filter change | Keep `forcedTimeWindow` until explicit reset or session end |
| Tomorrow is holiday | No special handling — same pipeline, more places likely open |