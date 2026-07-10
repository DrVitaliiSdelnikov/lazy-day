# LaziGo — Killer Features Strategy

Research & decisions on features that define why users choose, remember,
and talk about the product.

## Killer criteria (all four required)

1. **Strengthens core** — "don't make me think" promise. More decisions = disqualified.
2. **Structurally unavailable to competitors** — Google/Yandex can't, not "didn't".
3. **Works for distribution or data** — shareable result or proprietary signal.
4. **Measurable** — one number tells if killer or ballast in 1 month.

Beer test: "will user tell a friend about this over drinks?"

## Competitive map

Real competitors are NOT Google Maps. They are:
- Instagram/TikTok saves ("saw a reel, saved it" — but saves are dead: no "open?", "near?", "fits today?")
- Telegram channels ("куда сходить" — no personalization, no "nearby")
- Ask a friend in chat (friend not always online, doesn't know your context)
- Google/Yandex Maps (decision already made before opening maps)
- tkt.ge / афиши (only events, only when already decided)

**Key insight**: LaziGo competes for the moment BEFORE maps. "19:00, sitting, staring at phone, wanna go somewhere." Two of five competitors are social channels — leisure decisions are almost always social (couple/friends), but all maps are single-user tools. This is the biggest market gap.

---

## Accepted features

### K1: "Decide for me" — one card instead of feed ⭐ MVP

**What**: Button at mood-preset level. Full-screen top-1 card ("Tonight — here"),
actions: Route / Another one (up to 3) / Save / Share.

**Why competitors can't**: Google fears showing "one place" — their product is
completeness. We can because we carry responsibility through explanation.

**Trust mechanism**: Top-1 requires score gap from #2. If top is blurry →
"two worthy options, pick one" (2 cards). "Another one" writes weak negative
to interaction_events — best training signal possible.

**Distribution**: Result = ideal share card. Share button on full-screen card.

**Guard rails**: Only show when place has hours + rating + ≥1 matched interest.

**Effort**: 1-2 days (reuses entire pipeline).
**Stage**: pre-deploy / MVP.
**Kill metric**: ≥25% sessions using it AND ≥30% Route from first card by month 1.

### K2-lite: "Share picks" — joint decision, simplified ⭐ v1

**What**: Instead of full swipe mechanics with real-time sync (4-6 days),
simplified first iteration:
1. User taps "Decide together" → generates link with fixed top-10 cards
2. Link opens same cards for second person (PWA, no install)
3. Both heart their favorites independently
4. First overlap = "You matched: Fabrika!" with route button

No SSE/polling — just compare saved sets. 1-2 days instead of 6.

**Why this is the biggest market gap**: 70%+ leisure decisions involve negotiation
("I don't know, what do you want?"). No map in the world does "two people decide together."

**Distribution built into mechanic**: Feature doesn't work without sending link
to another person = forced distribution act. Invited person sees app after match →
"want this for yourself?"

**Upgrade path**: If overlap conversion ≥60% and viral coefficient ≥0.2 → upgrade
to real-time swipe mechanics (K2-full) in v2.

**Effort**: 1-2 days (lite), 4-6 days (full).
**Stage**: v1 week 2-3.
**Kill metric**: ≥60% sessions with match; ≥20% invited → own profile by month 3.

### K7: Evening digest 17:30 — ritualization

**What**: Bot message Friday 17:30: "Tonight for you: X, Y, Z" (3 cards).
Same recommendation pipeline on cron. Solves frequency problem (leisure 1-3x/week).

**Effort**: 1 day (with K4 bot infrastructure).
**Stage**: v1 week 1-2.
**Kill metric**: return rate on digest day vs without.

### K4: Telegram Mini App — channel killer

**What**: LaziGo as Telegram Mini App. Bot = evening digest instead of
fragile PWA push notifications on iOS.

**Order**: Deploy PWA → bot digest (K7, 1 day) → Mini App (if bot shows engagement).
Don't put cart before horse.

**Effort**: 2-3 days for Mini App.
**Stage**: v1 month 2 (after K7 validates engagement).
**Kill metric**: ≥30% DAU from Telegram by month 4.

### K5: Locals' choice badge — data moat (v2)

**What**: From behavioral data, places saved/visited by stable users (locals by
pattern ≥5 sessions/30 days) → badge "Locals love it". Google averages tourists
and locals into mush.

**Effort now**: 0 (covered by interaction_events schema).
**Stage**: v2 (needs months of data).

---

## Deferred / Rejected

| Feature | Verdict | Reason |
|---|---|---|
| K3 Lazy Evening (journey) | v2, after dwell data | Timing without data = fiction |
| K6 Exploration map | v2, not killer | Feature for engaged, core is for lazy — conflict |
| Social network (profiles, follows) | No | Someone else's war |
| AI chat concierge | No | Dialog = cognitive load, contradicts core |
| Booking / delivery | No | Operations eat product |

## Anti-list

- Don't chase catalog completeness — completeness is Google; our currency is confidence in top-15.
- Don't add conversational search beyond one phrase → filters.
- Don't gamify until retention is proven organically.

## Product narrative by stage

- **MVP**: "Opened — saw 15 ideas — or pressed one button and got one."
- **v1**: "Sent a link — picked together — matched — went."
- **v2**: "Evening assembles itself, and locals approve."

Each stage inherits previous and adds one verb:
decide → match → assemble.
