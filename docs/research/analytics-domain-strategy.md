# Research: Analytics, Webmaster Tools & Domain Strategy

## 1. Domain Name

### Requirements
- Short, memorable, works in Latin script (international tourists)
- Reflects "lazy leisure" positioning
- Available as .com or .app
- Works for multi-city expansion (not "tbilisi" in name)

### Candidates

| Domain | Available? | Pros | Cons |
|---|---|---|---|
| `lazyday.app` | Check | Perfect match to brand. `.app` = modern, HTTPS-only | `.app` less familiar than `.com` |
| `lazyday.com` | Check | Classic, trustworthy | Likely taken |
| `lazyday.io` | Check | Tech/startup feel | Less consumer-friendly |
| `getlazyday.com` | Check | Probably available | Longer, "get" prefix overused |
| `lazyday.ge` | Check | Local Georgian domain, SEO boost for Georgia | Limited to Georgia perception |
| `lazy.day` | Check | Short, creative | `.day` TLD unfamiliar |
| `lazydayapp.com` | Check | Probably available | Redundant "app" |

### Recommendation
- **Primary**: `lazyday.app` — brand match, HTTPS enforced, modern
- **Fallback**: `lazyday.ge` — local trust for Georgian market MVP
- **Check both** before deciding. `.app` domains ~$14/year via Google Domains or Cloudflare.

### What domain affects
- All meta tags, OG URLs, sitemap
- SSL certificate (Cloudflare auto for Pages)
- Email (future: hello@lazyday.app)
- API endpoint (api.lazyday.app or lazyday.app/v1)
- Google Search Console, Yandex Webmaster verification

---

## 2. Analytics Stack

### What we need to track

| Category | Metrics | Why |
|---|---|---|
| **Traffic** | Page views, sessions, unique visitors | Basic health |
| **Acquisition** | Where users come from (organic, social, direct, referral) | Channel effectiveness |
| **Engagement** | Session duration, pages/session, bounce rate | Content quality |
| **Conversion** | Feed loaded, card clicked, save, share | Funnel analysis |
| **Retention** | Day 1/7/30 return rate | Product-market fit signal |
| **Technical** | Core Web Vitals (LCP, INP, CLS), errors | Performance |

### Option A: Google Analytics 4 (GA4)

| Aspect | Detail |
|---|---|
| Cost | Free |
| Setup | gtag.js snippet in index.html |
| Pros | Industry standard, deep funnel analysis, audience insights, integration with Search Console |
| Cons | Heavy JS (~30KB), privacy concerns, sends data to Google, blocked by ad blockers (~30% users), requires cookie consent |
| GDPR | Needs consent banner, EU users data transferred to US (controversial) |

### Option B: Yandex.Metrica

| Aspect | Detail |
|---|---|
| Cost | Free |
| Setup | Script snippet in index.html |
| Pros | Session replay (WebVisor), heatmaps, form analytics, free forever, popular in CIS |
| Cons | Russian service (geopolitical concerns in Georgia), heavy JS, blocked by some ad blockers |
| GDPR | Stores data in Russia, questionable EU compliance |

### Option C: Plausible Analytics

| Aspect | Detail |
|---|---|
| Cost | €9/mo (cloud) or self-hosted free |
| Setup | Single <script> tag, 1KB |
| Pros | Privacy-friendly (no cookies, no consent banner needed), lightweight, EU-hosted, GDPR compliant by design, open source |
| Cons | Less detailed than GA4 (no funnel analysis, no cohorts), no session replay |

### Option D: Umami Analytics

| Aspect | Detail |
|---|---|
| Cost | Free (self-hosted) or $9/mo (cloud) |
| Setup | Single script tag, ~2KB |
| Pros | Privacy-friendly, self-hosted option (full data ownership), lightweight, no cookie consent needed |
| Cons | Less features than GA4, self-hosted needs VPS resources |

### Recommendation: Plausible OR Umami + Yandex.Metrica

