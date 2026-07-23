# Geolocation Permission Playbook

## Current State (as of 2026-07-23)
GeolocationService already implements the correct pattern:
- `silentInit()` checks `permissions.query` → only fetches if `granted`
- `requestPosition()` only called on user gesture (sidebar "Detect" button)
- Native prompt NEVER fires on page load
- Default: Tbilisi center (41.6934, 44.8015)

## What's Missing

### Stage 1 (highest leverage, ~1-2 days)
1. **Persistent header chip** showing location state
   - Off: "Центр Тбилиси · Включить геолокацию"
   - On: "Рядом с вами · 350 м"
   - Visible on discover page, not naggy
2. **Priming screen** after first recommendation
   - Benefit-framed: "Покажем, что рядом с вами"
   - Privacy: "нигде не храним"
   - Buttons: [Показать места рядом] · [Не сейчас]
3. **Label degraded state** — "≈ от центра" on distance chips when no GPS

### Stage 2 (~2-4 days)
4. Manual neighborhood picker (Vake, Saburtalo, Old Town, Rustaveli)
5. Denied-state guidance with per-browser instructions
6. GA4 events: location_prompt_shown, _accepted, _dismissed, _granted, _denied

### Stage 3 (later)
7. Chromium `<geolocation>` element (Chrome 144+)
8. IP geolocation only if non-Tbilisi traffic detected

## Microcopy (3 languages)

### Priming screen
- RU: "Покажем, что рядом с вами" / "LaziGo сортирует места по расстоянию пешком. Нигде не храним." / [Показать места рядом] · [Не сейчас]
- EN: "See what's actually near you" / "LaziGo sorts places by walking distance. Never stored." / [Show nearby places] · [Not now]
- KA: "ნახეთ, რა არის თქვენთან ახლოს" / "LaziGo ალაგებს ადგილებს ფეხით მანძილის მიხედვით. არსად ვინახავთ." / [ახლომდებარე ადგილები] · [ახლა არა]

### Header chip
- RU: "📍 Центр Тбилиси · Включить геолокацию" / "📍 Рядом с вами"
- EN: "📍 Tbilisi center · Turn on location" / "📍 Near you"
- KA: "📍 თბილისის ცენტრი · ჩართე მდებარეობა" / "📍 თქვენთან ახლოს"

### Denied state
- RU: "Геолокация заблокирована. Включите в настройках браузера или выберите район."
- EN: "Location blocked. Enable in browser settings or pick your area."

## Key Research Points
- Chrome: 77% of prompts without user gesture → only 12% allowed. With gesture → 30%
- Chrome quiet-blocks after 3 dismissals — burns the origin
- Priming lifts opt-in from 25-35% to 50-65% (Adjust data, mobile)
- iOS Safari PWA: geolocation prompt may not appear in standalone mode
- Web opt-in structurally lower than native — aim for relative improvement

## Decision Threshold
If located users show large lift in route_clicked/qualified_session vs non-located → double down on priming.
If both convert equally poorly → location is not the bottleneck, focus on card UI.

## Files
- `src/app/core/services/geolocation.service.ts` — current implementation (correct pattern)
- `src/app/features/discover/discover.component.ts` — sidebar "Detect" button
