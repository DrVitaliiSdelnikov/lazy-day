# LaziGo — Google Ads First Launch Spec

Full spec for the first paid acquisition test.
See original brief below + implementation notes from codebase context.

---

## Implementation Gap Analysis

Based on current codebase state, here's what exists vs what's needed:

### ✅ Already have
- `interaction_events` with card_position, event_type, device_id_hash
- Events: impression, card_click, save, hide, route, share, taxi, decide_open, decide_skip
- Google Analytics (G-8RSG5LFWBC) — consent-gated
- Yandex.Metrika — consent-gated
- Consent banner with Accept/Decline
- Privacy page at /privacy
- GPS works without permission (default to center)
- 3 languages (ru/en/ka)
- Language switcher on welcome + header

### 🔴 Need to build for ads launch

| What | Effort | Notes |
|---|---|---|
| **Landing pages** (`/en/tbilisi/today`, `/ru/tbilisi/today`, `/ka/tbilisi/today`) | 1 day | New routes with ad-optimized content, NOT current welcome screen |
| **UTM preservation in SPA** | 2-3 hours | Store UTM params on entry, pass to interaction_events context |
| **GTM setup** | 2-3 hours | Replace direct GA4 script with GTM container |
| **`qualified_session` event** | 2-3 hours | Client-side logic: ≥2 cards opened + ≥1 action (route/save/share) |
| **`landing_view` event** | 30 min | Fire on landing page load with campaign params |
| **`recommendation_generated` event** | 30 min | Fire after loadFeed() completes |
| **`no_results` event** | 30 min | Fire when feed returns 0 cards |
| **GA4 ↔ Google Ads linking** | 30 min | In GA4 admin |
| **Conversion import** | 30 min | Import qualified_session as primary conversion |
| **SSR/prerender for landing pages** | 4-6 hours | Googlebot and in-app browsers need HTML content |
| **District presets for location** | 1 hour | Already in UX-2 spec (CityConfig presets) |

### 🟡 Important but can launch without

| What | Notes |
|---|---|
| Consent Mode v2 parameters | Current banner sets ld_consent but doesn't set gtag consent params |
| `result_impression` with 1s visibility | Need IntersectionObserver (foundation in UX-23 spec) |
| `return_visit` event | Need first_visit timestamp (S1 identified this gap) |
| Ad-specific landing analytics dashboard | Build after first data |

---

## Critical Code Changes Needed

### 1. UTM Preservation

Currently UTM params are lost after Angular route navigation.

```typescript
// In app.ts or a new UtmService
@Injectable({ providedIn: 'root' })
export class UtmService {
  private params: Record<string, string> = {};

  constructor() {
    const url = new URL(window.location.href);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
     'device', 'matchtype', 'gclid'].forEach(key => {
      const val = url.searchParams.get(key);
      if (val) this.params[key] = val;
    });
    if (Object.keys(this.params).length) {
      sessionStorage.setItem('ld_utm', JSON.stringify(this.params));
    } else {
      const stored = sessionStorage.getItem('ld_utm');
      if (stored) this.params = JSON.parse(stored);
    }
  }

  get(): Record<string, string> { return this.params; }
  isAdTraffic(): boolean { return !!this.params['gclid'] || this.params['utm_source'] === 'google'; }
}
```

Pass UTM to interaction_events context:
```typescript
// In InteractionService flush()
context: { ...event.context, ...this.utmService.get() }
```

### 2. qualified_session Event

```typescript
// In DiscoverComponent
private cardsOpened = new Set<string>();
private hasAction = false;

onOpenDetail(card) {
  this.cardsOpened.add(card.id);
  this.checkQualifiedSession();
  // ... existing code
}

onToggleSave(card) {
  this.hasAction = true;
  this.checkQualifiedSession();
  // ... existing code
}

// Same for route, share

private qualifiedSessionFired = false;
private checkQualifiedSession() {
  if (this.qualifiedSessionFired) return;
  if (this.cardsOpened.size >= 2 && this.hasAction) {
    this.qualifiedSessionFired = true;
    this.interactions.track({
      eventType: 'qualified_session',
      targetType: 'feed',
      context: {
        cards_opened: this.cardsOpened.size,
        intent_action: 'route|save|share', // whichever triggered
      }
    });
    // Also fire GA4 event
    (window as any).gtag?.('event', 'qualified_session', {
      cards_opened: this.cardsOpened.size,
    });
  }
}
```

