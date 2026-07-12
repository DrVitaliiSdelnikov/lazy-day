# LaziGo — Google Ads Implementation Plan

Pre-launch checklist with exact tasks, dependencies, and acceptance criteria.
Reference: `docs/research/google-ads-spec.md` for full spec.

---

## Day 1: UTM + Events Foundation

### Task 1.1: UtmService — preserve ad parameters in SPA
**What**: Capture UTM params on entry, persist in sessionStorage, pass to all tracking.
**Files**: create `src/app/core/services/utm.service.ts`, modify `InteractionService`
**Acceptance**: Navigate landing→discover→detail→back. Check sessionStorage has utm params.

### Task 1.2: `qualified_session` event
**What**: Fire when user opens ≥2 cards AND does ≥1 action (route/save/share/taxi).
**Files**: modify `discover.component.ts` (track opened cards set + action flag)
**Acceptance**: Open 2 cards, tap route → `qualified_session` in interaction_events + GA4.

### Task 1.3: Additional GA4 events
**What**: Fire `landing_view`, `recommendation_generated`, `no_results` via gtag().
**Files**: modify `discover.component.ts`, landing component
**Acceptance**: GA4 DebugView shows all 3 events with correct params.

### Task 1.4: Pass UTM + localLevel to interaction_events context
**What**: Every interaction_event includes UTM params and tourist/local segment.
**Files**: modify `InteractionService.flush()`, `BatchEventsDto`
**Acceptance**: interaction_events in DB have utm_source, utm_campaign in context JSONB.

---

## Day 2: Landing Pages

### Task 2.1: AdLandingComponent
**What**: Dedicated landing page for ad traffic. NOT welcome/onboarding.
**Files**: create `src/app/features/landing/ad-landing.component.ts`
**Content** (above fold, no scroll needed):
- H1: "Куда сходить в Тбилиси сегодня" / "What to do in Tbilisi today"
- Subtitle: value prop (one sentence)
- 4-6 real example cards (pre-fetched from API)
- Primary CTA: "Подобрать места" / "Get my recommendations"
- No registration message
- Language switcher (top-right)

**Below fold**:
- "How it works" — 3 steps with icons
- Context examples (solo, couple, family, pet)
- Categories (food, nature, events, nightlife)
- "Not another list" differentiator block
- Repeat CTA

**CTA behavior**: Navigate to /discover, skip onboarding entirely (ghost path).
If UTM has context (e.g. ad group `EN_CONTEXT` with "date ideas"), pre-set
company=couple before loading feed.

### Task 2.2: Routes
**What**: `/en/tbilisi/today`, `/ru/tbilisi/today`, `/ka/tbilisi/today`
**Files**: modify `app.routes.ts`
**Acceptance**: All 3 URLs load correct language, CTA leads to feed with results.

### Task 2.3: Landing i18n
**What**: Translation keys for landing page content.
**Files**: modify `ru.json`, `en.json`, `ka.json`
**Keys**: `landing.title`, `landing.subtitle`, `landing.cta`, `landing.how_*`,
`landing.differentiator`, `landing.no_account`

---

## Day 3: GTM + Consent Mode v2 + GA4↔Ads

### Task 3.1: Consent Mode v2
**What**: Set default denied consent, update on Accept/Decline.
**Files**: modify `index.html` (default consent), `consent-banner.component.ts` (update)
**Params**: `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`
**Acceptance**: Tag Assistant shows correct consent state before and after Accept.

### Task 3.2: GTM migration (optional — can stay direct)
**What**: Replace direct GA4/Metrika scripts with GTM container.
**Decision**: If GTM adds complexity without benefit for MVP, keep direct scripts.
GTM is needed only if we want non-developer event management.
**Recommendation**: Skip GTM for now. Direct scripts + gtag() sufficient.

### Task 3.3: GA4 ↔ Google Ads linking
**What**: Link GA4 property to Google Ads account.
**Where**: GA4 Admin → Google Ads linking
**Acceptance**: Google Ads can see GA4 events.

### Task 3.4: Import qualified_session as conversion
**What**: In Google Ads, create conversion action from GA4 event.
**Settings**: category=Engagement, count=One per click, window=7 days, attribution=data-driven
**Acceptance**: Google Ads shows qualified_session as conversion.

### Task 3.5: Auto-tagging
**What**: Enable auto-tagging in Google Ads.
**Where**: Google Ads → Settings → Auto-tagging
**Acceptance**: `gclid` appears in URLs after ad click.

---

## Day 4: Testing

### Task 4.1: Flow testing — each language
**What**: Complete ad click → landing → CTA → feed → card → action → qualified_session
**Test on**: iOS Safari, Android Chrome, desktop Chrome, desktop Firefox
**Check**: UTM preserved, events fire, consent works, no blank screens

