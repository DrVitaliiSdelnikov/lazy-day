# Onboarding Business Logic — Detailed Specification

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
   → filter: places (non-chain, limit 6) + events (limit 3)
```

**User selections on landing**:
- **Preset chips** (6 items, NOT 9 — missing entertainment, spa, gym):
  ```
  chill:     { nature: 0.8, food: 0.5, spa: 0.5 }
  food:      { food: 1 }
  culture:   { culture: 1, food: 0.3 }
  active:    { active: 1, sports: 0.5 }
  family:    { family: 1, entertainment: 0.5 }
  nightlife: { nightlife: 1 }
  ```
- **Company chips** (4): solo, couple, friends, family
- **Pet toggle**: boolean

**Exit paths**:

| Action | What happens | Sets ld_welcome_done | Sets onboardingCompleted |
|---|---|---|---|
| "Решить за меня" (goToFeed) | applySelectionsToStore → /discover | YES | YES |
| "Настроить интересы" (goToOnboarding) | applySelectionsToStore → /discover/onboarding | YES | NO |
| Click on example card | goToFeed() | YES | YES |

**applySelectionsToStore()**:
```
1. If preset selected → profileStore.setInterests(preset.interests)
2. If company selected → profileStore.setCompany(company)
3. If pet → profileStore.setHasPet(true)
4. Save preset key to sessionStorage('ld_filters').preset
```

**ISSUE**: `ld_welcome_done` is set BEFORE onboarding completes in goToOnboarding(). If user abandons onboarding, they're marked as "done" but have no interests set.

---

### 2. WelcomeComponent (`/discover/welcome`)
**File**: `src/app/features/discover/welcome/welcome.component.ts`

**Role**: Legacy splash screen. Not part of main flow (landing bypasses it).

**UI**: Language picker (RU/EN/KA) + "Начать" + "Пропустить всё"

**Exit paths**:

| Action | Destination | Sets ld_welcome_done | Sets onboardingCompleted |
|---|---|---|---|
| "Начать" | /discover/onboarding | YES | NO |
| "Пропустить всё" | /discover | YES | YES |

**NOTE**: No interests, company, or preset selections on this screen. Pure gate.

---

### 3. OnboardingComponent (`/discover/onboarding`)
**File**: `src/app/features/discover/onboarding/onboarding.component.ts`

**Role**: Detailed preference setup. 3-step wizard.

**Init** (`ngOnInit`):
```
1. Fetch categories from API: GET /v1/meta/categories
2. Set ld_welcome_done = 'true' (immediately, before user completes steps)
```

**Step 1 — Interests** (9 items):
```
nature, food, culture, active, entertainment, nightlife, family, spa, gym
```
Multi-select chips. Each selected interest gets weight = 1.0.

**Step 2 — Company & Context**:
- Company: solo / couple / friends / family (single select)
- Pet: toggle
- Local level: tourist / visitor / local (single select, default: local)

**Step 3 — Location**:
- "Определить мою" → `geo.requestPosition()` (MAY trigger native browser prompt)
- Manual coordinates input (decimal or DMS format)
- "Пропустить" → use default (пл. Свободы)

**finishOnboarding()**:
```
1. Build interests: { slug: 1.0 } for each selected
2. profileStore.setInterests(interests)
3. If company → profileStore.setCompany(company)
4. profileStore.setHasPet(pet)
5. profileStore.setLocalLevel(localLevel)
6. profileStore.completeOnboarding()
7. router.navigate(['/discover'])
```

**ISSUES**:
- `ld_welcome_done` set in ngOnInit BEFORE user completes any step
- Geolocation request in Step 3 can burn the native prompt if user hasn't seen value yet
- No way to go back to landing after entering onboarding

---

### 4. Welcome Guard (`app.routes.ts`)
**File**: `src/app/app.routes.ts`

```typescript
function welcomeGuard() {
  if (typeof localStorage === 'undefined') return true;
  if (localStorage.getItem('ld_welcome_done')) return true;
  return inject(Router).createUrlTree(['/']);
}
```

Applied to `/discover` route. New user typing `lazigo.app/discover` directly → redirect to `/`.

**NOT applied to**: `/detail/:type/:id`, `/saved`, `/settings`, `/privacy`, `/dev/reco-lab`

---

### 5. Discover Presets (in-feed)
**File**: `src/app/features/discover/discover.component.ts`

**9 preset chips** in toolbar (after 0.1c update):
```
chill, food, culture, active, family, nightlife, gym, entertainment, spa
```

Each preset maps to `MOOD_PRESETS`:
```typescript
chill:         { interests: { nature: 0.8, food: 0.5, spa: 0.5 }, radiusM: 5000 }
food:          { interests: { food: 1 }, radiusM: 5000 }
culture:       { interests: { culture: 1, food: 0.3 }, radiusM: 10000 }
active:        { interests: { active: 1, sports: 0.5 }, radiusM: 10000 }
family:        { interests: { family: 1, nature: 0.5, entertainment: 0.5 }, company: 'family', radiusM: 8000 }
nightlife:     { interests: { nightlife: 1, entertainment: 0.5 }, radiusM: 10000 }
gym:           { interests: { gym: 1, sports: 0.5 }, radiusM: 10000 }
entertainment: { interests: { entertainment: 1, nightlife: 0.3 }, radiusM: 10000 }
spa:           { interests: { spa: 1 }, radiusM: 8000 }
```

**Behavior**: Preset OVERRIDES ProfileStore interests temporarily for that request. Does NOT write to ProfileStore. Toggling off = back to ProfileStore interests.

---

### 6. Feed Tune Block (inline card)
**File**: `src/app/features/discover/feed-tune-block/feed-tune-block.component.ts`

**9 interest chips** (same list as onboarding):
```
nature, food, culture, active, entertainment, nightlife, family, spa, gym
```

**Behavior**:
- Shows at position 6 in feed (or after last card if < 6)
- Multi-select chips
- "Применить" → emits `{ slug: 0.8 }` for each selected (weight 0.8, not 1.0)
- Parent `DiscoverComponent.onTuneApplied()` calls `profileStore.setInterests(interests)` → writes to ProfileStore → reloads feed
- "Не интересно" → dismisses block, doesn't change interests

**CRITICAL DIFFERENCE**: Tune block writes to ProfileStore with weight 0.8. Presets override temporarily with weight 1.0. They don't know about each other.

---

## Data Flow Summary

### Three Interest Systems (THE PROBLEM)

```
System 1: ProfileStore.interests (persistent, localStorage)
  Written by: Landing, Onboarding, Tune Block, Settings
  Read by: Discover (when no preset active)
  Weight: varies (landing = from preset, onboarding = 1.0, tune = 0.8)

