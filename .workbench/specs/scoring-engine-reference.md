# LaziGo Scoring Engine — Полная документация

*Как система решает что показать пользователю. Все формулы, шаги, модификаторы.*

---

## Обзор pipeline

```
Запрос пользователя (lat, lng, radius, interests, company, hasPet, timeWindow)
  │
  ▼
1. FETCH — загрузка кандидатов (places + events) из БД по bbox
  │
  ▼
2. HARD FILTER — отсечение (hidden, budget, closed)
  │
  ▼
3. SCORE — расчёт score для каждого кандидата
  │
  ▼
4. INTEREST FILTER — отсечение по интересам (strict/soft)
  │
  ▼
5. AVAILABILITY FILTER — отсечение закрытых мест
  │
  ▼
6. ADAPTIVE RADIUS — если < 5 результатов → расширить radius × 1.5 → повторить 1-5
  │
  ▼
7. SORT — по score desc
  │
  ▼
8. DAILY ROTATION — date-seeded shuffle для |Δscore| < 0.05, top-3 стабильны
  │
  ▼
9. DIVERSITY — chain dedup, category streak limit
  │
  ▼
10. NIGHT FALLBACK — если ночь и < 5 результатов → завтрашнее окно
  │
  ▼
11. BUILD CARDS — top 60 → response
```

---

## Шаг 1: FETCH

### Places (venues + places JOIN)

```sql
SELECT p.*, v.lat, v.lng, v.name, v.address, v.google_place_id,
  (Haversine distance) AS distance_m
FROM places p
JOIN venues v ON p.venue_id = v.id
WHERE p.status = 'active'
  AND v.lat BETWEEN $lat - (radius/111000) AND $lat + (radius/111000)
  AND v.lng BETWEEN $lng - (radius/cos_lat) AND $lng + (radius/cos_lat)
ORDER BY distance_m
LIMIT 500 (or 1000 for expanded radius)
```

Haversine distance (метры):
```
d = 6371000 × acos(
  cos(rad(lat₁)) × cos(rad(lat₂)) × cos(rad(lng₂) - rad(lng₁))
  + sin(rad(lat₁)) × sin(rad(lat₂))
)
```

Bbox pre-filter на indexed lat/lng (дешёвый, без PostGIS).

### Events

```sql
SELECT e.*, v.lat, v.lng, v.name AS venue_name
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
WHERE e.status = 'scheduled'
  AND e.starts_at BETWEEN $from AND $to
ORDER BY distance_m ASC NULLS LAST, e.starts_at ASC
LIMIT 150
```

Events без venue → `distance_m = NULL` → включены в выдачу всегда.

---

## Шаг 2: HARD FILTER

```
Отсечь если:
  - id в hiddenIds (пользователь скрыл)
  - price_min > budgetMax (слишком дорого)
  - price_level > budgetToLevel(budgetMax)
```

`budgetToLevel` маппинг:
| budgetMax | level |
|---|---|
| ≤ 10 | 1 |
| ≤ 30 | 2 |
| ≤ 60 | 3 |
| > 60 | 4 |

---

## Шаг 3: SCORE — главная формула

### 3.1 Финальный score

```
score = 0.45 × interestScore
      + 0.25 × distanceScore
      + 0.15 × timeScore
      + 0.10 × qualityScore
      + 0.05 × sourceScore
```

Если `is_chain && type === 'place'`:
```
score = score × 0.85   (chain penalty)
```

Диапазон score: 0.0 — ~0.55 (теоретический максимум при всех компонентах = 1.0).

---

### 3.2 Interest Score (вес 0.45)

**Входные данные:** теги venue `tags[]` + пользовательские интересы `interests: Record<string, number>`.

**Шаг A: Расширение интересов через синонимы**

Пользователь отправляет `{ nature: 0.8, food: 0.5 }`. Система расширяет:
```
nature: 0.8 → outdoor: 0.8, park: 0.8, garden: 0.8, viewpoint: 0.8
food: 0.5   → food: 0.5, restaurant: 0.5, cafe: 0.5, bakery: 0.5
```

