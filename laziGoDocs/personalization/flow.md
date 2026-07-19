# Personalization Flow: From Cold Start to Learned Profile

How LaziGo learns what a user likes and adapts recommendations over time.

## Overview

LaziGo uses a **faceted taste profile** — a vector of weighted facets (cuisine, atmosphere, occasion, price) that evolves with every user interaction. The system starts content-based (scoring by distance, time, interest category) and gradually blends in personalization as it learns.

## The Journey

### Stage 1: First Visit (0 signals)

User opens LaziGo for the first time.

```
Profile: empty
w_personal: 0.000 (personalization weight = 0)
Scoring: 100% content-based
```

**What happens:**
1. User lands on `/` (landing page) or `/discover/onboarding`
2. Onboarding asks: interests (chips), company (solo/couple/friends/family), pet toggle
3. These go to `ProfileStore` (localStorage) — NOT the taste profile
4. First request to `POST /v1/recommendations`:
   - `profile.interests` = selected categories (e.g., `{ food: 1, culture: 1 }`)
   - `profile.company` = solo/couple/friends/family
   - `profile.hasPet` = true/false
5. Scoring formula (all equal for same-category venues):
   ```
   score = 0.45 * interestMatch
         + 0.25 * distanceDecay
         + 0.15 * timeFit
         + 0.10 * cardQuality
         + 0.05 * sourceConfidence
   ```
6. No personalization component — `w_personal = 0`
7. Results sorted by distance + time (since interest is same for matching category)

**What the user sees:**
- 8 scored cards, nearest open venues matching their interest
- "Why" labels based on category match only: "Открыто", "12 мин"
- No "Совпадает с вашим вкусом" — no taste data yet

### Stage 2: First Interaction (1 signal)

User taps heart on a restaurant card.

```
Frontend: POST /v1/interactions
  { cardType: "place", cardId: "uuid", action: "save" }
  Header: x-device-id: <uid from cookie>
```

**Backend chain:**
1. `FeedbackController` receives interaction
2. `FeedbackService.log()` saves to `interactions` table
3. `FeedbackService` hashes deviceId: `SHA-256(deviceId).slice(0, 16)` → `deviceIdHash`
4. Calls `TasteProfileService.updateOnPositive(deviceIdHash, cardId, 'save')`
5. `TasteProfileService`:
   - Loads place from DB with facets: `facet_cuisine`, `facet_atmosphere`, `facet_occasion`, `facet_price_tier`
   - Loads `facet_idf` table (pre-computed, 131 facets)
   - For each facet on the venue:
     ```
     eta = signalWeight * idf(facet)  // save=1.0, route=0.7, card_click=0.3
     newWeight = decay * oldWeight + (1 - decay) * eta
     // decay = 0.9 (EMA)
     ```
   - Example: user saves a Georgian restaurant
     - `cuisine:georgian` IDF = 2.83 (common) → eta = 1.0 * 2.83 = 2.83
     - `cuisine:sushi` IDF = 6.68 (rare) → would get higher weight if saved
   - Updates `user_taste_profile` table (UPSERT)
   - `signal_count` incremented to 1

6. `ImpressionService.recordEngagement(deviceIdHash, cardId)`:
   - Marks venue as "engaged" in `impression_agg` — won't be discounted

**Result:**
```
Profile: { cuisine: { georgian: 0.28 }, atmosphere: { cozy: 0.15 }, ... }
signal_count: 1
w_personal: 0.013 (= 0.20 * min(1, 1/15))
```

### Stage 3: Building Preferences (2-7 signals)

User continues browsing, saving places they like.

**Each positive action (save, route, share, taxi, card_click):**
- EMA updates existing facet weights
- New facets added with IDF-weighted initial value
- `signal_count` grows
- `w_personal` ramps linearly: `0.20 * min(1, signals/15)`

```
After 5 signals:
  w_personal = 0.20 * 5/15 = 0.067
  Profile might look like:
    atmosphere: { instagram_worthy: 0.85, scenic: 0.72, romantic: 0.41 }
    cuisine: { georgian: 0.34, european: 0.21 }
    occasion: { date: 0.55, exploring: 0.38 }
```

**Scoring now includes personalization:**
```
baseScore = 0.45*interest + 0.25*distance + 0.15*time + 0.10*quality + 0.05*source
personalScore = cosine(userProfile, venueFacets) // 0..1
priceBoost = gaussian(userPricePref, venuePriceTier) // β=0.06

finalScore = baseScore + w_personal * personalScore + priceBoost
```

**What changes in results:**
- Venues with matching facets get +0.01 to +0.07 boost
- Not enough to override distance/time, but breaks ties
- "Совпадает с вашим вкусом" label starts appearing on matching venues

### Stage 4: Negative Signal (hide)

User hides a venue they don't like.

```
Frontend: POST /v1/interactions
  { action: "hide" }
```

**Backend:**
1. `TasteProfileService.updateOnHide(deviceIdHash, cardId)`:
   - Loads venue facets
   - Increments `neg_counters` for each facet
   - **Threshold check**: only applies negative weight when a facet has been hidden >= 2 times
   - This prevents one accidental hide from poisoning the profile
   - Negative weight: `eta_neg = 0.4 * eta_pos`, floor at -0.5
