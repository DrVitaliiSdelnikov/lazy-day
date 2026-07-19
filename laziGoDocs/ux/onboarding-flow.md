# User Onboarding Flow

## Entry Points

1. **Direct URL** (`lazigo.app`) → Landing page
2. **Language URL** (`lazigo.app/ru/tbilisi/today`) → Landing page with locale
3. **Deep link** (`lazigo.app/detail/place/uuid`) → Detail card (no onboarding)

## Landing Page (`AdLandingComponent`)

Guard: `ld_welcome_done` in localStorage. If set → redirect to `/discover`.

1. Welcome screen with company chips (solo, couple, friends, family)
2. Preset chips (mood-based: coffee, food, nightlife, culture, nature, active)
3. Event preview cards
4. "Start" → saves selections to ProfileStore → navigates to `/discover`

## Discover Page

First load:
1. `ProfileStore` provides interests, company, pet
2. `POST /v1/recommendations` with profile
3. 8 scored cards rendered
4. No personalization (0 signals)

## No-Gate Design (F3.5)

There is NO registration, NO login, NO blocking onboarding. The app works immediately:

- Anonymous identity via `POST /v1/auth/anon` (cookie `ld_uid`)
- Profile stored in localStorage (survives sessions)
- Taste profile stored server-side by `device_id_hash`
- First interaction starts learning immediately
- No "complete your profile" gates

## Progressive Disclosure

| Signals | What user sees |
|---|---|
| 0 | Pure content-based results. No "why" labels. |
| 1-5 | Results start shifting. Subtle personalization. |
| 5-15 | "Why" labels appear on matching venues. Taste profile visible in settings. |
| 15+ | Full personalization. User sees clear preference influence. |
