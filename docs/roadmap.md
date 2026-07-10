# LazyDay Roadmap

Single source of truth for what we do, what we decide, and when.

---

## Pre-Deploy (do before going live)

### ✅ DONE

| # | Task | Status |
|---|---|---|
| 1 | Events: SerpApi Google Events (21 events) | Done |
| 2 | Events: YOLO.ge parser (24 events) | Done |
| 3 | Events: opera.ge parser (10 events) | Done |
| 4 | Event cron (daily 06:00 Tbilisi) | Done |
| 5 | Mood presets (6 shortcuts) | Done |
| 6 | Type filter (places/events/all) | Done |
| 7 | Closed venues hard-filter | Done |
| 8 | Location: GPS + DMS coords (no districts) | Done |
| 9 | Interest categories (11 intent-based) | Done |
| 10 | SEO: robots.txt, sitemap.xml, meta+OG, JSON-LD, hreflang, Twitter Card | Done |

### 🔲 TODO (before deploy)

**UX blockers** (full specs: `docs/ux-specs/`)

| # | Task | Effort | Spec |
|---|---|---|---|
| 11 | ~~UX-3: Night fallback~~ | ✅ done | |
| 12 | ~~UX-16: Gym category~~ | ✅ done | |
| 13 | ~~UX-1: Ghost-path tune-block~~ | ✅ done | |
| 14 | ~~UX-4: Hide undo toast~~ | ✅ done | |
| 15 | ~~UX-15: Route navigation + taxi~~ | ✅ done | |
| 16 | ~~UX-13: Linear onboarding~~ | ✅ done | |
| 17 | ~~UX-6: Preset reset ×~~ | ✅ done | |
| 18 | ~~UX-12: Theme-color meta~~ | ✅ done | |
| 19 | ~~i18n: Full ru/en/ka~~ | ✅ done | |
| 20 | ~~Theme switching fix~~ | ✅ done | |
| 21 | ~~Location: GPS auto-init + default center~~ | ✅ done | |
| 22 | ⚠️ **UX-17: Share** — navigator.share + clipboard fallback. Distribution channel, not a feature | 2-3 hours | [spec](ux-specs/ux-17-share.md) |
| 23 | ⚠️ **UX-18: Interaction tracking** — migration 013, beacon API, event buffer. Without it no kill/scale data | 2 hours | [spec](ux-specs/ux-18-interaction-tracking.md) |
| 24 | ⚠️ **UX-19: Event source monitoring** — Telegram alert if 0 events from source in 48h | 1-2 hours | [spec](ux-specs/ux-19-event-monitoring.md) |
| 25 | ⭐ **K1: "Decide for me"** — full-screen top-1 card, Route/Another/Share. Killer feature MVP | 1-2 days | [spec](research/killer-features.md) |
| 26 | ~~OG fix — LaziGo title + og-image.png~~ | ✅ done | |
| 27 | **UX-2: Location sheet** — full location picker (presets, Google Maps URL parsing) | 1.5-2 days | [spec](ux-specs/ux-2-location-fallback.md) |

**Infrastructure**

| # | Task | Effort | Blocks deploy? |
|---|---|---|---|
| 28 | **Domain** — buy lazigo.app, configure DNS | 30 min | Yes |
| 29 | **Privacy policy page** — static /privacy route, what we collect, how, why | 1-2 hours | Yes (legal) |
| 30 | **Consent banner** — opt-in for personalization tracking, localStorage flag | 1-2 hours | Yes (GDPR) |
| 31 | **Analytics script** — Plausible or Umami (no consent needed for cookie-free) | 30 min | No but important |
| 32 | **Webmaster verification** — Google Search Console + Yandex.Webmaster meta tags | 30 min | No but important |
| 33 | ~~OG image~~ — 1200×630 branded (дремлющий пин) | ✅ done | |
| 34 | **Deploy** — Cloudflare Pages (frontend) + Hetzner VPS (API + DB + Docker) | 2-3 hours | — |

### 🤔 DECIDE (before or at deploy)

| Question | Options | Impact |
|---|---|---|
| **Domain name** | lazigo.app ($14/yr) · lazyday.ge (local) · lazyday.today (semantic) | All URLs, SSL, branding |
| **Analytics tool** | Plausible (€9/mo cloud) · Umami (free self-hosted on VPS) | Cost vs simplicity |
| **Consent scope** | Personalization only · All tracking · Split (analytics separate from behavioral) | GDPR compliance |
| **API subdomain** | api.lazigo.app (clean) · lazigo.app/v1 (simpler, no CORS) | Architecture |
| **SSR before deploy?** | No (MVP static) · Yes (detail pages for JSON-LD) | SEO vs speed to market |

