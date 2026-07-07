# Research: Categorization & Ranking Strategy for Contextual Recommendations

## Context

LazyDay — contextual leisure discovery in Tbilisi. User selects interests (nature, bath, spa, food, etc.), system returns ranked venues/events within radius.

Current pipeline: PostGIS candidates -> hard filters (hidden, budget) -> scoring (interest 0.35 + distance 0.25 + time 0.20 + quality 0.10 + source 0.05) -> diversity reranker -> top 30.

## Problem Statement

When user explicitly selects interests {nature: 1, bath: 1, spa: 1}, 3 out of 11 results are irrelevant (bakery, restaurant) — injected as "serendipity pool". User expectation: see nature, baths, spa — not khinkali.

This is not a bug but an architectural question about how strict filtering should be, how categories work, and whether/how serendipity should exist.

---

## Research Findings

### 1. Filtering Strictness: Hard Filter vs. Serendipity

**Industry approaches:**

- **Google Maps / Yelp**: Loose filtering. One-size-fits-all results regardless of interests. Rely on star ratings and crowd-sourced reviews. No personalization by taste.
- **Foursquare**: Strict personalized filtering. Builds deep profile from check-ins and tips, surfaces recommendations based on where you *actually* go. Declared Google/Yelp's approach "broken" and positioned personalization as the fix.
- **Spotify Discover Weekly**: Optimizes for *novelty + likelihood of liking*. Expects some skips (that's normal for exploration). Uses a separate ML model trained on user satisfaction surveys to ensure the playlist has a "good mix — not too off-base, not too obvious." Key: serendipity is *unexpected but relevant*, not random noise.

**Academic consensus (2025-2026):**
- Serendipity = unexpectedness + relevance. A bakery is unexpected but NOT relevant to someone who asked for nature. It's just noise.
- Multi-objective optimization (FAS-MOEA framework) treats accuracy, fairness, and serendipity as competing objectives with Pareto trade-offs.
- SOLAR framework: serendipity should be within the user's latent interest space, not outside it.

**Conclusion for LazyDay:**
- Current serendipity pool is **noise, not serendipity**. Random bakeries for a nature-lover are not "unexpected but relevant."
- True serendipity for {nature, bath, spa} would be: a hidden waterfall, a rooftop garden, a thermal spring in an unexpected location — still within the interest domain.
- **Recommendation**: Remove the hardcoded serendipity pool. Instead, implement **adaptive fill**: if < N relevant results, relax the radius or suggest related categories (e.g., "also consider: culture" with viewpoints near parks). If >= N results, show only relevant.

### 2. Multi-Category / Tag Overlap

**Industry standard — Foursquare taxonomy:**
- 1,244 categories, 6 hierarchical levels, 11 top-level groups.
- Each venue can have **multiple category labels** at different hierarchy levels.
- Example path: "Travel & Transport > Train Station > Tram Station"
- `fsq_category_labels` field supports multi-label assignment.

**Academic research:**
- OSM-to-Foursquare mapping paper (2025) explicitly addresses unifying flat OSM tags into hierarchical Foursquare categories.
- Multi-granularity approaches (location-level, region-level, category-level sequences) significantly improve recommendation accuracy.

**Current LazyDay problem:**
- 1 place = 1 category + flat tags. A bath house with a restaurant is either "bath" or "restaurant", never both.
- OSM tags are flat and domain-specific (`amenity=public_bath`), no hierarchy.

**Recommendation**: Adopt **primary + secondary category model**:
```
places.category       = 'bath'           // primary, used for display
places.categories[]   = ['bath', 'food'] // all applicable, used for matching
places.tags[]         = ['wellness', 'bath', 'thermal', 'food', 'restaurant']
```
- Primary category = what the venue IS (display, card icon)
- Categories array = what it MATCHES against (scoring)
- Tags = fine-grained attributes (existing, keep)
- Migration: add `categories text[] DEFAULT '{}'` column, populate from existing `category` + manual enrichment for multi-use venues.

### 3. Interest Weight Semantics

**Research findings:**
- User intent ≠ user preference. "I want nature" (intent = filter) vs. "I prefer nature over food" (preference = rank).
- Long-term preferences and short-term intents are different signals. A user selecting "nature" right now is expressing a *session intent*, not a life preference.
- Multiple intents per session are common and must be handled.

**Recommendation**: **Dual-mode interpretation**:

| Weight | Semantics | Behavior |
|--------|-----------|----------|
| 0.7 - 1.0 | "I want this" (intent) | Hard filter: MUST match these categories |
| 0.3 - 0.6 | "I like this" (preference) | Soft boost: higher interest score, but don't exclude others |
| 0.0 - 0.2 | "I don't mind this" (neutral) | No effect on filtering or scoring |

- Weight 1.0 = session intent = hard filter
- Weight 0.5 = preference = scoring boost only
- This gives users fine-grained control without requiring a separate "strict/loose" toggle

**Formula change:**
```
// Current: binary — either interestMatch > 0 or serendipity
// Proposed:
const strictInterests = Object.entries(interests).filter(([_, w]) => w >= 0.7);
const softInterests = Object.entries(interests).filter(([_, w]) => w >= 0.3 && w < 0.7);

// Hard filter: candidate must match at least one strict interest
if (strictInterests.length > 0 && !matchesAnyStrict(candidate, strictInterests)) {
  exclude unless adaptive fill needed
}
// Soft boost: matching soft interests increases score but doesn't exclude
```

### 4. Journey-Aware / Contextual Relevance

**Research findings:**
- Context-aware POI recommendation has evolved toward multi-modal context modeling.
- iTourSPOT framework maps heterogeneous tour contexts into unified latent space.
- Most POI recommenders account for sequential patterns (after park → likely café).

**Recommendation**: **Defer to post-MVP** (option a), but prepare the data model:
- Already have `interactions` table (impression, click, save, hide).
- Future: mine sequential patterns from interactions → "users who visited park X then went to café Y."
- For now: **cluster-based hint** — if relevant results are geographically clustered, mention the area: "3 parks near Marjanishvili" rather than individual cards. This is a UX-only change, no algorithm needed.

### 5. Cold Start vs. Learned Preferences

**Research findings:**
- Profile elicitation (onboarding questionnaires, rating prompts) is the standard cold start solution.
- Practical approach: "curated defaults → clickstream → simple collaborative model → layer complexity."
- Reinforcement Learning balances exploration/exploitation adaptively from early-stage feedback.
- Behavioral features (impressions, clicks, purchases) are the "most important training signals" — but new items lack them.

**Recommendation**: **Three-phase approach**:

| Phase | Data Available | Strategy |
|-------|---------------|----------|
| 1. Cold start (0-10 interactions) | Explicit interests only | Trust interests fully. Hard filter by intent (weight >= 0.7). No serendipity. |
| 2. Learning (10-50 interactions) | Interests + behavioral signals | Interests = filter, behavior = re-rank within filtered set. Start suggesting related categories based on click patterns. |
| 3. Mature (50+ interactions) | Rich behavioral profile | Interests = baseline, behavior = primary signal. Can relax filters for users who demonstrate wide taste. Serendipity = venues similar to clicked-but-not-explicitly-selected categories. |

- Key metric: track `hide` actions — a hidden venue in an explicitly selected category is a strong negative signal.
- Store interaction counts per user in `recommendation_logs` or a `user_profiles` table.

---

## Proposed Model Summary

### Immediate (can implement now)

1. **Remove serendipity pool** — zero hardcoded noise slots
2. **Adaptive fill** — if < 5 relevant results, expand radius by 50%, then by 100%. If still < 5, show what we have (don't pad with irrelevant)
3. **Weight threshold** — interests with weight >= 0.7 are hard filters, < 0.7 are scoring boosts

### Short-term (next iteration)

4. **Multi-category column** — `categories text[]` in places table, populated from existing category + enrichment
5. **Hierarchical interest matching** — `nature` matches `outdoor > park`, `outdoor > garden`, `outdoor > viewpoint` at any level
6. **"Low results" UX** — when few results, suggest: "Expand to include: culture, food?" instead of auto-injecting

### Medium-term (after behavioral data)

7. **Behavioral re-ranking** — clicks/saves boost similar categories, hides penalize
8. **Sequential patterns** — "after park → café" suggestions
9. **Per-user serendipity calibration** — wide explorers get more variety, narrow users stay strict

### Scoring Formula (proposed v2)

```
// Phase 1 (current + fixes)
score = 0.45 * interestMatch     // raised from 0.35
      + 0.25 * distanceDecay
      + 0.15 * timeFit           // lowered from 0.20
      + 0.10 * quality
      + 0.05 * source

// interestMatch returns:
//   1.0 = exact category match
//   0.7 = synonym/tag match
//   0.3 = secondary category match (future, with multi-category)
//   0.0 = no match → EXCLUDED by hard filter when weight >= 0.7
```

---

## Sources

- [SOLAR: Serendipity Optimized Language Model](https://aclanthology.org/2025.findings-emnlp.538.pdf)
- [Design of a Serendipity-Incorporated Recommender System](https://www.mdpi.com/2079-9292/14/4/821)
- [Multi-objective Fairness, Accuracy, and Serendipity (FAS-MOEA)](https://www.sciencedirect.com/science/article/abs/pii/S030645732500545X)
- [Foursquare Categories Taxonomy](https://docs.foursquare.com/docs/categories)
- [OSM to Foursquare Category Mapping (2025)](https://arxiv.org/html/2511.13369v1)
- [Foursquare Declares Local Search Broken](https://techcrunch.com/2014/05/27/foursquare-vs-yelp/)
- [Spotify Discover Weekly Algorithm](https://music-tomorrow.com/blog/how-to-get-on-discover-weekly-spotify-algorithm)
- [Inside Spotify's Recommendation System (2025)](https://music-tomorrow.com/blog/how-spotify-recommendation-system-works-complete-guide)
- [Cold Start Problem — Practitioner's Guide](https://medium.com/data-scientists-handbook/cracking-the-cold-start-problem-in-recommender-systems-a-practitioners-guide-069bfda2b800)
- [POI Recommender Systems Survey](https://dl.acm.org/doi/10.1145/3510409)
- [Intent-aware Recommender Systems Survey](https://dl.acm.org/doi/full/10.1145/3700890)
- [Preference or Intent? Double Disentangled CF](https://arxiv.org/pdf/2305.11084)
- [Hierarchy-Dependent Venue Category Prediction](https://arxiv.org/pdf/1810.09833)
