# Pre-Deploy Gaps: Behavioral, Social, SEO

Three critical areas not addressed before deploy. Each needs answers before or immediately after launch.

---

## 1. Behavioral Data Pipeline

### Goal
Collect user actions → build proprietary data → personalize recommendations. This is the moat foundation.

### Questions to Answer

**1.1 What signals do we collect?**
- [ ] Click (opened detail page)
- [ ] Save (heart button)
- [ ] Hide (dismiss card)
- [ ] Visited ("been here" — user-initiated)
- [ ] Share (sent link to friend)
- [ ] Search query (what user typed)
- [ ] Session context (what interests/company/time were set)
- [ ] Dwell time (how long on detail page)
- [ ] Which explanation was shown (did "pet friendly" drive the click?)

**1.2 How do we identify users?**
- [ ] Anonymous device ID (current: `X-Device-Id` UUID in ProfileStore)
- [ ] Optional account (email/social login) — when? v1? v2?
- [ ] Cross-device sync — needed? Or localStorage per device is enough?
- [ ] GDPR/privacy: what do we store, for how long, do we need consent banner?

**1.3 Where do we store signals?**
- [ ] `interactions` table exists but minimal. Expand schema?
- [ ] Raw events → aggregated profile? Or query raw on each request?
- [ ] Redis for real-time session data? PostgreSQL only?
- [ ] Retention policy: keep forever? Rolling 90 days? Aggregate then delete raw?

**1.4 How do signals affect scoring?**
- [ ] Phase 1: just collect, don't change scoring (safe, measure first)
- [ ] Phase 2: re-rank within filtered set (clicked categories boosted)
- [ ] Phase 3: ML model on behavioral features
- [ ] Cold start: new user = current static scoring. When to switch?
- [ ] Negative signals: hidden venue = penalize similar? Or just hide that one?

**1.5 What metrics prove it works?**
- [ ] Click-through rate (CTR) per card position
- [ ] Save rate per category
- [ ] Hide rate (quality signal — high hide = bad recommendations)
- [ ] Return rate (user opens app again next day)
- [ ] Depth (how many "Show more" clicks)

---

## 2. Social & Community Layer

### Goal
User-generated content that Google doesn't have. Tips, collections, "been here" — network effect.

### Questions to Answer

**2.1 What social features in what order?**
- [ ] "Been here" badge (simplest — one tap, no text input)
- [ ] Save to collection ("My evening spots", "For guests")
- [ ] Share collection via link (virality)
- [ ] Micro-tips ("best table: terrace left", 140 chars max)
- [ ] Photo upload (heavy, moderation needed)
- [ ] Follow friends / see their saves
- [ ] Leaderboard / badges (gamification)

**2.2 Do we need user accounts?**
- [ ] "Been here" + save works without accounts (device ID)
- [ ] Share collections needs shareable URL (works without account)
- [ ] Micro-tips need identity (spam prevention) → account needed?
- [ ] Or: anonymous tips with moderation queue?
- [ ] Account = friction. No account = no cross-device, no social graph
- [ ] Compromise: optional account, core features work without?

**2.3 Content moderation**
- [ ] Micro-tips: auto-filter profanity? Manual review? Report button?
- [ ] Photos: moderation before publish? Or publish then review?
- [ ] Fake "been here" clicks: does it matter? Gaming risk?

**2.4 Share mechanics**
- [ ] What URL structure? `lazigo.app/collection/abc123`?
- [ ] OG meta tags for social preview (image, title, description)?
- [ ] Deep links: shared link opens app if installed, web if not?
- [ ] Share single place/event or only collections?

**2.5 What metrics prove social works?**
- [ ] % users who save ≥1 place (engagement)
- [ ] % users who share (virality coefficient)
- [ ] Tips per venue (content density)
- [ ] User return rate after sharing vs not
- [ ] Collections created per week

---

## 3. SEO & Discoverability

### Goal
Organic traffic from Google/Yandex. Users find LazyDay when searching "what to do in Tbilisi tonight".

### Questions to Answer

