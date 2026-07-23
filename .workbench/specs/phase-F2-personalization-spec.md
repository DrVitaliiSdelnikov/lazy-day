# Phase F2 — Faceted Profile & Personalization: Детальная спека

*Требует Phase A (фасеты на местах + IDF) и Phase F1 (impression_agg).*
*Вход: facet_* поля, facet_idf, impression_agg из F1*
*Выход: personalizationScore в scoring pipeline, taste profile обновления*

---

## Зависимости

```
Phase A done (facet_*, facet_idf, enriched_at) ── BLOCKER
Phase F1 done (impression_agg, discount) ────── BLOCKER
  ↓
F2.1 user_taste_profile таблица
F2.2 profile update logic (IDF + decay + signal weights)
  ↓
F2.3 personalizationScore в scoring (cosine, w_personal ramp)
F2.4 facet-level negative (hide → IDF-attributed penalties)
F2.5 price tier gaussian boost
F2.6 anti-bubble (streak + epsilon, НЕ калибровка)
  ↓
F2.7 Steck calibration [GATED — только на зрелых профилях]
```

---

## F2.1 user_taste_profile таблица

**Миграция (019 или 020):**
```sql
CREATE TABLE IF NOT EXISTS user_taste_profile (
  device_id_hash TEXT PRIMARY KEY,
  facet_weights  JSONB NOT NULL DEFAULT '{}',
  price_pref     JSONB NOT NULL DEFAULT '{}',
  neg_counters   JSONB NOT NULL DEFAULT '{}',
  signal_count   INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`signal_count` — сколько позитивных сигналов получено. Используется для ramp w_personal.

**GC:** удаляется вместе с user записью (UX-24 GC cron >90 дней).

**GDPR delete:** `DELETE FROM user_taste_profile WHERE device_id_hash = $1`.

---

## F2.2 Profile update (позитивные сигналы)

**Когда:** route, save, share, click, decide_open, been_here (будущее).

**Signal weights:**
```ts
const SIGNAL_WEIGHTS: Record<string, number> = {
  'been_here': 1.0,
  'save': 1.0,
  'route': 0.7,
  'taxi': 0.7,
  'share': 0.7,
  'ticket_click': 0.7,
  'decide_open': 0.5,
  'card_click': 0.3,
};
```

**Update logic:**
```ts
async updateTasteProfile(deviceIdHash: string, venueId: string, action: string) {
  const DECAY = 0.9;
  const signalWeight = SIGNAL_WEIGHTS[action] ?? 0.3;

  // Получить фасеты места
  const place = await this.placeRepo.findOne({ where: { id: venueId } });
  if (!place) return;

  const allFacets: Array<{ type: string; value: string }> = [];
  for (const c of place.facetCuisine ?? []) allFacets.push({ type: 'cuisine', value: c });
  for (const f of place.facetFormat ?? []) allFacets.push({ type: 'format', value: f });
  for (const a of place.facetAtmosphere ?? []) allFacets.push({ type: 'atmosphere', value: a });
  for (const o of place.facetOccasion ?? []) allFacets.push({ type: 'occasion', value: o });

  if (allFacets.length === 0) return;

  // Загрузить или создать профиль
  let profile = await this.dataSource.query(
    'SELECT facet_weights, price_pref, signal_count FROM user_taste_profile WHERE device_id_hash = $1',
    [deviceIdHash]
  );

  let weights: Record<string, Record<string, number>> = {};
  let pricePref: { histogram?: number[]; mu?: number; sigma?: number } = {};
  let signalCount = 0;

  if (profile.length > 0) {
    weights = profile[0].facet_weights;
    pricePref = profile[0].price_pref;
    signalCount = profile[0].signal_count;
  }

  // Загрузить IDF
  const idfRows = await this.dataSource.query('SELECT facet_key, idf FROM facet_idf');
  const idfMap = new Map(idfRows.map((r: any) => [r.facet_key, r.idf]));

  // Обновить веса
  for (const { type, value } of allFacets) {
    const idf = idfMap.get(`${type}:${value}`) ?? 3.0;  // default IDF
    if (!weights[type]) weights[type] = {};
    const current = weights[type][value] ?? 0;
    // EMA: decay × current + (1-decay) × signal × idf
    weights[type][value] = DECAY * current + (1 - DECAY) * signalWeight * idf;
  }

  // Обновить price preference
  if (place.facetPriceTier) {
    const tier = place.facetPriceTier;  // 1-5
    if (!pricePref.histogram) pricePref.histogram = [0, 0, 0, 0, 0];
    pricePref.histogram[tier - 1] += signalWeight;

    // Пересчитать mu и sigma
    const h = pricePref.histogram;
    const total = h.reduce((s, v) => s + v, 0);
    if (total > 0) {
      pricePref.mu = h.reduce((s, v, i) => s + v * (i + 1), 0) / total;
      const variance = h.reduce((s, v, i) => s + v * Math.pow(i + 1 - pricePref.mu!, 2), 0) / total;
      pricePref.sigma = Math.sqrt(variance) || 1.0;
    }
  }

  signalCount++;

  // Upsert
  await this.dataSource.query(`
    INSERT INTO user_taste_profile (device_id_hash, facet_weights, price_pref, signal_count, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (device_id_hash) DO UPDATE SET
      facet_weights = $2, price_pref = $3, signal_count = $4, updated_at = NOW()
  `, [deviceIdHash, JSON.stringify(weights), JSON.stringify(pricePref), signalCount]);
}
```

**Decay:** half-life ~60-90 дней. EMA с decay=0.9 означает вес старого сигнала уменьшается каждым новым. Не нужен отдельный cron — decay встроен в формулу обновления.

---

## F2.3 personalizationScore в scoring

**Формула:**
```
personalizationScore(user, venue) = cosine(user_vector, venue_vector)