### Task 4.2: Edge cases
**What**: Test with GPS denied, slow connection, in-app browser (Telegram WebView)
**Check**: Feed loads from default center, no_results doesn't fire with default radius,
loading state visible (not blank)

### Task 4.3: `no_results` audit
**What**: Test all ad group intents to ensure feed returns results.
**Combos to test**:
- food interests → should return 60 cards
- events tonight → check count (may be thin)
- date ideas (couple) → should return quality results
- kids activities (family) → check count
- dog friendly → check count
- nightlife → check count
**Fix**: If any combo returns <5 results, adjust ad copy or pause that ad group.

### Task 4.4: GA4 DebugView verification
**What**: Walk through entire flow in DebugView mode.
**Check**: `landing_view`, `recommendation_generated`, `place_opened` (with position),
`route_clicked`, `qualified_session` — all appear with correct params.

---

## Day 5: Campaign Setup (in Google Ads)

### Task 5.1: Account structure
**What**: Create 3 campaigns in paused state per spec section 6.
- S_TBS_EN_LOCAL ($8/day)
- S_TBS_RU_LOCAL ($7/day)
- S_TBS_KA_LOCAL ($3/day)

### Task 5.2: Keywords + negatives
**What**: Enter all keywords from spec sections 6-8.
**Match types**: exact + phrase only, no broad.
**Negatives**: account-level list from spec section 8.

### Task 5.3: Ads
**What**: One RSA per ad group with headlines + descriptions from spec section 9.
**Assets**: sitelinks, callouts, structured snippets.

### Task 5.4: Settings verification
- Location: Tbilisi, Presence only
- Search Partners: OFF
- Time: 08:00-01:00 Tbilisi
- Bidding: Maximize Clicks with CPC cap
- Final URL suffix with UTM template

### Task 5.5: Budget control
**What**: Set account-level budget alert at $440.
**Why**: Google can spend up to 2× daily budget on any single day.

---

## Pre-Launch Checklist

### Product
- [ ] Landing pages exist (EN, RU, KA)
- [ ] Landing content matches ad copy
- [ ] CTA leads to feed (ghost path, no onboarding wall)
- [ ] Feed works without GPS (default center)
- [ ] District presets available as fallback
- [ ] No critical `no_results` for ad group intents
- [ ] Loading state visible (not blank "Просыпаемся…" for in-app browsers)

### Analytics
- [ ] GA4 receives `landing_view` with campaign params
- [ ] GA4 receives `recommendation_generated` with result_count
- [ ] GA4 receives `place_opened` with position and category
- [ ] GA4 receives `route_clicked`, `favorite_added`, `share_clicked`
- [ ] GA4 receives `qualified_session` (≥2 cards + ≥1 action)
- [ ] GA4 receives `no_results` when feed empty
- [ ] UTM params preserved through SPA navigation
- [ ] `gclid` preserved and passed to GA4
- [ ] Consent Mode v2 verified via Tag Assistant
- [ ] GA4 linked to Google Ads
- [ ] `qualified_session` imported as primary conversion
- [ ] Auto-tagging enabled

### Google Ads
- [ ] 3 campaigns created (EN, RU, KA)
- [ ] Keywords entered (exact + phrase)
- [ ] Negative keywords loaded
- [ ] RSA ads created with headlines + descriptions
- [ ] Sitelinks, callouts, snippets added
- [ ] Search Partners OFF
- [ ] Location: Tbilisi, Presence only
- [ ] Budget: $18/day total, $440 account alert
- [ ] Bidding: Maximize Clicks with CPC cap
- [ ] Final URL suffix with UTM template
- [ ] All campaigns in paused state, ready to enable

### Operations
- [ ] Daily Search Terms review assigned
- [ ] GA4 + Ads dashboard created
- [ ] Day 7 review scheduled
- [ ] Day 14 gate criteria documented
- [ ] Phase 2 budget reserved but not allocated

---

## Post-Launch Daily Routine

| Time | Action |
|---|---|
| Morning | Check overnight spend, impressions, clicks |
| Midday | Review Search Terms, add negatives |
| Evening | Check qualified_sessions, no_results rate |
| Weekly | Compare campaigns, reallocate budget |

## Key Decisions Timeline

| Day | Decision |
|---|---|
| Day 3 | Any campaign with 0 impressions? Fix keywords or raise CPC cap |
| Day 7 | Reallocate up to 20-30% budget from worst to best |
| Day 14 | **GATE**: ≥40 activations + ≥12% qualified rate → Phase 2. Else stop. |
| Day 21 | Final evaluation: Scale / Iterate / Pivot / Freeze |