**3.1 Current SEO state**
- [ ] Angular SPA = Google sees empty `<div id="app"></div>` without SSR
- [ ] No meta tags per page (title, description, og:image)
- [ ] No sitemap.xml
- [ ] No robots.txt (for our site, not scraped sites)
- [ ] No structured data (JSON-LD `@type: WebApplication`)
- [ ] No canonical URLs
- [ ] PWA manifest exists but no rich meta

**3.2 SSR vs Prerendering vs Static**
- [ ] **Angular SSR (@angular/ssr)**: server-renders pages on request. Complex, needs Node server.
- [ ] **Prerendering**: build-time static HTML for key pages. Simpler. Limited to known URLs.
- [ ] **Dynamic rendering**: serve prerendered HTML to bots, SPA to users (Rendertron/Puppeteer).
- [ ] **Which pages need SEO?** Landing, about, city guides — NOT the personalized feed.
- [ ] Cloudflare Pages supports static only. SSR needs Cloudflare Workers or separate server.

**3.3 What pages should be indexable?**
- [ ] Landing page: "LazyDay — What to do in Tbilisi"
- [ ] City page: "Things to do in Tbilisi" (static content + dynamic highlights)
- [ ] Event pages: "Ricky Martin concert Tbilisi July 16" (SEO gold)
- [ ] Venue pages: "Best parks in Tbilisi" (category landing pages)
- [ ] Blog/guides: "Weekend in Tbilisi with kids" (content marketing)
- [ ] NOT indexable: personalized feed, user settings, saved lists

**3.4 Meta tags & Open Graph**
- [ ] Per-page `<title>` and `<meta name="description">`
- [ ] `og:title`, `og:description`, `og:image` for social sharing
- [ ] Twitter Card meta
- [ ] For event pages: `Event` JSON-LD (Google shows in Events search!)
- [ ] For venue pages: `LocalBusiness` JSON-LD

**3.5 Technical SEO**
- [ ] `sitemap.xml` — auto-generated from events + venue categories
- [ ] `robots.txt` — allow indexing of public pages, block personalized
- [ ] Canonical URLs to avoid duplicate content
- [ ] Page speed (Core Web Vitals) — already good (467KB initial)
- [ ] Mobile-first (already PWA)
- [ ] `hreflang` for ru/en/ka versions

**3.6 Content strategy for organic traffic**
- [ ] Auto-generated city guides: "Top 10 parks in Tbilisi" from our data
- [ ] Event landing pages: individual URL per event → Google Events indexing
- [ ] Seasonal content: "Summer in Tbilisi 2026" — updated automatically
- [ ] These pages need to exist as real HTML, not SPA routes

**3.7 What metrics prove SEO works?**
- [ ] Organic search impressions (Google Search Console)
- [ ] Click-through from search results
- [ ] Pages indexed by Google
- [ ] Event rich results in Google Search
- [ ] Referral traffic from social shares (OG tags working)

---

## Priority Matrix

| Area | Before deploy? | Effort | Impact |
|---|---|---|---|
| **Behavioral: collect clicks/saves** | Yes (minimal tracking) | Small | Foundation for everything |
| **Behavioral: re-ranking** | No (after data) | High | v2 |
| **Social: "been here"** | No (after deploy) | Small | Low initially |
| **Social: share collections** | No (v1) | Medium | High (virality) |
| **Social: micro-tips** | No (v1-v2) | Medium | Medium |
| **SEO: meta tags + robots.txt** | **Yes** | Small | High (zero organic traffic without) |
| **SEO: sitemap.xml** | **Yes** | Small | High |
| **SEO: event JSON-LD** | **Yes** | Small | High (Google Events rich results) |
| **SEO: SSR/prerendering** | After deploy | High | High long-term |
| **SEO: content pages** | After deploy | Medium | High long-term |

## Minimum Before Deploy

1. **`robots.txt`** — allow indexing
2. **`sitemap.xml`** — at least landing + category pages
3. **Meta tags** — title + description + og tags on landing page
4. **Event JSON-LD** — structured data for events (Google indexes automatically)
5. **Basic interaction tracking** — save/hide/click already goes to `/v1/interactions`
6. **Privacy: consent banner** — if storing device-level behavioral data in EU context

Everything else can come after deploy with real traffic data.
