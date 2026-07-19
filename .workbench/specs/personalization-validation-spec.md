# Personalization Validation & Testing — Детальная спека

*Как доказать что персонализация работает. Simulation + inspection, не A/B.*
*Зависит от: Phase A (facets), F1 (impressions), F2 (taste profile) — все complete.*

---

## Принципы

1. **Нет ground-truth oracle** — нельзя написать `assertEquals(expectedRanking)`. Используем metamorphic/invariant тесты: "если лайкнул X → X не упал в ранге".
2. **Offline metrics ≠ online success** — directional invariants + preference-recovery надёжнее чем абсолютные NDCG числа.
3. **Seed = детерминизм** — без фиксированного seed тесты нестабильны. Все random компоненты должны принимать seed.
4. **Синтетические персоны вместо A/B** — при 0 трафике A/B бессмысленны. Создаём persona с known hidden preferences, проверяем recovery.

---

## Stage 1: Foundation (~4ч)

### 1.1 Fixture venue set (15 мест)

Файл: `apps/api/src/test/fixtures/test-venues.ts`

```ts
export const TEST_VENUES = [
  // Upscale fine dining
  { id: 'v-fine-1', name: 'Château Mukhrani', category: 'restaurant',
    facetCuisine: ['georgian'], facetFormat: ['fine_dining'],
    facetAtmosphere: ['upscale', 'romantic'], facetOccasion: ['date', 'celebration'],
    facetPriceTier: 5, tags: ['food', 'restaurant'], googleRating: 4.8, distanceM: 800 },

  { id: 'v-fine-2', name: 'Wine Gallery', category: 'restaurant',
    facetCuisine: ['georgian'], facetFormat: ['wine_bar'],
    facetAtmosphere: ['upscale', 'cozy', 'live_music'], facetOccasion: ['date'],
    facetPriceTier: 4, tags: ['food', 'bar', 'nightlife'], googleRating: 4.7, distanceM: 1200 },

  { id: 'v-fine-3', name: 'Barbarestan', category: 'restaurant',
    facetCuisine: ['georgian'], facetFormat: ['fine_dining'],
    facetAtmosphere: ['upscale', 'cultural', 'traditional'], facetOccasion: ['celebration'],
    facetPriceTier: 5, tags: ['food', 'restaurant'], googleRating: 4.9, distanceM: 500 },

  // McDonald's (cheap, chain, no atmosphere)
  { id: 'v-mcdonalds', name: "McDonald's", category: 'restaurant',
    facetCuisine: ['burgers'], facetFormat: ['fast_food'],
    facetAtmosphere: ['casual', 'family_friendly'], facetOccasion: ['quick_stop'],
    facetPriceTier: 1, tags: ['food', 'restaurant'], googleRating: 3.5, distanceM: 300,
    isChain: true, chainKey: 'mcdonalds' },

  // Budget café
  { id: 'v-budget-cafe', name: 'Tone Café', category: 'cafe',
    facetCuisine: null, facetFormat: ['cafe'],
    facetAtmosphere: ['casual', 'work_friendly'], facetOccasion: ['solo', 'quick_stop'],
    facetPriceTier: 1, tags: ['food', 'cafe'], googleRating: 4.0, distanceM: 200 },

  // Wine bar
  { id: 'v-wine-1', name: 'Vino Underground', category: 'bar',
    facetCuisine: null, facetFormat: ['wine_bar'],
    facetAtmosphere: ['cozy', 'romantic', 'quiet'], facetOccasion: ['date'],
    facetPriceTier: 4, tags: ['bar', 'nightlife'], googleRating: 4.6, distanceM: 900 },

  // Lively nightclub
  { id: 'v-club-1', name: 'Bassiani', category: 'club',
    facetCuisine: null, facetFormat: ['club'],
    facetAtmosphere: ['lively', 'trendy'], facetOccasion: ['friends', 'celebration'],
    facetPriceTier: 3, tags: ['nightlife', 'club', 'entertainment'], googleRating: 3.5, distanceM: 3000 },

  // Family restaurant
  { id: 'v-family-1', name: 'Samikitno', category: 'restaurant',
    facetCuisine: ['georgian'], facetFormat: ['family'],
    facetAtmosphere: ['family_friendly', 'traditional', 'casual'], facetOccasion: ['family_outing'],
    facetPriceTier: 2, tags: ['food', 'restaurant'], googleRating: 4.3, distanceM: 600 },

  // Park (non-food)
  { id: 'v-park-1', name: 'Mtatsminda Park', category: 'park',
    facetCuisine: null, facetFormat: null,
    facetAtmosphere: ['outdoorsy', 'family_friendly', 'scenic'], facetOccasion: ['family_outing', 'exploring'],
    facetPriceTier: 1, tags: ['outdoor', 'park'], googleRating: 4.4, distanceM: 2000 },

  // Museum
  { id: 'v-museum-1', name: 'National Museum', category: 'museum',
    facetCuisine: null, facetFormat: null,
    facetAtmosphere: ['cultural', 'quiet'], facetOccasion: ['exploring', 'solo'],
    facetPriceTier: 1, tags: ['culture', 'museum'], googleRating: 4.5, distanceM: 1500 },

  // Bar with live music
  { id: 'v-bar-music', name: 'Dzveli Ubani Jazz', category: 'bar',
    facetCuisine: null, facetFormat: ['bar'],
    facetAtmosphere: ['lively', 'live_music', 'cozy'], facetOccasion: ['friends', 'date'],
    facetPriceTier: 3, tags: ['bar', 'nightlife', 'food'], googleRating: 4.5, distanceM: 700 },

  // Bakery (cheap, morning)
  { id: 'v-bakery-1', name: 'Tone Bread', category: 'bakery',
    facetCuisine: null, facetFormat: ['bakery'],
    facetAtmosphere: ['casual', 'traditional'], facetOccasion: ['quick_stop'],
    facetPriceTier: 1, tags: ['food', 'bakery'], googleRating: 4.1, distanceM: 150 },

  // Spa
  { id: 'v-spa-1', name: 'Royal Bath', category: 'spa',
    facetCuisine: null, facetFormat: null,
    facetAtmosphere: ['quiet', 'romantic', 'traditional'], facetOccasion: ['date', 'solo'],
    facetPriceTier: 3, tags: ['bath', 'spa'], googleRating: 4.3, distanceM: 1800 },

  // Rare cuisine (high IDF)
  { id: 'v-rare-1', name: 'Sushi House', category: 'restaurant',
    facetCuisine: ['sushi'], facetFormat: ['restaurant'],
    facetAtmosphere: ['quiet', 'upscale'], facetOccasion: ['date'],
    facetPriceTier: 4, tags: ['food', 'restaurant'], googleRating: 4.4, distanceM: 1100 },

  // Common cuisine (low IDF)
  { id: 'v-common-1', name: 'Khinkali House', category: 'restaurant',
    facetCuisine: ['georgian'], facetFormat: ['restaurant'],
    facetAtmosphere: ['casual', 'traditional'], facetOccasion: ['friends', 'family_outing'],
    facetPriceTier: 2, tags: ['food', 'restaurant'], googleRating: 4.2, distanceM: 400 },
];
```

