# Reco Lab — Dev Score Inspector

Route: `/dev/reco-lab`

## What It Does

Interactive dashboard for testing the recommendation pipeline. Shows exact score decomposition per venue, taste profile state, and allows simulating user interactions with different signal weights.

**Pipeline parity**: Reco Lab uses the same pipeline as `discover()` — budget filter, interest filter, availability filter, impression discount, diversity dedup. Scores shown match what real users see.

## Controls

### Row 1: Filters
- **Interest**: All 11 categories + "All (no filter)". Auto-reloads on change.
- **Company**: solo / couple / friends / family. Affects company modifiers (couple boosts viewpoints, family penalizes nightlife).
- **Local type**: tourist / first_time / visitor / local. Affects chain penalty (tourist 0.90, local 0.80).
- **Pet**: Checkbox. Enables pet modifier (allowsDogs fact-based + tag proxy).

### Row 2: Actions
- **Reload**: Manually refresh results
- **Reset Profile**: Clears taste profile (DELETE from user_taste_profile) + resets UI state
- **Show more**: Pagination (+20 results per click, up to 60)

## Profile Panel

Shows current taste profile state:
- `signal_count` — total positive interactions
- `w_personal` — current personalization weight (0..0.20, ramps over 15 signals)
- Facet weights grouped by type (occasion, atmosphere, cuisine, format)
- Opacity reflects weight magnitude
- Negative facets shown in red

## Results Table

| Column | Tooltip | What it shows |
|---|---|---|
| # | — | Rank position |
| Name | Category + cuisine | Localized venue name (ru/en/ka based on locale) |
| Score | Category + flags | Final weighted score (sum of all components + personalization) |
| Int | Tags matched | Interest match component (0.45 weight) |
| Dist | — | Distance decay component (0.25 weight) |
| Time | Open/closed | Time fit component (0.15 weight) |
| Pers | Facet match details | Personalization component (0..0.20). Hover shows per-facet cosine. |
| Price | Price tier | Price gaussian boost (0..0.06) |
| Atm | Atmosphere + occasion | Gemini-enriched facets |
| Why | — | Top 3 matching facets from profile (blue = positive, red = negative) |
| Actions | Signal weights | 5 action buttons with different signal weights |

## 5 Action Types

Each action sends `POST /interactions` and triggers taste profile update with different signal weights:

| Button | Action | Signal Weight | Effect on Profile |
|---|---|---|---|
| heart | `save` | 1.0 | Maximum facet boost (IDF-weighted EMA) |
| **R** | `route` | 0.7 | Strong positive (built route = high intent) |
| **C** | `card_click` | 0.3 | Weak positive (opened card = mild interest) |
| **T** | `taxi` | 0.7 | Strong positive (called taxi = commitment) |
| **x** | `hide` | negative | Facet-level negative (threshold >= 2 concordant hides) |

Visual feedback: buttons highlight when action recorded (instant, before server response).

## Identity

Reco Lab uses a separate identity from the main app:
- `x-device-id: dev-reco-lab` header (not ProfileStore's deviceId)
- `deviceIdHash: cb5e734ba3ffdd0b` (SHA-256 of 'dev-reco-lab', first 16 hex chars)
- Interceptor in `app.config.ts` skips if `x-device-id` already set
- All actions (save/route/hide/reset) use the same dev identity

This prevents Reco Lab testing from contaminating the real user's taste profile.

## Pipeline Steps (matches discover())

```
1. Fetch places + events (PostGIS radius)
2. Budget filter
3. Score each candidate (interest + distance + time + quality + source + company + pet + chain)
4. Interest hard filter (strict >= 0.7 must match)
5. Availability filter (exclude confirmed-closed)
6. Personalization (cosine * w_personal + price boost)
7. Impression discount (0.85^unengaged)
8. Diversity dedup (max 1 per chain)
9. Sort by final score
10. Slice top 60
```

## Dev Strip (Header)

Visible in `isDevMode()` only. Shows on every page:
- Signal count, w_personal
- Top 3 positive facets
- Negative facet count
- Refreshes on route change

## Files

- `src/app/features/dev/reco-lab.component.ts` — Reco Lab UI
- `apps/api/src/app/recommendation/recommendation.service.ts` — `discoverWithExplanation()` endpoint
- `apps/api/src/app/recommendation/recommendation.controller.ts` — `/explain` route

## Database

Migration 019: Added `route`, `taxi`, `ticket_click`, `card_click`, `decide_open` to PostgreSQL `interaction_action` enum.
