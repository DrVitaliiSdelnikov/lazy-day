# UX-9: Heart Hit-Area

Priority: polish
Effort: 30 minutes

## Problem

Heart button hit-area overlaps with card tap zone → accidental saves.

## Solution

- Heart button: `min-width: 44px; min-height: 44px` (WCAG touch target).
- Card tap zone: 8px padding/gap from heart area (use `pointer-events: none`
  on a buffer zone or increase heart's absolutely-positioned inset).
- Desktop: `cursor: pointer` on heart, card has different cursor feedback.

## Files to modify

| File | Action |
|------|--------|
| `src/app/features/discover/result-card/result-card.component.ts` | modify styles |