**IDF для fixtures** (pre-computed, hardcoded в тестах):
- `cuisine:sushi` → IDF ~7.0 (rare, 4 venues в каталоге)
- `cuisine:georgian` → IDF ~2.8 (common, 186 venues)
- `format:fine_dining` → IDF ~6.3 (rare, 5 venues)
- `format:cafe` → IDF ~2.3 (common, 320 venues)
- `atmosphere:upscale` → IDF ~4.5 (medium-rare)
- `atmosphere:casual` → IDF ~2.5 (common)

---

### 1.2 Seed injection

**Где:** `ImpressionService.applySessionDithering()` и `injectEpsilonSlot()` уже используют `mulberry32`. Нужно пробросить seed как параметр.

**Изменения:**

**⚠️ НЕ добавлять `_devSeed` в основной `DiscoverRequestDto`** — это вектор для скрейпинга/предсказания выдачи на проде. Dev-параметр в публичном DTO имеет привычку жить годами.

**Seed только на `/explain` endpoint** (который сам под dev-guard):
```ts
// ExplainRequestDto (отдельный от DiscoverRequestDto)
class ExplainRequestDto extends DiscoverRequestDto {
  @IsOptional()
  @IsNumber()
  seed?: number;  // deterministic replay, dev-only
}
```

В основном `discover()` seed НЕ принимается — dithering/epsilon всегда random.

