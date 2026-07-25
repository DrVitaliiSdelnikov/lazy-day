# Onboarding Business Logic — Detailed Specification

*Updated 2026-07-25 after E1-E9 refactor.*

## System Components

### 1. AdLandingComponent (`/`)
**File**: `src/app/features/landing/ad-landing.component.ts`

**Role**: Primary entry point. Ad traffic, organic, direct URL.

**Init logic** (`ngOnInit`):
```
1. Check localStorage('ld_welcome_done')
   → exists: redirect /discover (replaceUrl: true), STOP
   → missing: continue (new user)

2. Detect language:
   → route data lang (from /en/tbilisi/today, /ru/tbilisi/today, /ka/tbilisi/today)
   → fallback: ProfileStore.locale()
   → fallback: 'ru'
   → apply: setLang() → ProfileStore + TranslateService + currentLang signal

3. Fire GA4 event:
   gtag('event', 'landing_view', { language, landing_type: 'ad' | 'organic' })

4. Load example cards:
   POST /v1/recommendations with current preset/company/pet selections
   → filter: places (non-chain, limit 3) + events (limit 3)
```

**Landing layout** (top to bottom):
1. Language switcher (RU/EN/KA)
2. H1: "Что посмотреть в Тбилиси — прямо сейчас" (mirrors ad keyword)
3. Subtitle: "Одна рекомендация — и всё. Без регистрации."
4. **Single primary CTA**: "Показать, куда пойти" (full-width, 48px)
5. Secondary text link: "Настроить под себя" → onboarding
6. Trust line: "3 168 мест · обновлено сегодня"
7. **Preset chips** (9, from `CANONICAL_PRESETS`) — session filters above cards
8. Filter state line: "Показываем: {label}" (when preset active)
9. **Live cards** (3 places + 3 events mixed)
10. How it works (3 steps)
11. **Company / pet** (below fold)
12. Final CTA (same button text)
13. Differentiator text (condensed in footer)

**User selections**:
- **Preset chips** (9 items, from `CANONICAL_PRESETS` via `PRESET_META`):
  All weights defined in `libs/shared-models/src/lib/interests.ts`
- **Company chips** (4): solo, couple, friends, family (below fold)
- **Pet toggle**: boolean (below fold)
- **Tourist/local**: removed — default `'local'` (chains ×0.80)

**Exit paths**:

| Action | What happens | Sets ld_welcome_done | Sets onboardingCompleted |
|---|---|---|---|
| "Показать, куда пойти" (goToFeed) | applySelectionsToStore → /discover | YES | YES |
| "Настроить под себя" (goToOnboarding) | applySelectionsToStore → /discover/onboarding | NO (sets ld_onboarding_started) | NO |
| Click on example card | goToFeed() | YES | YES |

**applySelectionsToStore()**:
```
1. If company selected → profileStore.setCompany(company)
2. If pet → profileStore.setHasPet(true)
3. If preset selected → sessionStorage('ld_filters').preset = key
   (NOT written to ProfileStore — session filter only)
```

---

### 2. WelcomeComponent — DELETED
Removed in E8. Route `/discover/welcome` no longer exists.

---

### 3. OnboardingComponent (`/discover/onboarding`)
**File**: `src/app/features/discover/onboarding/onboarding.component.ts`

**Role**: Detailed preference setup. **2-step wizard** (was 3).

**Init** (`ngOnInit`):
```
1. Fetch categories from API: GET /v1/meta/categories
   (ld_welcome_done NOT set here — only on completion)
```

**Step 1 — Interests** (9 items, from `INTEREST_OPTIONS`):
```
nature, food, culture, active, entertainment, nightlife, family, spa, gym
```
Multi-select chips. Each selected interest gets weight = 1.0.

**Step 2 — Company & Pet**:
- Company: solo / couple / friends / family (single select)
- Pet: toggle
- Tourist/local: removed — default `'local'`
- Button: "Готово" → finishOnboarding()

**Step 3 — REMOVED**: Geolocation removed from onboarding. Deferred to discover page geo chip priming.

