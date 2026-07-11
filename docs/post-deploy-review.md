# LaziGo — Post-Deploy Review (July 11, 2026)

Critical review of production state. Three red flags, five reinforcements,
three new insights.

---

## 🔴 RED FLAGS (fix this week)

### 1. `POST /v1/health/migrate` — open door to DB

Public endpoint that runs DDL on production. Anyone can trigger schema changes.

**Fix**: Add secret header check from env var.
```typescript
@Post('migrate')
async migrate(@Headers('x-admin-key') key: string) {
  if (key !== process.env['ADMIN_SECRET']) {
    throw new ForbiddenException();
  }
  // ... existing logic
}
```
**Effort**: 15 minutes.
**Status**: 🔴 NOT FIXED

### 2. Consent + Privacy not enforced

Yandex.Metrika with session replay is NOT cookie-free. It sets cookies
and tracks PII (session replays capture form inputs, scroll, clicks).
Audience includes EU tourists/expats — GDPR applies to them regardless
of server location.

**Current state**:
- Privacy page exists at `/privacy` ✅
- Consent banner component exists (`ConsentBannerComponent`) — but NOT verified as working
- Yandex.Metrika loads unconditionally in `index.html` — should be gated by consent

**Fix**:
1. Verify consent banner actually shows and saves preference to localStorage
2. Gate Yandex.Metrika loading behind consent flag
3. Gate `interaction_events` tracking behind consent (`consent_state` field exists but always 'pending')

**Effort**: 2-3 hours.
**Status**: 🔴 NOT FIXED

### 3. Share links broken on desktop (no URL for detail modal)

We deliberately removed `history.pushState` for modal detail to prevent
URL-based reload issues. But this breaks share:
- Desktop modal has no URL → Share button copies `lazigo.app/detail/place/{id}`
  but user's browser shows `lazigo.app/discover`
- OG preview (UX-20) can't render dynamic tags without a real URL
- K2-lite share links need working detail URLs

**Fix**: Restore URL update for modal, but use `replaceState` (not pushState)
so browser back button doesn't break:
```typescript
onOpenDetail(card) {
  if (desktop) {
    this.modalCard.set(card);
    history.replaceState({ modal: true }, '', `/detail/${card.type}/${card.id}`);
  }
}
closeModal() {
  this.modalCard.set(null);
  history.replaceState(null, '', '/discover');
}
```
**Effort**: 30 minutes.
**Status**: 🔴 NOT FIXED

---

## 🟡 REINFORCE (this week or next)

### 4. Chain detection: 6 detected out of likely 50+

OSM `brand:wikidata` coverage in Georgia is poor. Only Starbucks, Wendy's,
Subway, Dunkin' detected. McDonald's has multiple locations but may not have
`brand:wikidata` on all OSM nodes.

**Fix**: Add known chain list to OSM import (supplement brand:wikidata).
Add `chain_key` frequency heuristic (≥4 same key = chain, with generic name
exclusion list).

**Validation**: Check top-10 for 20 test queries — count chains. Target <10%.
**Status**: 🟡 PARTIALLY DONE (spec exists, basic detection implemented)

### 5. ~55 events too thin for K7 digest

Evening digest "3 events tonight for you" needs ≥3 events most evenings.
With 55 total events, many evenings will have 0-1.

**Gate**: Before building K7 bot, run SQL:
```sql
SELECT DATE(starts_at AT TIME ZONE 'Asia/Tbilisi') as d,
       COUNT(*) as cnt
FROM events
WHERE status = 'scheduled' AND starts_at > NOW()
GROUP BY d ORDER BY d;
```
If <70% of evenings have ≥3 events → add TKT.ge parser first.
**Status**: 🟡 NOT CHECKED

### 6. 43% venues without opening hours

Places with unknown hours pass availability filter as `unknown` — user sees
them but can't trust "is it open?".

**Fix** (two parts):
1. Scoring boost for places with known hours (+0.03 quality component)
2. Targeted Google re-enrichment: only places that appear in top recommendation
   results (log via recommendation_logs). Hundreds, not thousands → cheap.

**Status**: 🟡 NOT DONE

### 7. No error monitoring or uptime tracking

Railway crash or API error → no notification. With few users, silent death.

**Fix**: UptimeRobot free (15 min) + Sentry free tier (30 min).
**Status**: 🟡 NOT DONE

### 8. Haversine bbox pre-filter

Haversine without PostGIS is fine, but verify bbox index filter runs BEFORE
the math. Without it, every query scans all 3,164 venues.

**Current code**: ✅ Already has bbox pre-filter:
```sql
WHERE v.lat BETWEEN $1 - ($3::float / 111000) AND $1 + ($3::float / 111000)
  AND v.lng BETWEEN $2 - ($3::float / (111000 * cos(radians($1)))) AND ...
```
With B-tree indexes on `lat` and `lng`. ✅ Verified in code.

---

## 💡 NEW INSIGHTS

### 9. Kill/scale metrics: can we actually compute them?

Need to verify:
- `card_position` is written in impression events → ✅ yes (trackImpression passes position)
- `device_id_hash` is stable across sessions → ✅ yes (localStorage `ld_device_id`)
- D7 requires first-visit date → ❌ NOT tracked. Need to add `first_seen_at` to
  device tracking or compute from MIN(occurred_at) in interaction_events.

**Action**: Write one SQL per metric and add to cheatsheet.

### 10. Tourist vs Local (UX-21) — segment all metrics

The one onboarding question isn't just for scoring. ALL metrics should be
viewed by segment:
- Tourist D7 will be near zero (they leave the city)
- Local D7 is the real retention metric
- Tourist CTR on "culture" vs local CTR on "food" — different products

**Action**: Add `localLevel` to interaction_events context when implemented.

### 11. Known debts section in project-status.md

Status doc without debts will lie to us in a month.

---

## REVISED WEEK 1 PRIORITY ORDER

| Day | Task | Why first |
|---|---|---|
| Day 1 | 🔴 Migrate security + consent/privacy + monitoring | Legal + security debt |
| Day 1 | 🔴 Detail URL fix (replaceState) | Unblocks share + OG + K2 |
| Day 2 | #34 SSR preview (dynamic OG tags) | Share distribution needs preview |
| Day 2 | #39 Feedback + Telegram | User channel before features |
| Day 3 | #40 Daily rotation | "App feels alive" |
| Day 3 | #41-42 Scroll restore + SWR | UX polish |
| Day 4 | Event depth check → K7 or TKT.ge parser | Gate before bot |
| Day 5 | K2-lite (if events sufficient) or chain detection improvement | Growth |

**K7 and K2-lite gated by**: event depth (K7) and working share links (K2).
Don't build distribution features on broken pipes.