Синонимы (INTEREST_SYNONYMS):
| Интерес | Теги |
|---|---|
| nature | outdoor, park, garden, viewpoint |
| food | food, restaurant, cafe, bakery |
| nightlife | nightlife, bar, club, concert |
| culture | culture, museum, gallery, theater |
| entertainment | entertainment, cinema, club, bowling, escape_room, gaming, arcade, water_park, music, concert, festival |
| family | family, playground, park, trampoline, water_park, arcade |
| active | sports, climbing, karting, paintball, trampoline, gym, bowling, escape_room, gaming, arcade, water_park |
| gym | gym, wellness, sports |
| spa | bath, swimming |
| sports | sports, climbing, karting, paintball, trampoline, bowling |
| shopping | shopping, mall |

**Пороги весов:**
- `< 0.3` → интерес ИГНОРИРУЕТСЯ (нейтральный)
- `0.3 — 0.69` → soft boost (scoring, но не фильтрация)
- `≥ 0.7` → STRICT (venue ДОЛЖЕН содержать хотя бы один strict тег)

**Шаг B: Классификация тегов venue**

Каждый тег venue проверяется по расширенным весам:
- Тег совпал → `primaryTag` (матч интересу), его вес добавляется в matchScores
- Тег не совпал → `secondaryTag` (доп. характеристика)

**Шаг C: Расчёт interestScore**

```
Если интересов нет → interestScore = 0.5 (нейтральный)
Если совпадений нет → interestScore = 0.0
Если 1 совпадение  → interestScore = matchScores[0]
Если 2+ совпадения → interestScore = avg(top2 matchScores)
```

**Шаг D: Модификатор компании**

Применяется ПОСЛЕ базового interestScore:

| Компания | Буст теги | Штраф теги |
|---|---|---|
| solo | — | — |
| couple | viewpoint, restaurant, cafe, bar, park, garden, attraction | playground, family |
| family | park, playground, family, museum, swimming, outdoor | nightlife, bar, club |
| friends | bar, restaurant, nightlife, club, entertainment, sports | — |

**С Google атрибутами (family + goodForChildren):**
```
goodForChildren === true  → interestScore × 1.3 (cap 1.0), companyFit = 'boosted'
goodForChildren === false → interestScore × 0.3, companyFit = 'penalized'
```

**Без Google (tag fallback):**
```
hasPenaltyTag → interestScore × 0.3
hasBoostedTag → interestScore × 1.3 (cap 1.0)
```

Если оба — penalty доминирует.

**Шаг E: Модификатор питомца (hasPet)**

Применяется ПОСЛЕ модификатора компании, мультипликативно:

| Условие | Множитель |
|---|---|
| `allowsDogs === true` (Google) | × 1.5 |
| `allowsDogs === false` И нет террасы | × 0.1 |
| `allowsDogs === false` НО есть `outdoorSeating` | × 0.7 |
| Нет Google данных, есть outdoor/park тег | × 1.3 |
| Нет Google данных, есть museum/cinema тег | × 0.3 |

---

### 3.3 Distance Score (вес 0.25)

```
Если venue не привязан (distance_m = null):
  distanceScore = 0.5 (нейтральный, типично для events)

Иначе:
  distanceScore = max(0, 1 - distance_m / radiusM)
```

Линейная убывающая функция. На границе радиуса = 0.

Примеры при radiusM = 5000:
| Расстояние | Score |
|---|---|
| 0 м | 1.0 |
| 500 м | 0.9 |
| 1 км | 0.8 |
| 2.5 км | 0.5 |
| 5 км | 0.0 |

---

### 3.4 Time Score (вес 0.15)

**Для events:**
```
start ≤ середина timeWindow → 1.0 (начинается скоро)
start ≤ конец timeWindow   → 0.7 (позже)
start > конец timeWindow   → 0.3 (за пределами)
```

**Для places с opening_hours:**
```
closed  → 0.0 (отфильтруется на шаге 5)
open    → 1.0
open + 24/7 + ночь (23:00-06:00 Tbilisi) → 1.05 (ночной буст)
```

**Без opening_hours:**
```
unknown → 0.8 (мягкий neutral, не штраф)
```

---

### 3.5 Quality Score (вес 0.10)

```
qualityScore = place.quality_score || 0.5
```

Устанавливается при создании venue. По умолчанию 0.7 для events, 0.5 для places.

---

### 3.6 Source Score (вес 0.05)

```
sourceScore = 0.6 (константа для всех)
```

Зарезервировано для будущего: доверие к источнику данных (Google > OSM > user-submitted).

---