user_vector = flat vector из facet_weights[type][value] для всех фасетов
venue_vector = binary vector (1 если фасет есть, 0 нет)

score = base_score + w_personal × personalizationScore
```

**w_personal ramp:**
```ts
function computeWPersonal(signalCount: number): number {
  const W_MAX = 0.20;
  const RAMP_SIGNALS = 15;  // полный вес после 15 сигналов
  return W_MAX * Math.min(1, signalCount / RAMP_SIGNALS);
}
// 0 signals → 0.0
// 5 signals → 0.067
// 10 signals → 0.133
// 15+ signals → 0.20
```

**Имплементация в scoreCandidate:**
```ts
private scoreCandidate(c, dto, radiusM, expandedWeights, userProfile?) {
  // ... существующий scoring ...

  let score = WEIGHTS.interestMatch * interestScore
    + WEIGHTS.distanceDecay * distance
    + WEIGHTS.timeFit * time
    + WEIGHTS.cardQuality * quality
    + WEIGHTS.sourceConfidence * source;

  // NEW: personalization term
  if (userProfile && userProfile.signal_count > 0) {
    const personalScore = this.computeCosine(userProfile.facet_weights, c);
    const wPersonal = computeWPersonal(userProfile.signal_count);
    score += wPersonal * personalScore;
  }

  if (c.is_chain && c.type === 'place') score *= 0.85;

  return { ...c, score, ... };
}
```

**computeCosine:**
```ts
private computeCosine(
  weights: Record<string, Record<string, number>>,
  venue: CandidateRow,
): number {
  const venueFacets = new Set<string>();
  for (const c of (venue as any).facet_cuisine ?? []) venueFacets.add(`cuisine:${c}`);
  for (const f of (venue as any).facet_format ?? []) venueFacets.add(`format:${f}`);
  for (const a of (venue as any).facet_atmosphere ?? []) venueFacets.add(`atmosphere:${a}`);
  for (const o of (venue as any).facet_occasion ?? []) venueFacets.add(`occasion:${o}`);

  if (venueFacets.size === 0) return 0;

  let dot = 0, normU = 0;
  for (const [type, vals] of Object.entries(weights)) {
    for (const [val, w] of Object.entries(vals)) {
      normU += w * w;
      if (venueFacets.has(`${type}:${val}`)) dot += w;
    }
  }

  if (normU === 0) return 0;
  const normV = Math.sqrt(venueFacets.size);  // binary vector norm = sqrt(count)
  return dot / (Math.sqrt(normU) * normV);
}
```

**Порядок в pipeline:**
```
3. score = base
3.5 score += w_personal × personalizationScore   ← NEW (F2.3)
7. score *= impression_discount                    (F1.2)
```

---

## F2.4 Facet-level negative

**Когда:** hide. Только ПОСЛЕ порога ≥2-3 согласованных негативов по фасету.

```ts
async applyHideNegative(deviceIdHash: string, venueId: string) {
  const N_THRESHOLD = 2;
  const ETA_NEG_RATIO = 0.4;  // η_neg = 0.4 × η_pos (η_pos ≈ signal_weight × idf)

  const place = await this.placeRepo.findOne({ where: { id: venueId } });
  if (!place) return;

  const allFacets: Array<{ type: string; value: string }> = [];
  for (const c of place.facetCuisine ?? []) allFacets.push({ type: 'cuisine', value: c });
  for (const f of place.facetFormat ?? []) allFacets.push({ type: 'format', value: f });
  for (const a of place.facetAtmosphere ?? []) allFacets.push({ type: 'atmosphere', value: a });

  if (allFacets.length === 0) return;

  // Загрузить профиль
  const profileRow = await this.dataSource.query(
    'SELECT facet_weights, neg_counters FROM user_taste_profile WHERE device_id_hash = $1',
    [deviceIdHash]
  );
  if (profileRow.length === 0) return;

  const weights = profileRow[0].facet_weights;
  const negCounters: Record<string, number> = profileRow[0].neg_counters ?? {};

  // IDF
  const idfRows = await this.dataSource.query('SELECT facet_key, idf FROM facet_idf');
  const idfMap = new Map(idfRows.map((r: any) => [r.facet_key, Number(r.idf)]));

  // IDF sum для нормировки
  const idfSum = allFacets.reduce((s, f) => s + (idfMap.get(`${f.type}:${f.value}`) ?? 3.0), 0);
  const IDF_MIN = 2.0;  // не штрафовать "food", "restaurant"

  for (const { type, value } of allFacets) {
    const key = `${type}:${value}`;
    const idf = idfMap.get(key) ?? 3.0;

    if (idf < IDF_MIN) continue;  // skip low-IDF (too common)

    // Increment neg counter
    negCounters[key] = (negCounters[key] ?? 0) + 1;

    // Apply penalty only after threshold
    if (negCounters[key] >= N_THRESHOLD) {
      const penalty = ETA_NEG_RATIO * idf / idfSum;
      if (!weights[type]) weights[type] = {};
      weights[type][value] = Math.max(-0.5, (weights[type][value] ?? 0) - penalty);
    }
  }

  // Save
  await this.dataSource.query(`
    UPDATE user_taste_profile SET facet_weights = $1, neg_counters = $2, updated_at = NOW()
    WHERE device_id_hash = $3
  `, [JSON.stringify(weights), JSON.stringify(negCounters), deviceIdHash]);
}
```

**Негатив decay:** neg_counters затухают с half-life 21-30 дней. Реализация: cron уменьшает neg_counters раз в неделю.

**Пол категории 10%:** проверяется в scoring — если после personalizationScore категория venue составляет <10% выдачи → clamp personalizationScore для этой категории.

---

## F2.5 Price tier gaussian boost

```ts
function priceTierBoost(
  pricePref: { mu?: number; sigma?: number },
  venueTier: number | null,
): number {
  if (!pricePref.mu || !pricePref.sigma || !venueTier) return 0;

  const BETA = 0.06;  // max boost
  return BETA * Math.exp(
    -Math.pow(venueTier - pricePref.mu, 2) / (2 * Math.pow(pricePref.sigma, 2))
  );
}

