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

| # | Task | Effort | Blocks deploy? |
|---|---|---|---|
| 11 | **Domain** — buy lazigo.app / lazyday.ge / lazyday.today, configure DNS | 30 min | Yes |
| 12 | **Privacy policy page** — static /privacy route, what we collect, how, why | 1-2 hours | Yes (legal) |
| 13 | **Consent banner** — opt-in for personalization tracking, localStorage flag | 1-2 hours | Yes (GDPR) |
| 14 | **Interaction schema migration** — interaction_events + venue_interaction_stats + user_preference_aggregates | 2 hours | Should (foundation) |
| 15 | **Analytics script** — Plausible or Umami (no consent needed for cookie-free) | 30 min | No but important |
| 16 | **Webmaster verification** — Google Search Console + Yandex.Webmaster meta tags | 30 min | No but important |
| 17 | **OG image** — 1200×630 branded image for social sharing preview | 1 hour | No but visible |
| 18 | **Deploy** — Cloudflare Pages (frontend) + Hetzner VPS (API + DB + Docker) | 2-3 hours | — |

### 🤔 DECIDE (before or at deploy)

| Question | Options | Impact |
|---|---|---|
| **Domain name** | lazigo.app ($14/yr) · lazyday.ge (local) · lazyday.today (semantic) | All URLs, SSL, branding |
| **Analytics tool** | Plausible (€9/mo cloud) · Umami (free self-hosted on VPS) | Cost vs simplicity |
| **Consent scope** | Personalization only · All tracking · Split (analytics separate from behavioral) | GDPR compliance |
| **API subdomain** | api.lazigo.app (clean) · lazigo.app/v1 (simpler, no CORS) | Architecture |
| **SSR before deploy?** | No (MVP static) · Yes (detail pages for JSON-LD) | SEO vs speed to market |

---

## Post-Deploy: Month 1 (observe + basics)

### 🔲 TODO

| # | Task | Effort | Impact |
|---|---|---|---|
| 19 | **Share button** — native share on cards + detail page | 2 hours | Virality (word of mouth) |
| 20 | **Behavioral tracking verify** — clicks, saves, hides going to interaction_events | 1 hour | Data foundation |
| 21 | **Dwell time tracking** — timer on detail page → interaction | 1 hour | Signal quality |
| 22 | **Google Search Console** — submit sitemap, monitor indexing | 30 min | SEO visibility |
| 23 | **Yandex.Metrica** (with consent) — session replay for UX insights | 1 hour | UX debugging |
| 24 | **Error monitoring** — Sentry free tier or LogRocket | 1 hour | Stability |
| 25 | **Uptime monitoring** — UptimeRobot free | 15 min | Reliability |

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
| Save rate | >3% of impressions | interaction_events |
| Hide rate | <10% (high = bad recs) | interaction_events |
| Day 1 return rate | >15% | Analytics |
| Pages indexed by Google | >1 | Search Console |

---

## v1: Month 2-3 (community layer = moat)

### 🔲 TODO

| # | Task | Effort | Impact |
|---|---|---|---|
| 26 | **SSR for detail pages** — event JSON-LD + venue LocalBusiness for Google rich results | 2-3 days | SEO (event carousel) |
| 27 | **"Been here" button** — visited mark, count on card | 1 day | Proprietary data |
| 28 | **Collections** — create, save to, share via URL with OG preview | 3-4 days | Virality |
| 29 | **Search/autocomplete** — find venues/events by name | 2-3 days | Usability |
| 30 | **user_preference_aggregates** — nightly job from interaction_events | 1 day | Re-ranking foundation |
| 31 | **Shadow A/B test** — score with behavioral vs without, compare CTR | 2 days | Validation |
| 32 | **Content pages** — "Weekend in Tbilisi", "Top parks" auto-generated from data | 2-3 days | SEO organic traffic |
| 33 | **Dynamic sitemap** — server-generated from events + venue categories | 1 day | SEO coverage |
| 34 | **TKT.ge parser** (Puppeteer) — only if Google Events gap >30% | 3-4 days | Event depth |

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
| 35 | **Behavioral re-ranking** — from accumulated user_preference_aggregates | High |
| 36 | **Gamification** — exploration badges, streaks, neighborhood progress | Medium |
| 37 | **Journey planner** — "coffee → park → dinner" multi-stop | High perceived value |
| 38 | **Weather-aware** — OpenWeatherMap → "rainy → indoor places boosted" | Medium |
| 39 | **Push notifications** — "3 events by your interests tonight" | Re-engagement |
| 40 | **City expansion** — Batumi, Kutaisi via CityConfig (no new code for Tier 1) | Scale |
| 41 | **Local curator network** — trusted locals create curated collections | Deep moat |
| 42 | **Micro-tips + moderation** — 140 chars, profanity filter, report button | Community content |
| 43 | **Photo upload** — one photo per tip, moderation queue | Rich content |

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
Now (pre-deploy):  Intelligence advantage (scoring, explanations, context)
Month 1-3:         Behavioral data (save/hide/click from real users)
Month 3-6:         Community data (tips, collections, badges — network effect)
Month 6-12:        Re-ranking + gamification + curator network
Month 12+:         Multi-city + sustainable moat
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