**Primary**: Plausible or Umami — privacy-first, no consent banner needed for basic analytics, lightweight. Pick one:
- Plausible if want cloud-hosted simplicity (€9/mo)
- Umami if want to self-host on Hetzner VPS (free, we have the VPS)

**Secondary**: Yandex.Metrica — for session replay (WebVisor) and heatmaps. Invaluable for UX debugging. Add with consent: only load if user accepted tracking.

**NOT GA4 for MVP**: Heavy, requires cookie consent, blocked by 30% users, sends data to Google. Add later if needed for ad campaigns.

---

## 3. Webmaster / Search Console Tools

### Google Search Console (GSC)

**Must have.** Free. Shows:
- Which pages Google indexed
- Search queries that show your site
- Click-through rates from search
- Crawl errors, mobile usability
- Submit sitemap.xml
- Request indexing for new pages

**Setup**: Verify domain ownership via DNS TXT record or HTML file.

### Yandex.Webmaster

**Should have** for CIS audience. Free. Shows:
- Yandex indexing status
- Search queries in Yandex
- Site quality metrics
- Sitemap submission

**Setup**: Verify via DNS TXT record or meta tag.

### Bing Webmaster

**Nice to have**. Free. Auto-imports from GSC. Low effort.

### Setup checklist

| Tool | Priority | Effort | When |
|---|---|---|---|
| Google Search Console | Must | 30 min | Before deploy (verify domain) |
| Yandex.Webmaster | Should | 30 min | Deploy day |
| Bing Webmaster | Nice | 10 min (import from GSC) | After deploy |
| Plausible/Umami | Must | 1 hour | Deploy day |
| Yandex.Metrica | Should | 30 min (with consent) | Week 1 |

---

## 4. API Domain Architecture

### Options

| Pattern | Example | Pros | Cons |
|---|---|---|---|
| Subdomain | `api.lazyday.app` + `lazyday.app` | Clean separation, independent scaling | CORS setup needed, separate SSL |
| Path prefix | `lazyday.app/v1/*` | Simple, no CORS, one SSL | Harder to scale independently |
| Same origin + proxy | Cloudflare proxies `/v1` to backend | Zero CORS, simple frontend | Cloudflare dependency |

**Recommendation**: `api.lazyday.app` subdomain pointing to Hetzner VPS. Frontend on `lazyday.app` via Cloudflare Pages. Clean, scalable, standard.

CORS config on API:
```typescript
app.enableCors({ origin: ['https://lazyday.app', 'http://localhost:4200'] });
```

---

## 5. Pre-Deploy Checklist (updated)

### Domain & DNS (day 1)
- [ ] Buy domain (lazyday.app or lazyday.ge)
- [ ] Configure DNS: `lazyday.app` → Cloudflare Pages, `api.lazyday.app` → Hetzner VPS
- [ ] SSL: automatic via Cloudflare (frontend) + Let's Encrypt (API)

### Analytics (deploy day)
- [ ] Plausible/Umami: add script to index.html
- [ ] Google Search Console: verify domain, submit sitemap
- [ ] Yandex.Webmaster: verify domain

### SEO (deploy day)
- [ ] robots.txt in public/
- [ ] sitemap.xml (static MVP, dynamic v1)
- [ ] Meta tags + OG tags on index.html
- [ ] Privacy policy page

### Consent (deploy day)
- [ ] GDPR consent banner (for Yandex.Metrica, if added)
- [ ] Plausible/Umami = no consent needed (cookie-free)

### Monitoring (week 1)
- [ ] Yandex.Metrica with consent (session replay for UX insights)
- [ ] Error tracking (Sentry free tier or LogRocket)
- [ ] Uptime monitoring (UptimeRobot free)

---

## Sources

- [Plausible Analytics](https://plausible.io) — privacy-friendly, EU-hosted
- [Umami Analytics](https://umami.is) — self-hosted, open source
- [Yandex.Metrica](https://metrica.yandex.com) — free, session replay
- [Google Search Console](https://search.google.com/search-console)
- [Yandex.Webmaster](https://webmaster.yandex.com)
- [.app domains](https://get.app) — HTTPS-enforced TLD
- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
