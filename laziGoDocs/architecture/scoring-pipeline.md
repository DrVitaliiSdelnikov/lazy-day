# Scoring Pipeline

17-step pipeline from raw venues to final card feed.

## Pipeline Steps

Both `discover()` and `discoverWithExplanation()` share the same pipeline:

```
1.  Fetch places (PostGIS radius query, bbox filter)
2.  Fetch events (time window + radius)
3.  Merge candidates
4.  Filter hidden IDs + budget filter
5.  Build expanded interest weights (INTEREST_SYNONYMS)
6.  Score each candidate (interestMatch + distance + time + quality + source)
7.  Apply company modifiers (couple/family/friends boost/penalty)
8.  Apply pet modifier (allowsDogs fact-based + tag proxy)
9.  Apply chain penalty (x0.80..0.90 depending on localType)
10. Interest hard filter (strict >= 0.7 must match tag)
11. Availability filter (exclude confirmed-closed places)
12. Load taste profile (user_taste_profile table)
13. Apply personalization (cosine similarity * w_personal)
14. Apply price boost (gaussian match)
15. Apply impression discount (0.85^unengaged, 24h recency gate)
16. Sort by score descending
17. Diversity filter (max 1 per chain_key in top 20)
```

discover() additionally applies: adaptive radius expansion, session dithering, epsilon exploration, daily rotation, night fallback.

## Signal Weights (taste profile update)

| Action | Weight | Description |
|---|---|---|
| `been_here` | 1.0 | Visited (ground truth) |
| `save` | 1.0 | Saved to favorites |
| `route` | 0.7 | Built route |
| `taxi` | 0.7 | Called taxi |
| `share` | 0.7 | Shared venue |
| `ticket_click` | 0.7 | Clicked ticket link |
| `decide_open` | 0.5 | Opened in "decide for me" |
| `card_click` | 0.3 | Opened card detail |
| `hide` | negative | Facet-level negative (threshold >= 2) |

## Weights

```
interestMatch:    0.45
distanceDecay:    0.25
timeFit:          0.15
cardQuality:      0.10
sourceConfidence: 0.05
```

## Interest Synonyms

| Category | Tags matched |
|---|---|
| food | food, restaurant, cafe, bakery |
| nightlife | nightlife, bar, club, concert |
| culture | culture, museum, gallery, theater |
| nature | outdoor, park, garden, viewpoint |
| spa | bath, swimming |
| gym | gym, wellness, sports |
| sports | sports, climbing, karting, paintball, trampoline, bowling |
| shopping | shopping, mall |
| entertainment | entertainment, cinema, club, bowling, escape_room, gaming, arcade, water_park, music, concert, festival |
| family | family, playground, park, trampoline, water_park, arcade |
| active | sports, climbing, karting, paintball, trampoline, gym, bowling, escape_room, gaming, arcade, water_park |

## Company Modifiers

| Company | Boost tags | Penalty tags |
|---|---|---|
| solo | — | — |
| couple | viewpoint, restaurant, cafe, bar, park, garden, attraction | playground, family |
| family | park, playground, family, museum, swimming, outdoor | nightlife, bar, club |
| friends | bar, club, restaurant, bowling, escape_room, karting | — |

## Key Files

- `apps/api/src/app/recommendation/recommendation.service.ts` — pipeline + scoring
- `apps/api/src/app/recommendation/taste-profile.service.ts` — personalization
- `apps/api/src/app/recommendation/impression.service.ts` — freshness