`ImpressionService` — принять optional seed:
```ts
applySessionDithering(scored: any[], deviceIdHash: string, fixedSeed?: number): void {
  const sessionSeed = fixedSeed ?? this.simpleHash(deviceIdHash + ...);
  // rest unchanged
}

injectEpsilonSlot(..., fixedSeed?: number): void {
  const seed = fixedSeed ?? this.simpleHash(deviceIdHash + ...);
  // rest unchanged
}
```

**Трудозатраты:** 1ч.

---

### 1.3 Score-breakdown endpoint

**Файл:** `apps/api/src/app/recommendation/recommendation.controller.ts`

```ts
@Post('explain')
async explain(@Body() dto: DiscoverRequestDto) {
  return this.service.discoverWithExplanation(dto);
}
```

**Метод:** `RecommendationService.discoverWithExplanation()` — как `discover()` но возвращает decomposition:

```ts
async discoverWithExplanation(dto: DiscoverRequestDto) {
  // Run normal pipeline but capture components per candidate
  // Return:
  {
    profileSnapshot: {
      facet_weights: {...},
      price_pref: {...},
      signal_count: N,
      w_personal: 0.XX,
    },
    seed: usedSeed,
    results: [
      {
        venueId: 'xxx',
        name: 'Château Mukhrani',
        rank: 1,
        finalScore: 0.83,
        components: {
          interest: 0.41,
          distance: 0.20,
          time: 0.12,
          quality: 0.07,
          source: 0.03,
          personalization: 0.14,   // w_personal × cosine
          priceBoost: 0.02,        // gaussian
          impressionDiscount: 1.0, // multiplier (1.0 = no discount)
          chainPenalty: 1.0,       // multiplier (0.85 for chains)
        },
        facetMatch: {
          'atmosphere:upscale': 0.9,
          'format:fine_dining': 0.8,
        },
        whyLabel: 'Ваш вайб: upscale',
        flags: {
          isExplore: false,
          isFavorite: false,
          isChain: false,
        },
      },
      // ...
    ]
  }
}
```

**Как реализовать:** вынести score components из `scoreCandidate()` в объект вместо единственного `score`. Не ломать основной `discover()` — `explain` вызывает те же функции но сохраняет промежуточные значения.

**Трудозатраты:** 2ч.

---

## Stage 2: Core Tests (~7ч)

### 2.1 McDonald's acceptance test

**Файл:** `apps/api/src/test/personalization/mcdonalds.spec.ts`

```ts
describe('McDonald's test (canonical acceptance)', () => {
  // Setup: fixture venues, fresh profile, IDF

  it('after 3 likes on fine dining, all 3 outrank McDonald\'s in Food', () => {
    // 1. Create empty profile
    // 2. Simulate: updateOnPositive('v-fine-1', 'save'), repeat for v-fine-2, v-fine-3
    // 3. Score all food venues with profile
    // 4. Assert: v-fine-1, v-fine-2, v-fine-3 all have higher score than v-mcdonalds
  });

  it('McDonald\'s score does NOT drop to zero (never disliked)', () => {
    // After 3 fine dining likes:
    // McDonald's finalScore > 0 (base score still contributes)
  });

  it('Food category floor is respected (≥10% exposure)', () => {
    // Count food venues in top-N
    // Assert: food venues ≥ 10% of total
    // (McDonald's is still present, just ranked lower)
  });
});
```

**Трудозатраты:** 2ч.

---

### 2.2 Preference-recovery test

**Файл:** `apps/api/src/test/personalization/preference-recovery.spec.ts`

