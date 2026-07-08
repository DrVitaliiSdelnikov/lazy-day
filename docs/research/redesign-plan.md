# Research: UI Redesign Plan

## PrimeNG Audit: Should We Remove It?

### Current PrimeNG Usage

| Component | Files | What it does | Native replacement |
|---|---|---|---|
| `pButton` (ButtonModule) | 5 files | Styled `<button>` | `<button class="ld-btn">` — trivial |
| `p-tag` (TagModule) | 3 files | Colored badge/chip | `<span class="ld-badge">` — trivial |
| `p-slider` (SliderModule) | 3 files | Range slider (radius) | `<input type="range">` + CSS — easy |
| `p-selectbutton` (SelectButtonModule) | 3 files | Segmented toggle | Custom pill-toggle — easy |
| `p-drawer` (DrawerModule) | 2 files | Bottom sheet | Custom bottom-sheet — medium |
| `p-togglebutton` (ToggleButtonModule) | 1 file | Toggle on/off | `<button [class.active]>` — trivial |
| `p-skeleton` (SkeletonModule) | 1 file | Loading skeleton | `<div class="skeleton">` + CSS animation — trivial |
| `providePrimeNG` (config) | 1 file | Global PrimeNG config | Remove entirely |

### Verdict: YES, remove PrimeNG

**Reasons:**

1. **Only 7 components used**, all simple. No complex widgets (table, calendar, tree).
2. **Bundle impact**: PrimeNG adds ~80-100KB to chunks (shared primeng core + component modules). Our entire app logic is ~150KB — PrimeNG is 40%+ of non-Angular code.
3. **Design system conflict**: ui-spec.md defines a complete custom design system (tokens, radii, typography). PrimeNG's styling fights with custom tokens — we'd spend more time overriding than building.
4. **Drawer is the hardest**: bottom sheet with drag handle, backdrop, animation. ~50 lines of custom code.
5. **Slider is the second hardest**: `<input type="range">` + custom styling. ~30 lines CSS.
6. **Everything else is trivial**: buttons, tags, skeletons, toggles — pure CSS.

**Effort to remove PrimeNG**: ~4-6 hours. One-time cost that eliminates future override headaches.

### Replacement components needed

```
src/app/core/ui/
  ld-button.component.ts      — <button [variant]="'primary'|'secondary'|'ghost'|'icon'">
  ld-badge.component.ts       — <span [color]="'primary'|'open'|'event'|'secondary'">
  ld-slider.component.ts      — <input type="range"> with custom track/thumb
  ld-bottom-sheet.component.ts — backdrop + slide-up panel + drag handle
  ld-skeleton.component.ts    — shimmer divs
  ld-toggle.component.ts      — pill-style on/off
```

Or: no component wrappers at all — just CSS classes on native HTML. Simpler, faster, zero abstraction overhead.

---

## Redesign Scope (from ui-spec.md)

### What changes

| Area | Current | New (ui-spec.md) | Effort |
|---|---|---|---|
| **Tokens** | `--ld-*` basic (text, divider, primary) | 3 full themes (day/evening/dark), 30+ tokens each | 2 hours |
| **Fonts** | system-ui | Manrope (body) + Unbounded (display) | 30 min |
| **Theme switching** | manual light/dark | Auto by time of day (06-18 day, 18-06 evening) | 1 hour |
| **Tab bar** | Basic 4 tabs | 3 tabs (Discover, Saved, Profile) with Tabler icons | 1 hour |
| **Greeting header** | Static title "Discover" | Dynamic by time: "Лениво? Сейчас найдём." | 1 hour |
| **Context bar** | Chips with panels | 2 pills (location+radius, time) — simpler | 1 hour |
| **Mood presets** | 6 static chips | Time-dependent: day set vs evening set | 1 hour |
| **Result card (place)** | Current layout | Redesigned: title+heart, meta, badges, rating | 2 hours |
| **Result card (event)** | Purple stripe + icon | Same concept, refined: 4px stripe, ticket icon | 1 hour |
| **Filter sheet** | Basic drawer | Redesigned: segment control, grid chips, live count | 2 hours |
| **Detail page** | Basic layout | Color header + category icon, action row, sticky CTA | 2 hours |
| **Onboarding** | 3 steps | Same 3 steps, refined: Unbounded titles, grid chips | 1 hour |
| **Empty/error states** | Basic text | Branded: "Слишком лениво даже для нас" + action button | 30 min |
| **Toast** | None | Bottom toast with undo | 1 hour |
| **Swipe to hide** | No swipe | Left swipe → hide action | 2 hours |
| **Remove PrimeNG** | 7 components | Replace with native HTML + CSS | 4 hours |

