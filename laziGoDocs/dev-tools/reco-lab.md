# Reco Lab — Dev Score Inspector

Route: `/dev/reco-lab`

## What It Does

Interactive dashboard for testing the recommendation pipeline. Shows exact score decomposition per venue, taste profile state, and allows simulating user interactions.

## Sections

### Controls
- **Category dropdown**: All 11 interest categories + "All (no filter)". Auto-reloads on change.
- **Load**: Manually refresh results
- **Reset Profile**: Clears taste profile (DELETE from user_taste_profile)

### Profile Panel
Shows current taste profile state:
- `signal_count` — total positive interactions
- `w_personal` — current personalization weight (0..0.20)
- Facet weights grouped by type (occasion, atmosphere, cuisine, format)
- Negative facets shown in red

### Results Table

| Column | Tooltip | What it shows |
|---|---|---|
| # | — | Rank position |
| Name | Category + cuisine | Localized venue name |
| Score | Category + flags | Final weighted score (sum of all components) |
| Int | Tags matched | Interest match component (0.45 weight) |
| Dist | — | Distance decay component (0.25 weight) |
| Time | Open/closed | Time fit component (0.15 weight) |
| Pers | Facet match details | Personalization component (0..0.20) |
| Price | Price tier | Price gaussian boost |
| Atmosphere | Atmosphere + occasion | Gemini-enriched facets |
| Why | — | Top 3 matching facets from profile (blue chips) |
| Actions | — | Like (heart) and Hide (x) buttons |

### Actions
- **Like (heart)**: `POST /interactions { action: "save" }` → updates taste profile → reloads
- **Hide (x)**: `POST /interactions { action: "hide" }` → records hide → reloads
- Visual feedback: heart fills pink, x grays out (instant, before server response)

## Technical Details

- Uses `POST /recommendations/explain` endpoint (not regular `/recommendations`)
- Sends `deviceIdHash` computed via `crypto.subtle.digest('SHA-256', 'dev-reco-lab')` → matches backend SHA-256
- Sends `x-device-id: dev-reco-lab` header for interactions
- Shows 60 results (vs 8 in regular discover)

## Dev Strip (Header)

Visible in `isDevMode()` only. Shows on every page:
- Signal count, w_personal
- Top 3 positive facets
- Negative facet count
- Refreshes on route change

## File

`src/app/features/dev/reco-lab.component.ts`
