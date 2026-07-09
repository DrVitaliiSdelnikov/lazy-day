# UX-6: Preset Reset UX

Priority: **5 — quick**
Effort: 15 minutes

## Problem

Active mood preset chip has no visual affordance for deselection.
Repeat tap works (already implemented) but isn't discoverable.

## Solution

Active chip gets "×" icon on the right side.

```html
<!-- In discover template, preset chips -->
<button class="ld-chip"
  [class.ld-chip--active]="activePreset() === p.key"
  (click)="applyPreset(p.key)">
  <ld-icon [name]="p.icon" [size]="14" />
  {{ p.label }}
  @if (activePreset() === p.key) {
    <ld-icon name="x" [size]="12" class="ld-chip__clear" />
  }
</button>
```

Style addition for `.ld-chip__clear`:
```css
.ld-chip__clear {
  margin-left: 2px;
  opacity: 0.7;
}
```

Same treatment for both mobile toolbar chips and desktop sidebar chips.

**Behavior note:** active preset does NOT survive app restart
(preset is mood, not setting). Signal resets on page load — already the case.

## Files to modify

| File | Action |
|------|--------|
| `src/app/features/discover/discover.component.ts` | modify (add × icon to active chip) |

## Need `x` icon

Already registered in `ld-icon.component.ts` — verify. If not, add Tabler `x` path:
```
x: '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12"/><path d="M6 6l12 12"/>'
```