---

## Post-Deploy Checklist (verify on real device)

| # | What | Status |
|---|---|---|
| 1 | Taxi deeplinks: Bolt (`bolt://ride`) + Yandex Go (`yandextaxi://route`) — test on phone with apps installed | pending |
| 2 | Taxi fallback: verify behavior when app not installed (add App Store/Play Store redirect?) | pending |
| 3 | GPS permission flow on mobile Safari + Chrome | pending |
| 4 | PWA install prompt + splash screen | pending |
| 5 | Night fallback (test at 23:00+ Tbilisi time) | pending |

---

## Post-Deploy: Month 1 (observe + basics)

### 🔲 TODO

**UX week 1** (full specs: `docs/ux-specs/`)

| # | Task | Effort | Spec |
|---|---|---|---|
| 34 | ⚠️ **UX-20: Detail SSR preview** — dynamic OG tags for shared links (Cloudflare Worker or API middleware) | 3-4 hours | [spec](ux-specs/ux-20-detail-ssr-preview.md) |
**Killer features** (full analysis: [killer-features.md](research/killer-features.md))

| # | Task | Effort | Spec |
|---|---|---|---|
| 35 | ⭐ **K7: Evening digest bot** — Telegram bot, 17:30 Fri: "Tonight for you: X, Y, Z". Same pipeline on cron | 1 day | [spec](research/killer-features.md) |
| 36 | ⭐ **K2-lite: "Decide together"** — share link with top-10, both heart, first overlap = match. No real-time sync | 1-2 days | [spec](research/killer-features.md) |

**UX week 1** (full specs: `docs/ux-specs/`)

| # | Task | Effort | Spec |
|---|---|---|---|
| 37 | ⚠️ **UX-20: Detail SSR preview** — dynamic OG tags for shared links (Cloudflare Worker or API middleware) | 3-4 hours | [spec](ux-specs/ux-20-detail-ssr-preview.md) |
| 38 | **UX-21: Tourist vs Local** — one onboarding question, scoring modifier | 1-2 hours | [spec](ux-specs/ux-21-tourist-signal.md) |
| 39 | **UX-14: Feedback + Telegram** — bottom sheet, 4 categories, telegram forwarding | 0.5-1 day | [spec](ux-specs/ux-14-feedback.md) |
| 40 | **UX-5: Daily rotation** — date-seeded tie-breaker, new event boost | 2-3 hours | [spec](ux-specs/ux-5-daily-rotation.md) |
| 41 | **UX-7: Scroll restore** — cache feed + scroll position on detail navigation | 3-4 hours | [spec](ux-specs/ux-7-scroll-restore.md) |
| 42 | **UX-8: Stale-while-revalidate** — instant cached feed + silent background refresh | 3-4 hours | [spec](ux-specs/ux-8-swr-entry.md) |
| 43 | **UX-4 phase 2** — reason chips in undo toast + interaction API | 2-3 hours | [spec](ux-specs/ux-4-hide-improvements.md) |
| 44 | **UX-1 phase 2** — session cooldown + company tune-block | 3-4 hours | [spec](ux-specs/ux-1-progressive-onboarding.md) |

**Killer features month 2**

| # | Task | Effort | Spec |
|---|---|---|---|
| 45 | ⭐ **K4: Telegram Mini App** — PWA inside Telegram, K2 links native. Only if K7 bot shows engagement | 2-3 days | [spec](research/killer-features.md) |

**Infrastructure**

| # | Task | Effort | Impact |
|---|---|---|---|
| 46 | **Behavioral tracking verify** — clicks, saves, hides going to interaction_events | 1 hour | Data foundation |
| 47 | **Dwell time tracking** — timer on detail page → interaction | 1 hour | Signal quality |
| 48 | **Google Search Console** — submit sitemap, monitor indexing | 30 min | SEO visibility |
| 49 | **Yandex.Metrica** (with consent) — session replay for UX insights | 1 hour | UX debugging |
| 50 | **Error monitoring** — Sentry free tier or LogRocket | 1 hour | Stability |
| 51 | **Uptime monitoring** — UptimeRobot free | 15 min | Reliability |

**Polish** (ongoing)

| # | Task | Effort | Spec |
|---|---|---|---|
| 41 | **UX-9: Heart hit-area** — 44×44px touch target | 30 min | [ux-9](ux-specs/ux-9-heart-hit-area.md) |
| 42 | **UX-10: Language fallback** — ru → en → ka name chain | 1 hour | [ux-10](ux-specs/ux-10-language-fallback.md) |
| 43 | **UX-11: Saved tab badge** — dot on tab when event is today/tomorrow | 30 min | [ux-11](ux-specs/ux-11-saved-badge.md) |