2. `ImpressionService.recordHide(deviceIdHash, cardId)`:
   - Sets discount to 100 (venue never shown again to this user)

**Example:**
```
User hides 2 fast-food places with atmosphere: "casual", "quick_stop"
After 2nd hide:
  atmosphere: { casual: -0.12, quick_stop: -0.18 }
  // These facets now REDUCE score for matching venues
```

### Stage 5: Mature Profile (15+ signals)

```
w_personal = 0.20 (max, capped)
signal_count: 15+
```

**Full personalization active:**
- Cosine similarity can add up to +0.20 to score
- This is significant — can move a venue 5-10 positions up
- Price preference gaussian stabilizes
- Category floor: negative facets can't go below -0.5 (prevents total blackout)

**Scoring impact comparison:**

| Component | Weight | Range | Max contribution |
|---|---|---|---|
| Interest match | 0.45 | 0..1 | 0.450 |
| Distance | 0.25 | 0..1 | 0.250 |
| Time fit | 0.15 | 0..1 | 0.150 |
| Quality | 0.10 | 0..1 | 0.100 |
| Source | 0.05 | 0..1 | 0.050 |
| **Personalization** | **0.20** | **0..1** | **0.200** |
| Price boost | - | 0..0.06 | 0.060 |
| Chain penalty | - | x0.80..1.0 | -0.200 |

### Stage 6: Ongoing Learning

The profile never stops learning. Key mechanisms:

**EMA decay (0.9):** Recent signals weigh more. If user's taste shifts (stops liking Georgian, starts liking Japanese), the profile gradually follows.

**Impression discount:** Venues shown but not engaged get `0.85^count` discount after 24h. This naturally rotates content — user sees new places even without changing preferences.

**Epsilon exploration (1/8):** Every 8th result slot is a random "explore" venue. Introduces serendipity even in mature profiles.

**Session dithering:** Small random noise prevents identical results on reload. Deterministic per session (same seed).

## Data Requirements

For personalization to work, venues need facets:

| Facet | Source | Coverage |
|---|---|---|
| `facet_cuisine` | Google types mapping | ~50% food venues |
| `facet_format` | Google types mapping | ~60% all venues |
| `facet_atmosphere` | Gemini Flash-Lite | 100% (3,168 venues) |
| `facet_occasion` | Gemini Flash-Lite | 100% |
| `facet_price_tier` | Google Enterprise | ~40% (need more) |

## Database Tables

| Table | Purpose |
|---|---|
| `user_taste_profile` | PK: `device_id_hash`. JSONB: `facet_weights`, `price_pref`, `neg_counters`, `signal_count` |
| `facet_idf` | Pre-computed IDF values per facet. Refreshed daily at 04:00 UTC |
| `impression_agg` | One row per user+venue. Tracks `shown_count`, `engaged`, `hidden`, `last_shown_at` |
| `interactions` | Raw interaction log (save, hide, route, share, etc.) |

## User Controls (Settings)

Users can manage their taste profile in Settings:

- **View positives**: Top facets that boost their score (chips, removable)
- **View negatives**: Facets that reduce score (chips, removable)
- **Remove facet**: Tap x on any chip → `PATCH /v1/recommendations/taste-profile { removeFacet: { type, value } }`
- **Reset all**: "Reset taste profile" button → deletes entire `user_taste_profile` row
- **"How it works"**: Bottom sheet explaining the system in user language

## Dev Tools

### Reco Lab (`/dev/reco-lab`)
- Score decomposition table: Int, Dist, Time, Pers, Price per venue
- Profile inspector: facet weights, signal count, w_personal
- Like/Hide actions with visual feedback
- Category filter with all 11 interests
- "Why" column showing top matching facets

### Dev Strip (header, devMode only)
- Signal count, w_personal, top 3 facets, negative count
- Refreshes on navigation

## Key Constants

```typescript
DECAY = 0.9              // EMA decay factor
W_PERSONAL_MAX = 0.20    // Max personalization weight
W_PERSONAL_RAMP = 15     // Signals to reach max weight
NEG_THRESHOLD = 2         // Hides before negative applied
NEG_RATIO = 0.4           // Negative strength vs positive
NEG_FLOOR = -0.5          // Min negative weight
IDF_MIN = 2.0             // Don't penalize common facets
PRICE_BETA = 0.06         // Price gaussian width
IMPRESSION_DISCOUNT = 0.85 // Per-impression decay
EPSILON_RATE = 1/8         // Explore slot frequency
CHAIN_MULTIPLIER = 0.85    // Chain venue penalty (local user)
```

## Files

| File | What |
|---|---|
| `apps/api/src/app/recommendation/taste-profile.service.ts` | Core personalization engine |
| `apps/api/src/app/recommendation/impression.service.ts` | Freshness & impression tracking |
| `apps/api/src/app/recommendation/recommendation.service.ts` | Scoring pipeline |
| `apps/api/src/app/feedback/feedback.service.ts` | Interaction → taste profile wiring |
| `apps/api/src/app/ingestion/facet-mapper.service.ts` | Google types → facets + IDF |
| `apps/api/src/app/ingestion/gemini-enrichment.service.ts` | Gemini atmosphere/occasion |
| `src/app/features/settings/settings.component.ts` | User-facing profile controls |
| `src/app/features/dev/reco-lab.component.ts` | Dev score inspector |
