# UX-2: Location without GPS

Priority: **1 — critical blocker**
Effort: 1.5-2 days

## Problem

GPS denial (or desktop without GPS, or timeout) currently leads to manual DMS
coordinate input. Normal users will never enter coordinates — it's a dead end.

## Principle

Feed MUST work regardless of GPS response. Accuracy is an improvement, not a condition.

## Scope (pre-deploy)

- [x] City center default when GPS denied/timeout/desktop
- [x] Location pill in context bar showing state
- [x] Location sheet (bottom sheet on mobile, sidebar section on desktop)
- [x] Quick preset chips (named coordinates from CityConfig)
- [x] Google Maps URL parsing (full URLs)
- [x] Lat/lng pair parsing
- [ ] Short URL resolution (`goo.gl/maps/...`) — deferred to week 1 (needs server endpoint)

---

## Data Model

### CityConfig (new)

```typescript
// libs/shared-models/src/lib/city-config.ts

export interface CityPreset {
  key: string;        // 'center' | 'vake' | 'saburtalo' | 'old-town' | ...
  label: string;      // 'Центр' | 'Ваке' | ...
  lat: number;
  lng: number;
}

export interface CityConfig {
  id: string;           // 'tbilisi'
  name: string;         // 'Тбилиси'
  center: { lat: number; lng: number };  // 41.6934, 44.8015
  defaultRadiusKm: 3;
  maxRadiusKm: 50;      // validation boundary
  presets: CityPreset[];
}

export const TBILISI_CONFIG: CityConfig = {
  id: 'tbilisi',
  name: 'Тбилиси',
  center: { lat: 41.6934, lng: 44.8015 },
  defaultRadiusKm: 3,
  maxRadiusKm: 50,
  presets: [
    { key: 'center',    label: 'Центр',        lat: 41.6934, lng: 44.8015 },
    { key: 'vake',      label: 'Ваке',         lat: 41.7148, lng: 44.7537 },
    { key: 'saburtalo', label: 'Сабуртало',    lat: 41.7270, lng: 44.7710 },
    { key: 'old-town',  label: 'Старый город', lat: 41.6910, lng: 44.8080 },
    { key: 'vera',      label: 'Вера',         lat: 41.7060, lng: 44.7850 },
    { key: 'didube',    label: 'Дидубе',       lat: 41.7320, lng: 44.7950 },
  ],
};
```

### Position source (extend GeolocationService)

```typescript
export type PositionSource = 'gps' | 'default' | 'manual' | 'preset';

export interface GeoPosition {
  lat: number;
  lng: number;
  source: PositionSource;
  label?: string;  // 'Ваке', 'Моя точка', etc.
}
```

### localStorage

```
ld_position_manual = { lat, lng, label, source } | null   // persists manual/preset
```

GPS position is NOT persisted (re-requested on "Определить где я" or silently
on start if permission === 'granted').

---

## Components

### 1. GeolocationService changes

```
Current: position = signal({ lat, lng })
New:     position = signal<GeoPosition>({ lat, lng, source, label })
```

**Init flow:**
1. Check localStorage for `ld_position_manual` → if exists, use it.
2. Check `navigator.permissions.query({ name: 'geolocation' })`:
   - `granted` → silent `getCurrentPosition()`, set source='gps'.
   - `prompt` or `denied` → use CityConfig center, source='default'.
3. Never auto-prompt GPS. Only on explicit user tap.

**Methods:**
- `requestGps()` → calls `getCurrentPosition`, returns Promise<boolean>.
  If denied at browser level, returns false (caller shows instruction).
- `setManual(lat, lng, label)` → sets position, source='manual', persists.
- `setPreset(preset: CityPreset)` → sets position, source='preset', persists.
- `setDefault()` → sets CityConfig center, source='default', clears persisted.

**Validation:** if point > 50km from city center → reject, show message, use default.

### 2. LocationPill (new component in context-bar)

Displayed in context bar (mobile) and sidebar (desktop).

```
[source=gps]     →  "📍 Ваке · 2 км"     (reverse geocode district — or "Вы · 2 км")
[source=default] →  "📍 Центр Тбилиси · 3 км"  + warn dot (--ld-warn)
[source=manual]  →  "📍 Моя точка · 2 км"
[source=preset]  →  "📍 Ваке · 3 км"
```

Tap → opens LocationSheet.

**First-time tooltip** (source=default, once per install):
"Показываем от центра города. Уточните — станет точнее"
Stored: `ld-hints.locationTooltip = 'done'`

### 3. LocationSheet (new component)

Bottom sheet on mobile, section/popover on desktop. Contents:

1. **"Определить где я"** — primary button with location icon.
   - If `navigator.permissions` state === 'denied': show instruction text
     "Разрешите геолокацию в настройках браузера" + "Понятно" button instead.
2. **Input field** — "Вставьте ссылку из Google Maps или координаты"
   - Parses on blur or Enter.
   - Inline error below field if parse fails.
3. **Quick preset chips** — from CityConfig.presets.
   - Active chip highlighted if current position matches preset.
4. **Radius slider** — 1-15 km, step 1.

### 4. Input parsing (utility function)

```typescript
parseLocationInput(raw: string): { lat: number; lng: number } | null
```

**Parse order:**
1. Lat/lng pair: `41.715, 44.827` (comma / space / semicolon separators)
2. DMS: existing parser (fallback)
3. Google Maps URL patterns:
   - `/@{lat},{lng},{zoom}z` → extract after `@`
   - `?q={lat},{lng}` or `?query={lat},{lng}`
   - `/place/.../@{lat},{lng}` → extract after `@`
4. No match → return null

**Error message:** "Не получилось прочитать. Подойдёт ссылка из Google Maps
или координаты вида 41.71, 44.82"

**50km validation:** after successful parse, check distance from city center.
If > 50km: "LazyDay пока работает в Тбилиси — показываем от центра" → use default.

---

## Discover component changes

- Default radius for `source=default` → 3km (wider since point is approximate).
- Default radius for `source=gps` → 2km (current behavior).
- Sidebar: replace raw coordinates display with LocationPill.
- Context bar: add LocationPill.

---

## Edge cases

| Case | Behavior |
|------|----------|
| VPN/desktop with inaccurate IP | Don't use IP geolocation at all (worse than honest city center) |
| GPS returns point outside city | Same 50km rule — fallback to default |
| Tourist looking ahead from abroad | 50km rule catches this, default + message |
| Future city change | Presets and center from CityConfig — code doesn't change |
| Permission revoked mid-session | Next GPS request fails silently, keep current position |
| Multiple rapid preset taps | Debounce feed reload (existing 300ms debounce) |

---

## Files to create/modify

| File | Action |
|------|--------|
| `libs/shared-models/src/lib/city-config.ts` | create |
| `src/app/core/services/geolocation.service.ts` | modify (GeoPosition, sources) |
| `src/app/core/utils/parse-location.ts` | create |
| `src/app/features/discover/location-pill/location-pill.component.ts` | create |
| `src/app/features/discover/location-sheet/location-sheet.component.ts` | create |
| `src/app/features/discover/context-bar/context-bar.component.ts` | modify |
| `src/app/features/discover/discover.component.ts` | modify (sidebar, radius) |