**finishOnboarding()**:
```
1. Build interests: { slug: 1.0 } for each selected
2. profileStore.setInterests(interests)
3. If company → profileStore.setCompany(company)
4. profileStore.setHasPet(pet)
5. profileStore.completeOnboarding()
6. localStorage.setItem('ld_welcome_done', 'true')
7. localStorage.removeItem('ld_onboarding_started')
8. router.navigate(['/discover'])
```

---

### 4. Welcome Guard (`app.routes.ts`)
**File**: `src/app/app.routes.ts`

```typescript
function welcomeGuard() {
  if (typeof localStorage === 'undefined') return true;
  if (localStorage.getItem('ld_welcome_done')) return true;
  if (localStorage.getItem('ld_onboarding_started')) return true;  // passthrough for onboarding
  return inject(Router).createUrlTree(['/']);
}
```

Applied to `/discover` route (including child routes like `/discover/onboarding`).

**NOT applied to**: `/detail/:type/:id`, `/saved`, `/settings`, `/privacy`, `/dev/reco-lab`

**Wildcard**: `**` → redirects to `/` (landing), not `/discover`

---

### 5. Discover Presets (in-feed)
**File**: `src/app/features/discover/discover.component.ts`

**9 preset chips** in toolbar, from `PRESET_META` (canonical source):
```
chill, food, culture, active, family, nightlife, gym, entertainment, spa
```

Presets built from `CANONICAL_PRESETS` + `CANONICAL_RADIUS`:
```typescript
// Built dynamically from canonical source, no local hardcoded copy
private readonly MOOD_PRESETS = Object.fromEntries(
  Object.entries(CANONICAL_PRESETS).map(([key, interests]) => [key, {
    interests, radiusM: CANONICAL_RADIUS[key] ?? 5000,
    ...(key === 'family' ? { company: 'family' } : {}),
  }])
);
```

**Behavior**: Preset OVERRIDES ProfileStore interests temporarily for that request. Does NOT write to ProfileStore. Toggling off = back to ProfileStore interests.

---

### 6. Feed Tune Block (inline card)
**File**: `src/app/features/discover/feed-tune-block/feed-tune-block.component.ts`

**9 interest chips** from `INTEREST_OPTIONS` (canonical source).

**Behavior**:
- Shows at position 6 in feed (or after last card if < 6)
- Multi-select chips
- "Применить" → emits `{ slug: 1.0 }` for each selected (unified weight, was 0.8)
- Parent `DiscoverComponent.onTuneApplied()` calls `profileStore.setInterests(interests)` → writes to ProfileStore → reloads feed
- "Не интересно" → dismisses block, doesn't change interests

---

## Canonical Interest Taxonomy

**Single source of truth**: `libs/shared-models/src/lib/interests.ts`

All components import from here — no local copies.

**Exports**:
- `CANONICAL_PRESETS` — 9 presets with interest weights
- `CANONICAL_RADIUS` — per-preset radius values
- `PRESET_META` — UI metadata (key, labelKey, icon) for preset chips
- `INTEREST_OPTIONS` — interest list for onboarding/tune block

**Weight scheme** (documented):
- `1.0` — primary interest, explicitly selected
- `0.5` — associated interest, logically linked
- `0.3` — weak association

---

## Data Flow Summary

### Two Interest Systems (CLEANED UP)

```
System 1: ProfileStore.interests (persistent, localStorage)
  Written by: Onboarding (finishOnboarding), Tune Block (onApply)
  Read by: Discover (when no preset active)
  Weight: 1.0 for all (unified)

System 2: Session filters (temporary, sessionStorage)
  Activated by: Landing preset chips, Discover preset chips
  Read by: Discover (overrides ProfileStore when active)
  Weight: from CANONICAL_PRESETS (varies per preset)
  Duration: until preset deselected or session ends
  NOT written to ProfileStore
```

**Key change**: Landing preset chips NO LONGER write to ProfileStore. They only write to sessionStorage. This is the documented intentional behavior.

### What happens at each step