### 🤔 DECIDE

| Question | Options | Impact |
|---|---|---|
| **Session replay tool** | Yandex.Metrica (free, needs consent) · LogRocket (paid) · Clarity (free, Microsoft) | UX insight quality |
| **Error tracking** | Sentry free (5K events/mo) · Custom logging | Debug speed |

### 📊 MONITOR (KPIs)

| Metric | Target month 1 | How to measure |
|---|---|---|
| Daily active users | 50+ | Analytics |
| Cards CTR (click / impression) | >5% | interaction_events |
| **Top-3 CTR** | **≥ 25%** | interaction_events (card_position 0-2) |
| **Route rate** (route / card_click) | **≥ 15%** | interaction_events |
| Save rate | >3% of impressions | interaction_events |
| Hide rate | <10% (high = bad recs) | interaction_events |
| D1 return rate | >15% | Analytics |
| **D7 return rate** | **≥ 10%** | Analytics |
| Pages indexed by Google | >1 | Search Console |
| Share rate | baseline TBD | interaction_events |

### 🎯 KILL / SCALE CRITERIA (evaluate at deploy + 2 months)

| Signal | Threshold | Decision |
|---|---|---|
| D7 return ≥ 10% AND top-3 CTR ≥ 25% | Both met | **Scale**: invest in v1 features |
| D7 return ≥ 10% BUT top-3 CTR < 25% | Retention ok, relevance weak | **Iterate**: improve scoring, add tourist mode |
| D7 return < 10% AND top-3 CTR ≥ 25% | Good recs but no habit | **Pivot**: double down on evening anchor, push notifications |
| D7 return < 10% AND top-3 CTR < 25% | Neither works | **Freeze**: preserve as portfolio piece, stop investment |

---

## v1: Month 2-3 (community layer = moat)

### 🔲 TODO

| # | Task | Effort | Impact |
|---|---|---|---|
| 26 | ⚠️ **Data dedup & cross-verification** — formalize OSM↔Google matcher (scoring, zones, match_features), validate current 1,755 merges, LLM gray-zone arbiter. Foundation for Yandex/Apple. [Full spec](research/data-dedup-cross-verification.md) | 3-5 days | Data quality (critical) |
| 27 | ⚠️ **Yandex Organizations adapter** — fetch by bbox tiles, blocking→scoring→zones pipeline, closure cross-verification (2-provider voting). Depends on #26. | 2-3 days | Closure detection, coverage |
| 28 | **SSR for detail pages** — event JSON-LD + venue LocalBusiness for Google rich results | 2-3 days | SEO (event carousel) |
| 29 | **"Been here" button** — visited mark, count on card | 1 day | Proprietary data |
| 30 | **Collections** — create, save to, share via URL with OG preview | 3-4 days | Virality |
| 31 | **Search/autocomplete** — find venues/events by name | 2-3 days | Usability |
| 32 | **user_preference_aggregates** — nightly job from interaction_events | 1 day | Re-ranking foundation |
| 33 | **Shadow A/B test** — score with behavioral vs without, compare CTR | 2 days | Validation |
| 34 | **Content pages** — "Weekend in Tbilisi", "Top parks" auto-generated from data | 2-3 days | SEO organic traffic |
| 35 | **Dynamic sitemap** — server-generated from events + venue categories | 1 day | SEO coverage |
| 36 | **TKT.ge parser** (Puppeteer) — only if Google Events gap >30% | 3-4 days | Event depth |

### 🤔 DECIDE

| Question | Options | Impact |
|---|---|---|
| **User accounts** | No accounts (device only) · Optional email · Social login (Google/Apple) | Cross-device, social features |
| **Collection URLs** | `/collections/:slug-:hash` · `/tbilisi/collections/:name` | SEO, branding |
| **Re-ranking weight** | Start 0.9×static + 0.1×behavioral · Aggressive 0.7/0.3 | Quality vs risk |
| **Micro-tips** | Now (anonymous, moderated) · Later (with accounts) | Content quality vs friction |
| **Sort modes** | Smart / Closest / Top rated / Open now | UX complexity |

---

## v2: Month 4-12 (personalization + scale)

### 🔲 TODO