// В scoring:
// score += priceTierBoost(profile.price_pref, venue.facetPriceTier);
```

**Никогда не отсекает жёстко.** β ≤ 0.08, чтобы price preference не доминировал.

---

## F2.6 Anti-bubble (тонкие профили)

**НЕ калибровка.** На тонких профилях (<10 сигналов) полагаемся на:
- Category streak limit (уже есть — diversity filter шаг 9)
- Epsilon explore (F1.4 — подмешивание нового)
- Impression discount (F1.2 — топит повторные)

**Этих трёх достаточно** для предотвращения пузыря при 2-3 сигналах.

---

## F2.7 Steck calibration [GATED]

**Включается только когда:**
```ts
const isProfileMature = profile.signal_count >= 10 && computeWPersonal(profile.signal_count) > 0.15;
```

**Если mature:**
```ts
// Соотношение 70% вкус / 30% exploration
// Подсчитать распределение фасетов в текущей выдаче
// Если >70% одного фасета → снизить score верхних, поднять нижних
// Реализация: post-scoring re-rank
```

**Отложено.** Реализовать при наличии данных.

---

## Итоговый pipeline с F1 + F2

```
1. fetch candidates
2. hard filter (hidden, budget)
3. base score (interest + distance + time + quality + source)
3.5 + w_personal × personalizationScore           ← F2.3
3.6 + priceTierBoost                                ← F2.5
4. interest hard filter
5. availability filter
6. adaptive radius (+ F1.6)
7. × impression_discount                            ← F1.2
8. sort
9. favorite re-surface                              ← F1.5
10. [Steck calibration if mature]                   ← F2.7
11. session dithering                                ← F1.3
12. daily rotation
13. diversity filter
14. inject epsilon slot                              ← F1.4
15. build cards
16. record impressions async                         ← F1.1
17. update taste profile async (on engagement)       ← F2.2
```

---

## Сводка трудозатрат

| Задача | Часы |
|---|---|
| F2.1 user_taste_profile table | 1 |
| F2.2 profile update logic | 4 |
| F2.3 personalizationScore + cosine | 3 |
| F2.4 facet-level negative | 3 |
| F2.5 price tier boost | 1 |
| F2.6 anti-bubble (no code — existing mechanisms) | 0 |
| F2.7 Steck [gated, later] | 0 now |
| **Total** | **~12ч** |

---

## Контракт выхода

**Phase F2 выдаёт:**
1. `user_taste_profile` — вектор вкуса с IDF-weighted facet weights
2. `personalizationScore` в scoring — cosine(profile, venue), ramp 0→0.20
3. Facet-level negative с порогом ≥2, IDF-weighted, floor -0.5
4. Price gaussian boost (β≤0.08)
5. Pipeline order: base → personal → price → discount → dither → epsilon

**Phase F3 использует:**
- facet_weights для "скрутируемый профиль" (UI показывает "вам нравится: X, Y")
- signal_count для решения показывать ли уточняющую карточку
- personalizationScore для строки "почему" ("ваш вайб: X")