```ts
describe('Preference recovery', () => {
  it('converges to IDF-adjusted hidden preference vector after N signals', () => {
    // ⚠️ Сравниваем с IDF-СКОРРЕКТИРОВАННЫМ hidden вектором, не с чистым.
    // IDF придавливает частые фасеты (georgian IDF~2.8) и усиливает редкие (sushi IDF~7.0).
    // Если сравнивать с "чистым" hidden, косинус застрянет ниже порога при корректной работе.
    //
    // 1. Define hidden vector using MEDIUM-RARE facets (не georgian!):
    //    { atmosphere: { upscale: 0.9, live_music: 0.8 }, format: { wine_bar: 0.7 } }
    // 2. Compute IDF-adjusted hidden: hidden[f] × idf[f] (same transform as profile update)
    // 3. Select venues consistent with hidden vector
    // 4. Simulate 10 'save' signals
    // 5. Load learned profile
    // 6. Compute cosine(learned, idf_adjusted_hidden)
    // 7. Assert cosine > 0.6 (IDF adjustment makes exact match harder)
  });

  it('profile improves monotonically with more signals (MAIN assertion)', () => {
    // Монотонность — ГЛАВНЫЙ тест. Абсолютный cosine — вторичный.
    // After 3 signals: cosine_3
    // After 7 signals: cosine_7
    // After 15 signals: cosine_15
    // Assert: cosine_3 < cosine_7 < cosine_15 (strict monotonic)
    // Secondary: cosine_15 > 0.5 (soft absolute threshold)
  });

  it('w_personal ramps correctly', () => {
    // 0 signals → w_personal = 0
    // 5 signals → w_personal ≈ 0.067
    // 15 signals → w_personal = 0.20
  });
});
```

**Трудозатраты:** 2ч.

---

### 2.3 Invariant / metamorphic suite

**Файл:** `apps/api/src/test/personalization/invariants.spec.ts`

```ts
describe('Personalization invariants', () => {

  describe('Monotonic like', () => {
    it('adding one more like on wine bars improves average wine bar SCORE', () => {
      // ⚠️ АГРЕГАТНЫЙ инвариант, не поэлементный.
      // Поэлементный "ни один не упал в ранге" ложно падает из-за дизеринга/калибровки.
      // Дизеринг может переставить два винбара между собой даже при росте их scores.
      //
      // 1. Score with profile P → compute avg score of wine bars
      // 2. Add one more wine bar like → profile P'
      // 3. Score with P' → compute new avg score of wine bars
      // 4. Assert: avg_score(P') > avg_score(P) (aggregate improvement)
      // 5. OPTIONAL: test on RAW scores (before dithering) for per-item monotonicity
    });
  });

  describe('Hide locality', () => {
    it('hiding one venue does not collapse its base category', () => {
      // 1. Score with fresh profile → count food venues in top-15
      // 2. Hide v-fine-1 → updateOnHide
      // 3. Re-score → count food venues in top-15
      // 4. Assert: food count decreased by at most 1 (the hidden venue)
      // 5. Assert: food count ≥ floor (10% of total)
    });

    it('requires ≥2 concordant hides before facet penalty', () => {
      // 1. Hide ONE fine_dining venue → check neg_counters
      // 2. Assert: facet_weights['format']['fine_dining'] NOT penalized yet
      // 3. Hide SECOND fine_dining venue → check again
      // 4. Assert: NOW penalized (threshold ≥2 reached)
    });
  });

  describe('Determinism', () => {
    it('same profile + same seed = identical ranking', () => {
      // Run explain twice with same dto + seed=42
      // Assert: results arrays are identical
    });
  });

  describe('Distinct users', () => {
    it('two different personas get different top-5', () => {
      // Persona A: likes upscale food → profile A
      // Persona B: likes nightlife clubs → profile B
      // Score both with same venues
      // Assert: top-5 lists differ (Jaccard < 0.5)
    });
  });

  describe('IDF: rare > common', () => {
    it('liking sushi (rare) moves profile more than liking georgian (common)', () => {
      // Fresh profile → like v-rare-1 (sushi, IDF~7.0) → profile A
      // Fresh profile → like v-common-1 (georgian, IDF~2.8) → profile B
      // Assert: ||A.facet_weights|| > ||B.facet_weights|| (rare had more impact)
    });
  });

  describe('Cold start fallback', () => {
    it('empty profile → personalization term ≈ 0, base score dominates', () => {
      // Score with empty profile
      // Assert: all venues' personalization component = 0
      // Assert: results sorted by base score (interest + distance + time + quality)
    });
  });

  describe('Price tier', () => {
    it('liking only cheap places boosts cheap venues', () => {
      // 5 likes on price_tier=1 venues → profile
      // Score all → assert price_tier=1 venues have positive priceBoost
      // Assert price_tier=5 venues have near-zero priceBoost
    });
  });
});
```

**Трудозатраты:** 3ч.

---

## Stage 3: Dev Dashboard (~5ч, после тестов)