| # | Task | Impact |
|---|---|---|
| 52 | ⭐ **K5: Locals' choice badge** — behavioral signal: places saved by ≥5-session users → badge | Data moat |
| 53 | ⭐ **K3: Lazy Evening (journey)** — "coffee → park → dinner" auto-composed with dwell-time data | High perceived value |
| 54 | ⭐ **K2-full: Real-time match** — upgrade K2-lite to swipe + SSE sync (if K2-lite metrics pass) | Virality |
| 55 | **Behavioral re-ranking** — from accumulated user_preference_aggregates | High |
| 56 | **Weather-aware** — OpenWeatherMap → "rainy → indoor places boosted" | Medium |
| 57 | **City expansion** — Batumi, Kutaisi via CityConfig (no new code for Tier 1) | Scale |
| 58 | **Local curator network** — trusted locals create curated collections | Deep moat |
| 59 | **Micro-tips + moderation** — 140 chars, profanity filter, report button | Community content |

### 🤔 DECIDE (later)

| Question | Options |
|---|---|
| **ML for re-ranking** | Simple rules · Collaborative filtering · Neural embeddings |
| **Monetization** | Ticket commissions · Premium tier · Local business tools · NOT in-feed ads |
| **Multi-city data model** | One DB, city_id column · Separate DBs per city |
| **Admin panel** | Build custom · Use Retool/Appsmith · CLI only |

---

## Competitive Moat Timeline

```
MVP:       "Decide for me" — one-tap answer (K1), share as distribution
Month 1:   Behavioral data + evening digest bot (K7) → retention
Month 2:   "Decide together" (K2-lite) → viral loop, Telegram Mini App (K4)
Month 3-6: Locals' choice (K5) + cross-verified closures → trust moat
Month 6-12: Lazy Evening (K3) + re-ranking + city expansion
Month 12+: Multi-city + curator network = sustainable moat

Product narrative: decide → match → assemble
```

---

## Data Schema (interaction_events — migration 013)

```sql
CREATE TABLE interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id_hash TEXT NOT NULL,
  session_id UUID NOT NULL,
  event_type TEXT NOT NULL,           -- card_click, save, hide, visited, share, impression
  target_type TEXT NOT NULL,          -- place, event, collection
  target_id TEXT,
  city_id TEXT NOT NULL DEFAULT 'tbilisi',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  card_position INT,
  score_breakdown JSONB,              -- { interest: 0.9, distance: 0.7, ... }
  explanation_codes TEXT[],           -- ['nature_match', 'pet_friendly', 'open_now']
  context JSONB,                      -- { interests, company, hasPet, time, locale }
  consent_state TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_ie_device ON interaction_events (device_id_hash);
CREATE INDEX idx_ie_target ON interaction_events (target_type, target_id);
CREATE INDEX idx_ie_occurred ON interaction_events (occurred_at);

CREATE TABLE venue_interaction_stats (
  venue_id UUID PRIMARY KEY REFERENCES venues(id),
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  saves INT NOT NULL DEFAULT 0,
  hides INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  been_here INT NOT NULL DEFAULT 0,
  ctr NUMERIC GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN (clicks::numeric / impressions) ELSE 0 END
  ) STORED
);

CREATE TABLE user_preference_aggregates (
  device_id_hash TEXT NOT NULL,
  city_id TEXT NOT NULL DEFAULT 'tbilisi',
  interest_key TEXT NOT NULL,
  positive_weight NUMERIC NOT NULL DEFAULT 0,
  negative_weight NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id_hash, city_id, interest_key)
);
```

---

## Cost Projection

| Scale | VPS | SerpApi | Google | Analytics | Total/mo |
|---|---|---|---|---|---|
| MVP (1 city) | $10 | $0 | $0 (done) | $0-9 | **$10-19** |
| v1 (1 city, SSR) | $10 | $0 | $0 | $9 | **$19** |
| 5 cities | $15 | $50 | ~$10 | $9 | **$84** |
| 20 cities | $20 | $50 | ~$20 | $9 | **$99** |

---

## Files Reference

| Doc | What |
|---|---|
| `docs/roadmap.md` | **This file** — single source of truth |
| `docs/product-brief.md` | 3-page product overview |
| `docs/technical-spec.md` | Full architecture spec |
| `docs/cheatsheet.md` | Quick reference commands |
| `docs/scoring.md` | Scoring formula details |
| `docs/research/pre-deploy-strategy.md` | SEO + behavioral + social deep research |
| `docs/research/pre-deploy-gaps.md` | 52 questions checklist |
| `docs/research/analytics-domain-strategy.md` | Analytics + domain options |
| `docs/research/seo-implementation-guide.md` | SEO files implementation details |
| `CLAUDE.md` | Project context for AI sessions |
