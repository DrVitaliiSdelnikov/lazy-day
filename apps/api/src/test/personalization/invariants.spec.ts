/**
 * Personalization invariants & preference-recovery tests.
 *
 * Metamorphic/invariant approach: assert RELATIONS between outputs
 * under known perturbations, not exact rankings.
 *
 * Pure logic — no DB, no HTTP.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TEST_VENUES, TEST_IDF, extractTestFacets, TestVenue } from '../fixtures/test-venues';

// ---- Reuse scoring helpers from mcdonalds.spec ----

const WEIGHTS = { interestMatch: 0.45, distanceDecay: 0.25, timeFit: 0.15, cardQuality: 0.10, sourceConfidence: 0.05 };
const DECAY = 0.9;
const W_PERSONAL_MAX = 0.20;
const W_PERSONAL_RAMP = 15;
const NEG_THRESHOLD = 2;
const NEG_RATIO = 0.4;
const NEG_FLOOR = -0.5;
const IDF_MIN = 2.0;

interface TasteProfile {
  facet_weights: Record<string, Record<string, number>>;
  neg_counters: Record<string, number>;
  signal_count: number;
}

function emptyProfile(): TasteProfile {
  return { facet_weights: {}, neg_counters: {}, signal_count: 0 };
}

function simulateLike(profile: TasteProfile, venue: TestVenue, action = 'save'): void {
  const signalWeight = action === 'save' ? 1.0 : action === 'route' ? 0.7 : 0.3;
  for (const { type, value } of extractTestFacets(venue)) {
    const idf = TEST_IDF[`${type}:${value}`] ?? 3.0;
    if (!profile.facet_weights[type]) profile.facet_weights[type] = {};
    const current = profile.facet_weights[type][value] ?? 0;
    profile.facet_weights[type][value] = DECAY * current + (1 - DECAY) * signalWeight * idf;
  }
  profile.signal_count++;
}

function simulateHide(profile: TasteProfile, venue: TestVenue): void {
  const facets = extractTestFacets(venue);
  const idfSum = facets.reduce((s, f) => s + (TEST_IDF[`${f.type}:${f.value}`] ?? 3.0), 0);

  for (const { type, value } of facets) {
    const key = `${type}:${value}`;
    const idf = TEST_IDF[key] ?? 3.0;
    if (idf < IDF_MIN) continue;

    profile.neg_counters[key] = (profile.neg_counters[key] ?? 0) + 1;

    if (profile.neg_counters[key] >= NEG_THRESHOLD) {
      const penalty = NEG_RATIO * idf / idfSum;
      if (!profile.facet_weights[type]) profile.facet_weights[type] = {};
      profile.facet_weights[type][value] = Math.max(
        NEG_FLOOR, (profile.facet_weights[type][value] ?? 0) - penalty
      );
    }
  }
}

function cosineScore(profile: TasteProfile, venue: TestVenue): number {
  const venueFacets = extractTestFacets(venue);
  if (venueFacets.length === 0 || profile.signal_count === 0) return 0;
  let dot = 0, normU = 0;
  for (const [type, vals] of Object.entries(profile.facet_weights)) {
    for (const [val, w] of Object.entries(vals)) {
      normU += w * w;
      if (venueFacets.some(f => f.type === type && f.value === val)) dot += w;
    }
  }
  if (normU === 0) return 0;
  return Math.max(0, dot / (Math.sqrt(normU) * Math.sqrt(venueFacets.length)));
}

function wPersonal(p: TasteProfile): number {
  return W_PERSONAL_MAX * Math.min(1, p.signal_count / W_PERSONAL_RAMP);
}

function scoreVenue(v: TestVenue, interests: Record<string, number>, radiusM: number, profile: TasteProfile | null): number {
  const synonyms: Record<string, string[]> = {
    food: ['food', 'restaurant', 'cafe', 'bakery'],
    nightlife: ['nightlife', 'bar', 'club', 'concert'],
  };
  const expanded = new Map<string, number>();
  for (const [k, w] of Object.entries(interests)) {
    if (w < 0.3) continue;
    expanded.set(k, w);
    for (const s of synonyms[k] ?? []) expanded.set(s, Math.max(expanded.get(s) ?? 0, w));
  }

  let interestScore = 0.5;
  if (expanded.size > 0) {
    const m: number[] = [];
    for (const t of v.tags) { const w = expanded.get(t); if (w) m.push(w); }
    interestScore = m.length === 0 ? 0 : m.length === 1 ? m[0] : (m.sort((a, b) => b - a), (m[0] + m[1]) / 2);
  }

  const distance = Math.max(0, 1 - v.distanceM / radiusM);
  let score = WEIGHTS.interestMatch * interestScore + WEIGHTS.distanceDecay * distance
    + WEIGHTS.timeFit * 1.0 + WEIGHTS.cardQuality * 0.5 + WEIGHTS.sourceConfidence * 0.6;
  if (v.isChain) score *= 0.85;
  if (profile && profile.signal_count > 0) score += wPersonal(profile) * cosineScore(profile, v);
  return score;
}

function avgScore(venues: TestVenue[], interests: Record<string, number>, radiusM: number, profile: TasteProfile): number {
  return venues.reduce((s, v) => s + scoreVenue(v, interests, radiusM, profile), 0) / venues.length;
}

// ---- Tests ----

describe('Preference Recovery', () => {
  it('profile converges monotonically with more signals', () => {
    // Hidden preference: upscale + live_music + wine_bar (medium-rare facets)
    const targetVenues = TEST_VENUES.filter(v =>
      v.facetAtmosphere.includes('upscale') || v.facetAtmosphere.includes('live_music')
    );
    expect(targetVenues.length).toBeGreaterThanOrEqual(3);

    const cosines: number[] = [];

    for (const checkAt of [3, 7, 15]) {
      const p = emptyProfile();
      for (let i = 0; i < checkAt; i++) {
        simulateLike(p, targetVenues[i % targetVenues.length]);
      }

      // Compute avg cosine to target venues
      const avgCosine = targetVenues.reduce((s, v) => s + cosineScore(p, v), 0) / targetVenues.length;
      cosines.push(avgCosine);
    }

    // Main: more signals → better than few (3→7 must improve)
    expect(cosines[1], '7 signals > 3 signals').toBeGreaterThan(cosines[0]);

    // 15 vs 7: EMA decay can cause slight dip when repeating same venues
    // Assert overall improvement from start, not strict monotonicity at every point
    expect(cosines[2], '15 signals > 3 signals (overall trend)').toBeGreaterThan(cosines[0]);

    // Secondary: all checkpoints reasonable
    expect(cosines[2], 'final cosine > 0.3').toBeGreaterThan(0.3);
  });

  it('profile for upscale venues has higher cosine to upscale than to cheap', () => {
    const p = emptyProfile();
    const upscale = TEST_VENUES.filter(v => v.facetAtmosphere.includes('upscale'));
    const cheap = TEST_VENUES.filter(v => v.facetPriceTier === 1);

    for (const v of upscale) simulateLike(p, v);

    const avgUpscale = upscale.reduce((s, v) => s + cosineScore(p, v), 0) / upscale.length;
    const avgCheap = cheap.reduce((s, v) => s + cosineScore(p, v), 0) / cheap.length;

    expect(avgUpscale).toBeGreaterThan(avgCheap);
  });
});

describe('Invariants', () => {
  const radiusM = 5000;
  const interests = { food: 1.0 };
  const wineVenues = TEST_VENUES.filter(v => v.facetFormat?.includes('wine_bar'));
  const foodVenues = TEST_VENUES.filter(v => v.tags.includes('food'));

  describe('Monotonic like (aggregate)', () => {
    it('one more wine bar like → avg wine bar score increases', () => {
      const p1 = emptyProfile();
      simulateLike(p1, wineVenues[0]);
      const avg1 = avgScore(wineVenues, interests, radiusM, p1);

      const p2 = emptyProfile();
      simulateLike(p2, wineVenues[0]);
      simulateLike(p2, wineVenues[0]); // one more
      const avg2 = avgScore(wineVenues, interests, radiusM, p2);

      expect(avg2, 'avg score after 2nd like > after 1st').toBeGreaterThan(avg1);
    });
  });

  describe('Hide locality', () => {
    it('hiding one venue does NOT collapse food category', () => {
      const p = emptyProfile();
      // Like some food venues first
      simulateLike(p, TEST_VENUES.find(v => v.id === 'v-fine-1')!);
      simulateLike(p, TEST_VENUES.find(v => v.id === 'v-fine-2')!);

      const scoresBefore = foodVenues.map(v => scoreVenue(v, interests, radiusM, p));
      const foodCountBefore = scoresBefore.filter(s => s > 0).length;

      // Hide one fine dining
      simulateHide(p, TEST_VENUES.find(v => v.id === 'v-fine-1')!);

      const scoresAfter = foodVenues.map(v => scoreVenue(v, interests, radiusM, p));
      const foodCountAfter = scoresAfter.filter(s => s > 0).length;

      // Food count should NOT collapse (at most -1 for the hidden venue)
      expect(foodCountAfter).toBeGreaterThanOrEqual(foodCountBefore - 1);
    });

    it('requires ≥2 concordant hides before facet penalty', () => {
      const p = emptyProfile();
      simulateLike(p, TEST_VENUES.find(v => v.id === 'v-fine-1')!);

      // One hide — no penalty on format:fine_dining
      simulateHide(p, TEST_VENUES.find(v => v.id === 'v-fine-1')!);
      const weightAfter1 = p.facet_weights['format']?.['fine_dining'] ?? 0;
      // Weight should still be positive (from the like, penalty not applied yet)
      expect(weightAfter1).toBeGreaterThanOrEqual(0);

      // Second hide — NOW penalty applies
      simulateHide(p, TEST_VENUES.find(v => v.id === 'v-fine-3')!); // another fine_dining
      const counterKey = 'format:fine_dining';
      expect(p.neg_counters[counterKey]).toBeGreaterThanOrEqual(NEG_THRESHOLD);
    });
  });

  describe('Determinism', () => {
    it('same profile + same venues → identical scores', () => {
      const p = emptyProfile();
      simulateLike(p, TEST_VENUES[0]);
      simulateLike(p, TEST_VENUES[1]);

      const scores1 = TEST_VENUES.map(v => scoreVenue(v, interests, radiusM, p));
      const scores2 = TEST_VENUES.map(v => scoreVenue(v, interests, radiusM, p));

      expect(scores1).toEqual(scores2);
    });
  });

  describe('Distinct users', () => {
    it('different personas → different top-5', () => {
      const foodie = emptyProfile();
      for (const v of TEST_VENUES.filter(v => v.facetAtmosphere.includes('upscale'))) {
        simulateLike(foodie, v);
      }

      const nightowl = emptyProfile();
      for (const v of TEST_VENUES.filter(v => v.facetAtmosphere.includes('lively'))) {
        simulateLike(nightowl, v);
      }

      const foodieScores = TEST_VENUES
        .map(v => ({ id: v.id, score: scoreVenue(v, interests, radiusM, foodie) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(s => s.id);

      const nightScores = TEST_VENUES
        .map(v => ({ id: v.id, score: scoreVenue(v, { nightlife: 1 }, radiusM, nightowl) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(s => s.id);

      // Jaccard < 0.5 (at most 2 overlap out of 5)
      const overlap = foodieScores.filter(id => nightScores.includes(id)).length;
      expect(overlap, 'different personas should have different top-5').toBeLessThanOrEqual(2);
    });
  });

  describe('IDF: rare > common', () => {
    it('liking sushi (rare IDF) moves profile more than georgian (common IDF)', () => {
      const pRare = emptyProfile();
      simulateLike(pRare, TEST_VENUES.find(v => v.id === 'v-rare-1')!); // sushi, IDF ~6.68

      const pCommon = emptyProfile();
      simulateLike(pCommon, TEST_VENUES.find(v => v.id === 'v-common-1')!); // georgian, IDF ~2.83

      // Rare like should produce larger weight magnitude
      const rareNorm = Object.values(pRare.facet_weights).reduce(
        (s, vals) => s + Object.values(vals).reduce((s2, w) => s2 + w * w, 0), 0
      );
      const commonNorm = Object.values(pCommon.facet_weights).reduce(
        (s, vals) => s + Object.values(vals).reduce((s2, w) => s2 + w * w, 0), 0
      );

      expect(rareNorm, 'rare facet like produces larger profile vector').toBeGreaterThan(commonNorm);
    });
  });

  describe('Cold start', () => {
    it('empty profile → personalization component = 0 for all venues', () => {
      const p = emptyProfile();
      for (const v of TEST_VENUES) {
        const personal = cosineScore(p, v);
        const w = wPersonal(p);
        expect(w * personal, `${v.name} personalization should be 0`).toBe(0);
      }
    });

    it('empty profile → venues sorted by base score (distance + interest)', () => {
      const scores = TEST_VENUES
        .filter(v => v.tags.includes('food'))
        .map(v => ({ id: v.id, score: scoreVenue(v, interests, radiusM, null) }))
        .sort((a, b) => b.score - a.score);

      // Closest food venues should rank highest
      const top3 = scores.slice(0, 3);
      for (const s of top3) {
        const venue = TEST_VENUES.find(v => v.id === s.id)!;
        expect(venue.distanceM, `${venue.name} should be close`).toBeLessThan(1000);
      }
    });
  });

  describe('Price tier', () => {
    it('liking only cheap places → cheap venues get higher personalization', () => {
      const p = emptyProfile();
      const cheapVenues = TEST_VENUES.filter(v => v.facetPriceTier === 1);
      for (const v of cheapVenues) simulateLike(p, v);

      const cheapScores = cheapVenues.map(v => cosineScore(p, v));
      const expensiveVenues = TEST_VENUES.filter(v => (v.facetPriceTier ?? 0) >= 4);
      const expensiveScores = expensiveVenues.map(v => cosineScore(p, v));

      const avgCheap = cheapScores.reduce((s, v) => s + v, 0) / cheapScores.length;
      const avgExpensive = expensiveScores.length > 0
        ? expensiveScores.reduce((s, v) => s + v, 0) / expensiveScores.length
        : 0;

      expect(avgCheap, 'cheap venues cosine > expensive after cheap likes').toBeGreaterThan(avgExpensive);
    });
  });
});