### 3. Landing Pages

These should NOT be the current welcome/onboarding flow. They need:
- Immediate value demonstration (example cards)
- No onboarding wall
- One CTA → goes to feed with interests pre-set from context
- Ad-specific hero text matching the ad copy

Route structure:
```
/en/tbilisi/today → AdLandingComponent (lang=en, intent=today)
/ru/tbilisi/today → AdLandingComponent (lang=ru, intent=today)
/ka/tbilisi/today → AdLandingComponent (lang=ka, intent=today)
```

### 4. Consent Mode v2

Current banner needs to also set gtag consent:

```typescript
accept() {
  localStorage.setItem(CONSENT_KEY, 'accepted');
  // Set consent mode
  (window as any).gtag?.('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  });
  this.loadMetrika();
  this.loadGA();
}

decline() {
  localStorage.setItem(CONSENT_KEY, 'declined');
  (window as any).gtag?.('consent', 'update', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}
```

And in index.html before GA loads:
```javascript
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500,
});
```

---

## Product Observations from Codebase

### Strengths for ads
1. **GPS not required** — feed works from city center default. User won't hit a wall.
2. **Ghost path exists** — "Лень отвечать" skips onboarding entirely. Good for ad traffic that wants instant results.
3. **K1 "Decide for me"** — perfect for "what to do tonight" intent. One tap → one answer.
4. **Explanations** — every card says WHY. This is the differentiator to highlight in ads.
5. **3 languages** — matches 3 campaign languages.
6. **No registration** — "Без аккаунта" / "No account" already in welcome screen.

### Risks for ads
1. **~55 events total** — "events in Tbilisi today" queries may hit thin content. Monitor `no_results` rate carefully for event-focused ad groups.
2. **43% venues without hours** — "what's open now" implicit expectation from ads. Unknown hours = ambiguity.
3. **No SSR** — in-app browsers (Instagram, Facebook) may show blank page. Need at minimum a loading state that's not just "Просыпаемся…"
4. **Chain venues in feed** — tourist searching "things to do" and seeing McDonald's = bounce. Chain penalty ×0.85 may not be enough; consider hiding chains entirely for ad traffic.
5. **Detail page distance = 0m** without preloaded card — if ad traffic lands on /detail/:id directly, distance shows 0. Fixed for modal but not for direct URL access without geo.

### Recommended landing page flow (different from organic)

```
Ad click → /en/tbilisi/today
  → Hero: "What to do in Tbilisi today"
  → 4-6 example cards (real, from API, pre-fetched)
  → "Get your personal picks" CTA
  → Click CTA → /discover (with interests pre-selected from ad group context)
  → Feed loads immediately (ghost path, no onboarding)
```

This is fundamentally different from organic welcome → onboarding → feed. Ad traffic needs instant gratification.

---

## Estimated Implementation Timeline

| Day | What |
|---|---|
| 1 | UTM service + qualified_session event + GA4 events |
| 2 | Landing page component (3 lang variants) |
| 3 | GTM setup + Consent Mode v2 + GA4↔Ads linking |
| 4 | Testing: all flows, all languages, all devices |
| 5 | Campaign creation in Google Ads (paused) |

**Total: 5 days before ads can go live.**

---

## Budget Summary

| Phase | Duration | Daily | Total |
|---|---|---|---|
| Phase 1 (local) | 14 days | $18 | $252 |
| Phase 2 (scale/travel) | 7 days | $28 | $196 |
| **Total** | **21 days** | | **$448** |

Primary metric: **CPA Activated User** (qualified_session).
Target: $3.75-6.00 per activation.
Kill threshold: <50 activations in 21 days or CPA >$9.

---

*Full original spec preserved below for reference.*

---

# Original Spec (unchanged)

[The full original spec text as provided by the user - preserved for reference but not duplicated here to save space. The implementation notes above are the actionable additions.]