| User action | interests source | Written to ProfileStore? | Preset chip highlighted? |
|---|---|---|---|
| Lands on / with no selections | {} (empty) | no | no |
| Selects "Культура" on landing | CANONICAL_PRESETS.culture → live cards | NO (session only) | yes on landing |
| Clicks "Показать, куда пойти" | sessionStorage preset → discover | NO | from sessionStorage |
| Arrives at /discover | ProfileStore.interests | — | from sessionStorage |
| Clicks "Культура" preset in discover | CANONICAL_PRESETS.culture overrides | NO | YES |
| Deselects preset | back to ProfileStore | — | no |
| Selects "Спа" in tune block | { spa: 1.0 } → ProfileStore | YES | NO (separate system) |
| Completes onboarding | { selected: 1.0 } → ProfileStore | YES | — |

### Identity Flow

```
First visit:
  ProfileStore generates deviceId (UUID) → localStorage('ld_profile')
  deviceIdHash cached in localStorage('ld_device_hash')
  ProfileSyncService → POST /v1/auth/anon → gets server uid → localStorage('ld_server_uid')
  Cookie ld_uid set by server
  x-device-id header on all /v1/ requests (interceptor)

Return visit:
  ProfileStore loads from localStorage
  ProfileSyncService restores from cookie (ld_uid)
  If localStorage was cleared (ITP): server profile → local merge
```

---

## Persistence Map

| Key | Storage | Set by | Read by |
|---|---|---|---|
| `ld_welcome_done` | localStorage | Landing (goToFeed), Onboarding (finishOnboarding) | Landing (skip check), Guard |
| `ld_onboarding_started` | localStorage | Landing (goToOnboarding) | Guard (passthrough), Onboarding (cleanup) |
| `ld_profile` | localStorage | ProfileStore | ProfileStore (init) |
| `ld_filters` | sessionStorage | Landing (preset), Discover (radius, time) | Discover (init) |
| `ld_server_uid` | localStorage | ProfileSyncService | InteractionService |
| `ld_device_hash` | localStorage | ProfileStore | ProfileStore (cached SHA-256) |
| `ld_device_hash_src` | localStorage | ProfileStore | ProfileStore (invalidation check) |
| `ld_first_touch` | localStorage | UTM service | Analytics (attribution) |

**Removed**:
- `ld_consent` — consent banner removed (Georgia jurisdiction, analytics unconditional)
- `ld_device_id` — legacy, replaced by ProfileStore.deviceId

---

## Resolved Issues (from E1-E9)

### ~~1. Three interest systems not synchronized~~ → FIXED (E1)
Single canonical source `interests.ts`. All components import from it. One weight scheme.

### ~~2. ld_welcome_done set too early~~ → FIXED (E3)
Only set in `finishOnboarding()` and `goToFeed()`. Temp `ld_onboarding_started` for guard passthrough.

### ~~3. Landing presets ≠ discover presets~~ → FIXED (E1)
Both use `CANONICAL_PRESETS`. Landing now has 9 presets (was 6).

### ~~4. Geolocation prompt in onboarding~~ → FIXED (E7)
Step 3 removed. Geolocation deferred to discover page geo chip priming.

### ~~5. WelcomeComponent is dead code~~ → FIXED (E8)
Deleted. Route removed.

### ~~6. Weight inconsistency~~ → FIXED (E1)
Tune block now uses 1.0 (was 0.8). All weights documented in interests.ts.

---

## Remaining Tech Debt

### 1. Tune block ↔ preset chips not synchronized
Selecting in tune block writes to ProfileStore but doesn't highlight matching preset chip in toolbar. Documented as intentional (filter vs preference distinction) but UX is confusing.

### 2. Event descriptions = 0%
No adapter parses event descriptions. All 197 events have `description = NULL`.

### 3. Route button shown for events without coordinates
FIXED (2026-07-25): button hidden when `!c.lat || !c.lng`.

### 4. Event distance = 6000km bug
FIXED (2026-07-25): `v?.lat ?? 0` → `v?.lat ?? null`. No more haversine to (0,0).
