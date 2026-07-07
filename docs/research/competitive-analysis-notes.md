# Competitive Analysis: Actionable Notes

Extracted from market analysis. Only what's useful for LazyDay.

## Confirmed Strategic Insights

### Distribution > Quality
"Even a product twice as good struggles against an established leader" (Google Maps co-founder). We don't compete on data — we compete on **context + decision reduction**. Entry point: situations where Google Maps doesn't help ("couple + dog + evening + nature" = one tap in LazyDay, impossible in Google).

### Choice Paralysis
Research shows ~22 options is optimal. 200 results = stress. 10-15 curated = decision. This is our core UX. Never show 50+ results without progressive disclosure.

### Trust Through Explanations
Users trust recommendations more when accompanied by reasons. "Why this?" on every card is not decoration — it's trust infrastructure.

## Actionable for MVP/v1

| Idea | Phase | Why |
|---|---|---|
| **Share collections** | MVP | Word of mouth = #1 distribution channel. "Friend sent me a link" |
| **First 30 seconds** | MVP | Onboarding → preset tap → 10 results. If >30s to value = user lost |
| **Weather signal** | v1 | One API call (OpenWeatherMap free). "Rainy → indoor places boosted" |
| **Retention push** | v1 | "3 events by your interests tonight" — reason to reopen |
| **"Been here" badge** | v1 | Simplest community signal. Builds behavioral data |
| **ratingCount as crowd proxy** | MVP | 5000 reviews = popular, 10 reviews = quiet. No extra API needed |

## Not Now (v2+)

| Idea | Why defer |
|---|---|
| AI chat assistant | Need users first, then conversational layer |
| AR overlay | Press-worthy but not retention driver |
| GetYourGuide/Airbnb integration | Their ecosystem, their rules. Stay independent |
| Uber/transport integration | Google Maps link sufficient. Don't build transport layer |
| Sponsored recommendations | Kills trust. Monetize through ticket commissions or premium tier |
| Noise/safety data | No reliable data source exists |
| Popular Times | Google doesn't expose via API. Build own signal from user visits in v2 |

## Popular Times / Crowd Level

Google doesn't provide popular times through Places API (requested since 2017, still not available). Options:

1. **Scraping** — works but violates ToS, unstable
2. **Third-party** (SafeGraph, Placer.ai) — $500+/mo, overkill
3. **Own data** (v2) — aggregate anonymous user visits → our own crowd signal
4. **Proxy signals** (MVP) — `ratingCount` as popularity indicator, day/time heuristics

Recommendation: show ratingCount as "popularity" hint now. Build own crowd signal when we have users.

## Monetization Path (when ready)

1. **Ticket commissions** — partner with TKT.ge, biletebi.ge for booking links
2. **Premium tier** — expanded filters, offline maps, priority support
3. **Local business tools** — venues pay for enhanced listing (photos, specials, promotions)
4. **NOT** in-feed ads — destroys trust, our core differentiator