## Шаг 4: Interest Hard Filter

```
Если есть strict интересы (weight ≥ 0.7):
  → venue ДОЛЖЕН содержать хотя бы один strict тег → иначе ОТСЕЧЁН

Если только soft интересы (все < 0.7):
  → venue должен иметь хотя бы один primaryTag → иначе ОТСЕЧЁН

Если интересов нет:
  → фильтрация НЕ применяется
```

---

## Шаг 5: Availability Filter

```
Для places:
  checkOpenStatus(opening_hours, timeWindow.mid) === 'closed' → ОТСЕЧЁН
  'open' или 'unknown' → оставить

Для events:
  всегда оставить (у них своё time window в шаге 1)
```

---

## Шаг 6: Adaptive Radius

```
Если scored.length < 5 И есть интересы:
  radiusM = radiusM × 1.5
  повторить шаги 1-5
  максимум 2 расширения
```

---

## Шаг 7: Sort

```
scored.sort((a, b) => b.score - a.score)
```

---

## Шаг 8: Daily Rotation

```
Цель: "одна и та же лента каждый день = приложение мёртво"

seed = hash(YYYY-MM-DD)
Для позиций 3+ (top-3 не трогаем):
  если |score[i] - score[i+1]| < 0.05:
    if hash(seed + id) % 3 === 0:
      swap(i, i+1)
```

Детерминированный по дате — один и тот же порядок весь день. Новый день = новый порядок для tie-breaking.

---

## Шаг 9: Diversity Filter

```
Для places:
  Если 2 предыдущих в результате имеют ту же категорию → skip
  (предотвращает 3 музея подряд)

Для chains:
  Максимум 1 venue с одним chain_key в top-20
  (предотвращает 3 Dunkin' Donuts)

Events НЕ фильтруются по category streak
  (каждый event уникален по определению)
```

---

## Шаг 10: Night Fallback

```
Если:
  Tbilisi hour 21:00-06:00
  И diversified.length < 5
  И НЕ forcedNow

→ Перезапустить pipeline с завтрашним timeWindow (08:00-23:00 Tbilisi)
→ Добавить meta.fallback = 'tomorrow' или 'exhausted'
```

---

## Шаг 11: Build Cards (response)

Берём top-60 из diversified. Для каждого:

```
{
  id, type, title (locale-aware), category,
  lat, lng,
  distanceM: null если venue не привязан,
  walkMinutes: null если venue не привязан,
  explanations: generateExplanations() (max 3),
  openStatus: getOpenLabel() или undefined,
  rating, ratingCount, primaryTags, secondaryTags,
  startsAt, endsAt, venueName, ticketUrl, priceLabel,
  googlePlaceId, isChain, photoUrl
}
```

Walk time: `Math.round((distance_m / 80) × 1.3)` (80 м/мин × коэфф. извилистости улиц).

---

## Explanations (чипы "почему это")

Генерируются с приоритетами, max 3:

| Приоритет | Тип | Условие | Пример |
|---|---|---|---|
| 1 | `starts_in` | Event, старт < 120 мин | "Начало через 37 мин" |
| 2 | `walk_time` | distance > 0 И ≤ 2000м | "11 мин пешком" |
| 3 | `free` | price_level=0 или price_min=0 | "Бесплатно" |
| 3 | `budget_fit` | price_min ≤ budgetMax | "В бюджете" |
| 4 | `matches_interest` | primaryTags совпали | "Тебе нравится: природа" |
| 4 | `company_fit` | companyFit = 'boosted' | "Подходит для пары" |
| 4 | `pet_friendly` | hasPet + (allowsDogs или outdoor тег) | "Можно с питомцем" |
| 5 | `highly_rated` | google_rating ≥ 4.5 | "Высокий рейтинг" |
| 6 | `also_has` | secondaryTags содержит food/cafe/bar/bath | "Также: бар" (переведённый) |

---

## "Реши за меня" — клиентский ре-ранкер

Работает поверх уже отскоренной ленты (cards[]). Без серверных вызовов.

