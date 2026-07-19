# Scoring Pipeline

17-step pipeline from raw venues to final card feed.

## Pipeline Steps

```
1.  Fetch places (PostGIS radius query)
2.  Fetch events (time window + radius)
3.  Merge candidates
4.  Filter hidden IDs
5.  Build expanded interest weights (INTEREST_SYNONYMS)
6.  Score each candidate (interestMatch + distance + time + quality + source)
7.  Apply company modifiers (couple/family/friends boost/penalty)
8.  Apply pet modifier (allowsDogs fact-based + tag proxy)
9.  Apply chain penalty (x0.80..0.90 depending on localType)
10. Load taste profile (user_taste_profile table)
11. Apply personalization (cosine similarity * w_personal)
12. Apply price boost (gaussian match)
13. Sort by score descending
14. Apply impression discount (0.85^unengaged, 24h recency gate)
15. Session dithering (deterministic noise)
16. Epsilon exploration (1/8 random slot)
17. Diversity filter (max 1 per chain_key in top 20)
```

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