**Total estimate: ~3-4 days** of focused work.

### What stays the same

- Routing structure (/discover, /detail/:type/:id, /saved, /settings, /privacy)
- API communication (ApiService, HttpApiService)
- State management (ProfileStore, SavedStore, signals)
- Scoring engine (backend unchanged)
- Data pipeline (backend unchanged)

### Order of implementation

```
Phase 1: Foundation (day 1)
  1. Remove PrimeNG — replace with native HTML + CSS classes
  2. Add fonts (Manrope + Unbounded via Google Fonts link)
  3. Implement 3 theme token sets in styles.scss
  4. Theme auto-switching service (time-based)

Phase 2: Shell + Discovery (day 2)
  5. Tab bar (3 tabs with Tabler icons)
  6. Greeting header (time-aware text)
  7. Context bar (2 pills: location, time)
  8. Mood presets (day vs evening sets)
  9. Bottom sheet (custom, replaces p-drawer)

Phase 3: Cards (day 3)
  10. Result card — place (new layout with badges)
  11. Result card — event (refined stripe + ticket icon)
  12. Skeleton loading (custom shimmer)
  13. Empty/error states

Phase 4: Detail + Polish (day 4)
  14. Detail page (color header, action row)
  15. Onboarding (Unbounded titles, refined chips)
  16. Toast component (with undo)
  17. Settings page (theme selector)
  18. Swipe-to-hide gesture (if time)
```

### CSS Architecture

```scss
// styles.scss — global
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700&family=Unbounded:wght@500&display=swap');

.theme-day { /* 30+ tokens */ }
.theme-evening { /* 30+ tokens */ }
.theme-dark { /* 30+ tokens */ }

// Base reset + typography
body { font-family: 'Manrope', 'Noto Sans Georgian', system-ui, sans-serif; }

// Utility classes
.ld-btn { /* primary/secondary/ghost/icon variants via data-attr or class */ }
.ld-badge { /* colored pill badges */ }
.ld-chip { /* interactive selection chips */ }
.ld-card { /* card surface with shadow + radius */ }
.ld-sheet { /* bottom sheet */ }
.ld-skeleton { /* shimmer animation */ }
```

No component library. Pure CSS + native HTML + Angular standalone components.

### Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Breaking existing functionality | High | Redesign one component at a time, test each |
| Slower than estimated | Medium | PrimeNG removal first (unblocks everything) |
| Missing PrimeNG feature | Low | We use only simple components |
| Font loading delay (FOUT) | Low | `font-display: swap` + preload link |
| Theme flash on load | Low | Set theme class in `<script>` before Angular boots |

---

## Decision Summary

| Question | Answer |
|---|---|
| Remove PrimeNG? | **Yes** — 7 trivial components, 40%+ bundle waste, fights custom design |
| When to redesign? | **Before deploy** — first impression matters, current UI is generic |
| Custom components or CSS classes? | **CSS classes** — no abstraction overhead, full control |
| Fonts? | **Manrope + Unbounded** via Google Fonts, preloaded |
| Theme logic? | **Auto by city timezone**, stored preference in ProfileStore |