```
1. Pool: top 25% eligible (не показанных ранее) cards
2. Effective score: position-based (1.0 для первого, убывает)
3. Session penalties:
   - Каждый показ: effScore × 0.6
   - Скипнутая категория: effScore × 0.85
4. Event quota: ≥1 event в 3 picks если events есть
5. MMR re-rank (λ=0.6):
   - venueSim(a,b) = 0.5×(same category) + 0.2×(same type) + 0.3×(same distanceBand)
   - distanceBand = floor(distanceM / 500)
6. Seeded pick: mulberry32(hash(timestamp + attempt)) из top-4 MMR
7. Max 3 attempts
```

---

## Примеры расчёта

### Пример 1: Ресторан, близко, интерес food

```
Venue: "Cafe Littera", tags: [food, restaurant, cafe], distance: 300m
User: interests = { food: 1.0 }, company = couple, hasPet = false
Radius: 5000m

interestScore:
  food→[food,restaurant,cafe,bakery], weight 1.0
  Venue tags match: food(1.0), restaurant(1.0), cafe(1.0) → top2 avg = 1.0
  Company couple: boost restaurant, cafe → × 1.3 = 1.3 → cap 1.0
  Pet: нет
  interestScore = 1.0

distanceScore = 1 - 300/5000 = 0.94

timeScore = 1.0 (open)

qualityScore = 0.5

sourceScore = 0.6

score = 0.45×1.0 + 0.25×0.94 + 0.15×1.0 + 0.10×0.5 + 0.05×0.6
      = 0.45 + 0.235 + 0.15 + 0.05 + 0.03
      = 0.915 × 1.0 (not chain)
      = 0.915
```

### Пример 2: Музей, далеко, интерес nature

```
Venue: "National Museum", tags: [culture, museum], distance: 4000m
User: interests = { nature: 0.8 }, company = solo

interestScore:
  nature→[outdoor, park, garden, viewpoint], weight 0.8
  Venue tags: culture, museum — ни один не в синонимах nature
  matchScores = [] → interestScore = 0.0

  Strict filter: nature weight 0.8 ≥ 0.7 → venue ДОЛЖЕН иметь strict тег
  museum не в nature synonyms → ОТСЕЧЁН на шаге 4

  (venue не попадёт в выдачу)
```

### Пример 3: Бар с собакой, ночь

```
Venue: "El Depo", tags: [bar, nightlife, food], distance: 700m
User: interests = { nightlife: 0.9 }, hasPet = true, time: 23:30
Attributes: { allowsDogs: true, outdoorSeating: true }

interestScore:
  nightlife→[nightlife, bar, club, concert], weight 0.9
  Match: bar(0.9), nightlife(0.9) → top2 avg = 0.9
  Pet: allowsDogs=true → × 1.5 = 1.35 → cap 1.0
  interestScore = 1.0

distanceScore = 1 - 700/5000 = 0.86

timeScore = 1.0 (open) — если 24/7: 1.05

qualityScore = 0.5

score = 0.45×1.0 + 0.25×0.86 + 0.15×1.05 + 0.10×0.5 + 0.05×0.6
      = 0.45 + 0.215 + 0.1575 + 0.05 + 0.03
      = 0.9025
```

---

## Константы (summary)

| Константа | Значение | Где |
|---|---|---|
| WEIGHTS.interestMatch | 0.45 | score formula |
| WEIGHTS.distanceDecay | 0.25 | score formula |
| WEIGHTS.timeFit | 0.15 | score formula |
| WEIGHTS.cardQuality | 0.10 | score formula |
| WEIGHTS.sourceConfidence | 0.05 | score formula |
| CHAIN_SCORE_MULTIPLIER | 0.85 | chain penalty |
| STRICT_INTEREST_THRESHOLD | 0.7 | interest hard filter |
| MIN_INTEREST_THRESHOLD | 0.3 | ignore below |
| MIN_RELEVANT_RESULTS | 5 | adaptive radius trigger |
| MAX_RADIUS_EXPANSIONS | 2 | adaptive radius limit |
| WALK_SPEED_M_PER_MIN | 80 | walk time calc |
| STREET_CURVE_FACTOR | 1.3 | walk time calc |
| Daily rotation tie band | 0.05 | rotation threshold |
| Category streak limit | 3 | diversity filter |
| Chain limit in top-20 | 1 per chain_key | diversity filter |
| MMR λ (decide) | 0.6 | decide-for-me |
| Impression decay (decide) | 0.6 | decide-for-me |
| Category skip penalty (decide) | 0.85 | decide-for-me |
| Distance band (decide) | 500m | decide-for-me |
