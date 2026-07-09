# UX-12: Theme-color Meta Switch

Priority: **6 — quick**
Effort: 5 minutes

## Problem

PWA status bar doesn't match app theme on first frame.

## Solution

In `src/index.html`, the inline theme-init script already runs before Angular.
Add `<meta name="theme-color">` update to the same script.

### Values

| Theme | Color | Source |
|-------|-------|--------|
| `theme-day` | `#FAF6ED` | `--ld-bg` day |
| `theme-evening` | `#F7F1F4` | `--ld-bg` evening |
| `theme-dark` | `#211E24` | `--ld-bg` dark |

### Implementation

Add to existing theme-init script in `index.html`:

```javascript
// After setting class on <html>:
const colors = { 'theme-day': '#FAF6ED', 'theme-evening': '#F7F1F4', 'theme-dark': '#211E24' };
let meta = document.querySelector('meta[name="theme-color"]');
if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
meta.content = colors[theme] || '#FAF6ED';
```

Also update in `ThemeService.setTheme()` for runtime switches:

```typescript
setTheme(theme: string) {
  // existing class swap...
  const colors: Record<string, string> = {
    'theme-day': '#FAF6ED', 'theme-evening': '#F7F1F4', 'theme-dark': '#211E24'
  };
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', colors[theme] || '#FAF6ED');
}
```

### manifest.webmanifest

Already has `theme_color` — verify it matches day theme (default).

## Files to modify

| File | Action |
|------|--------|
| `src/index.html` | modify (add meta update to theme-init script) |
| `src/app/core/services/theme.service.ts` | modify (update meta on runtime switch) |