System 2: MOOD_PRESETS (temporary, in-memory)
  Activated by: Discover preset chips
  Read by: Discover (overrides ProfileStore when active)
  Weight: varies per preset definition
  Duration: until preset deselected or page reload

System 3: Landing presetChips (one-time, on exit)
  Activated by: Landing preset selection
  Written to: ProfileStore via applySelectionsToStore()
  Also: sessionStorage('ld_filters').preset for discover toolbar sync
```

### What happens at each step

| User action | interests source | Written to ProfileStore? | Preset chip highlighted? |
|---|---|---|---|
| Lands on / with no selections | {} (empty) | no | no |
| Selects "Культура" on landing | { culture: 1, food: 0.3 } | on exit only | no (landing has own chips) |
| Clicks "Решить за меня" | landing preset → ProfileStore | YES | sessionStorage sync |
| Arrives at /discover | ProfileStore.interests | — | from sessionStorage |
| Clicks "Культура" preset in discover | MOOD_PRESETS.culture overrides | NO | YES |
| Deselects preset | back to ProfileStore | — | no |
| Selects "Спа" in tune block | { spa: 0.8 } → ProfileStore | YES | NO (preset chips unaware) |
| Reload page | ProfileStore.interests = { spa: 0.8 } | — | no preset highlighted |

### Identity Flow

```
First visit:
  ProfileStore generates deviceId (UUID) → localStorage('ld_profile')
  ProfileSyncService → POST /v1/auth/anon → gets server uid → localStorage('ld_server_uid')
  Cookie ld_uid set by server

Return visit:
  ProfileStore loads from localStorage
  ProfileSyncService restores from cookie (ld_uid)
  If localStorage was cleared (ITP): server profile → local merge
```

---

## Persistence Map

| Key | Storage | Set by | Read by |
|---|---|---|---|
| `ld_welcome_done` | localStorage | Landing, Welcome, Onboarding | Landing (skip check), Guard |
| `ld_profile` | localStorage | ProfileStore | ProfileStore (init) |
| `ld_filters` | sessionStorage | Landing (preset), Discover (radius, time) | Discover (init) |
| `ld_server_uid` | localStorage | ProfileSyncService | InteractionService |
| `ld_device_id` | localStorage | Legacy (removed) | ProfileSyncService (hash) |
| `ld_consent` | localStorage | ConsentBanner | ProfileSyncService, InteractionService |
| `ld_first_touch` | localStorage | UTM service | Analytics (attribution) |
| `ld_device_hash` | localStorage | ProfileStore | ProfileStore (cached SHA-256) |
| `ld_device_hash_src` | localStorage | ProfileStore | ProfileStore (invalidation check) |

---

## Known Issues & Tech Debt

### 1. Three interest systems not synchronized
- Tune block writes ProfileStore but doesn't highlight matching preset chip
- Preset chips don't read from ProfileStore to show active state
- Landing has 6 presets, discover has 9, tune block has 9

### 2. ld_welcome_done set too early
- Onboarding sets it in ngOnInit (before any step completed)
- goToOnboarding sets it before navigating
- If user abandons mid-onboarding, they're permanently "done"

### 3. Landing presets ≠ discover presets
- Landing `presetChips` has own interest weights (hardcoded)
- Discover `MOOD_PRESETS` has different weights for same keys
- Example: landing "family" = `{ family: 1, entertainment: 0.5 }` but discover "family" = `{ family: 1, nature: 0.5, entertainment: 0.5 }` (adds nature)

### 4. Geolocation prompt in onboarding
- Step 3 calls requestPosition() which may trigger native prompt
- User hasn't seen product value yet at this point
- Contradicts geolocation playbook (gesture-gated after first value)

### 5. WelcomeComponent is dead code
- Not reachable from main flow (landing → discover or landing → onboarding)
- Route exists at /discover/welcome but nothing navigates to it
- Sets ld_welcome_done without collecting any preferences

### 6. Weight inconsistency
- Onboarding: interests weight = 1.0
- Tune block: interests weight = 0.8
- Landing presets: compound weights (0.3–1.0)
- No documentation on why weights differ