### 3.1 Route `/dev/reco-lab`

**Guard:** проверка `environment.production === false` или dev query param.

### 3.2 Panels

**Panel 1: Profile Inspector**
- Горизонтальные бары по типу фасета (cuisine, format, atmosphere, occasion)
- Raw weight + IDF-adjusted weight
- signal_count + w_personal текущий

**Panel 2: Ranked List с decomposition**
- Таблица: rank | name | finalScore | interest | distance | time | quality | personal | price | discount | chain
- Stacked bar chart per venue
- Highlight explore slots

**Panel 3: What-If Simulator**
- Кнопки "Like" / "Hide" на каждом venue
- Before/after diff: какие venues двинулись, на сколько
- Profile diff: какие weights изменились

**Panel 4: Metrics Strip**
- ILD (intra-list diversity)
- Category distribution pie chart
- Coverage: сколько уникальных venues показано

**Реализация:** standalone Angular component, lazy-loaded route, calls `/dev/recommend/explain`.

**Трудозатраты:** 5ч.

---

## Personas (6 сценариев)

| # | Persona | Hidden preferences | Expected top-3 | Anti-expected |
|---|---|---|---|---|
| 1 | Upscale foodie | upscale + live_music + wine_bar | v-fine-1, v-fine-2, v-wine-1 | McDonald's low |
| 2 | Budget backpacker | cheap + casual + exploring | v-budget-cafe, v-bakery-1, v-park-1 | Fine dining low |
| 3 | Family | family_friendly + traditional | v-family-1, v-park-1, v-common-1 | Clubs/bars absent |
| 4 | Nightlife | lively + club + live_music | v-club-1, v-bar-music, v-wine-1 | Museum/park low |
| 5 | Mixed 70/30 | 70% upscale, 30% casual | ~70% upscale in top-10 | Calibration holds |
| 6 | Cold start | empty | Popular + nearby | Personalization = 0 |

---

## Beyond-accuracy metrics (compute over personas)

| Metric | Formula | Healthy range | Bug it catches |
|---|---|---|---|
| **C_KL (calibration)** | Σ p(g) · log(p(g)/q(g)) | < 0.3 | List drifts from taste |
| **ILD (diversity)** | avg pairwise 1-cosine | 0.3–0.7 | Monotonous list |
| **Coverage** | unique venues / total | > 30% over 10 sessions | Filter bubble |
| **Gini** | inequality of venue exposure | < 0.7 | Few venues dominate |
| **Novelty** | avg -log₂(popularity) | Rising with stable HR | Healthy discovery |
| **Personalization** | 1 - avg overlap between users | > 0.3 | System ignores profile |

---

## Файловая структура

```
apps/api/src/test/
  fixtures/
    test-venues.ts          ← 15 hand-crafted venues
    test-idf.ts             ← pre-computed IDF for fixtures
  personalization/
    mcdonalds.spec.ts       ← acceptance test
    preference-recovery.spec.ts
    invariants.spec.ts      ← monotonic, hide-locality, determinism, etc.
    personas.spec.ts        ← 6 persona scenarios
    metrics.spec.ts         ← C_KL, ILD, coverage computations

src/app/features/dev/
  reco-lab/
    reco-lab.component.ts   ← dev dashboard (lazy-loaded)
    reco-lab.routes.ts
```

---

## Трудозатраты

| Задача | Часы |
|---|---|
| 1.1 Fixture venue set | 1 |
| 1.2 Seed injection | 1 |
| 1.3 Score-breakdown endpoint | 2 |
| 2.1 McDonald's test | 2 |
| 2.2 Preference-recovery test | 2 |
| 2.3 Invariant suite (7 tests) | 3 |
| 3.1-3.2 Dev dashboard | 5 |
| **Total** | **~16ч** |

---

## Порядок

```
1. Fixture venues + IDF          [1ч]
2. Seed injection                [1ч]
3. Score-breakdown endpoint      [2ч]
4. McDonald's test               [2ч]
5. Preference-recovery test      [2ч]
6. Invariant suite               [3ч]
   ← все тесты зелёные = персонализация ДОКАЗАНА
7. Dev dashboard (optional)      [5ч]
```

**Gate:** McDonald's test + preference-recovery + invariants все зелёные → система работает корректно → merge.
