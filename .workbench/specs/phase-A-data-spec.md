# Phase A — Data Foundation: Детальная имплементационная спека

*Предусловие фасетной персонализации. Без этих данных F1-F4 не работают.*
*Связь: выходные данные Phase A → входные данные Phase F1 (impression_agg использует venue_id), Phase F2 (facet_* поля для cosine scoring)*

---

## Зависимости и порядок

```
A6 (price_level в mask) ─── можно сразу, одна строка
A9 (Google types → фасеты) ─ можно сразу, скрипт маппинга
  ↓
A1 (osm_id миграция 018) ── блокер синка local→prod
A2 (enriched_at timestamp) ─ блокер F1.2 (isStale), Batch 3 карточек
A5 (atmosphere sync на прод) ─ зависит от A1 (osm_id для синка)
  ↓
A3 (30-day refresh cron) ── зависит от A2
A4 (UI "часы не подтверждены" с isStale) ─ зависит от A2
A7 (budget controls) ─── независимо, в любой момент
  ↓
A8 (Gemini enrichment) ── зависит от A9 (сначала бесплатные данные)
A10 (IDF таблица) ─────── зависит от A8+A9 (нужны заполненные фасеты)
```

**Ворота выхода Phase A:**
- price_tier заполнен ≥70% мест
- facet_cuisine заполнен ≥50% food/drink мест
- facet_atmosphere заполнен ≥30% мест (Gemini)
- atmosphere attributes (dogs, kids, outdoor) на проде > 0
- IDF таблица посчитана
- enriched_at на всех enriched местах

---

## A6. price_level в Enterprise field mask

**Что:** добавить `priceLevel` в field mask Enterprise enrichment запроса.

**Где:** `apps/api/src/app/ingestion/google-enrichment.service.ts`, метод `fetchEnterpriseDetails`.

**Текущий field mask:**
```
'X-Goog-FieldMask': 'regularOpeningHours,rating,userRatingCount'
```

**Новый:**
```
'X-Goog-FieldMask': 'regularOpeningHours,rating,userRatingCount,priceLevel'
```

**Запись:** в `applyEnterpriseDetails`:
```ts
if (details.priceLevel != null) {
  // Google: PRICE_LEVEL_FREE=0, INEXPENSIVE=1, MODERATE=2, EXPENSIVE=3, VERY_EXPENSIVE=4
  place.priceLevel = details.priceLevel;  // нужно добавить поле в entity
}
```

**Entity change:** `apps/api/src/app/database/entities/place.entity.ts`:
```ts
@Column({ type: 'smallint', nullable: true, name: 'price_level' })
priceLevel?: number;
```

**Миграция:** можно в одной миграции с A1 (osm_id) или отдельно. SQL:
```sql
ALTER TABLE places ADD COLUMN price_level smallint;
```

**Стоимость:** $0 дополнительно — поле уже в Enterprise tier, просто не запрашивалось.

**Трудозатраты:** 1ч (field mask + entity + migration + test locally).

**Выход → Phase F2:** `price_level` маппится в `facet_price_tier` через A9.

---

## A9. Маппинг Google types → фасеты

**Что:** скрипт/функция которая заполняет `facet_cuisine`, `facet_format` из существующего `google_types[]`.

**Когда:** ПЕРЕД Gemini (A8). Бесплатно, используем данные которые уже есть.

**Где:** новый файл `apps/api/src/app/ingestion/facet-mapper.service.ts` + endpoint `POST /v1/admin/ingestion/map-facets`.

### Маппинг cuisine

```ts
const CUISINE_MAP: Record<string, string> = {
  'eastern_european_restaurant': 'georgian',  // в Тбилиси = грузинская
  'pizza_restaurant': 'pizza',
  'asian_restaurant': 'asian',
  'american_restaurant': 'american',
  'italian_restaurant': 'italian',
  'halal_restaurant': 'halal',
  'middle_eastern_restaurant': 'middle_eastern',
  'indian_restaurant': 'indian',
  'japanese_restaurant': 'japanese',
  'thai_restaurant': 'thai',
  'chinese_restaurant': 'chinese',
  'turkish_restaurant': 'turkish',
  'korean_restaurant': 'korean',
  'mexican_restaurant': 'mexican',
  'french_restaurant': 'french',
  'mediterranean_restaurant': 'mediterranean',
  'seafood_restaurant': 'seafood',
  'vegetarian_restaurant': 'vegetarian',
  'vegan_restaurant': 'vegan',
  'sushi_restaurant': 'sushi',
  'steak_house': 'steak',
  'falafel_restaurant': 'falafel',
  'shawarma_restaurant': 'shawarma',
  'kebab_shop': 'kebab',
  'dumpling_restaurant': 'dumplings',
  'barbecue_restaurant': 'bbq',
  'greek_restaurant': 'greek',
  'persian_restaurant': 'persian',
  'lebanese_restaurant': 'lebanese',
  'ukrainian_restaurant': 'ukrainian',
  'russian_restaurant': 'russian',
  'vietnamese_restaurant': 'vietnamese',
  'african_restaurant': 'african',
  'spanish_restaurant': 'spanish',
  'indonesian_restaurant': 'indonesian',
  'asian_fusion_restaurant': 'asian_fusion',
  'fusion_restaurant': 'fusion',
  'hamburger_restaurant': 'burgers',
  'gyro_restaurant': 'gyro',
  'taco_restaurant': 'tacos',
  'burrito_restaurant': 'burritos',
  'hot_dog_restaurant': 'hot_dogs',
  'hot_pot_restaurant': 'hot_pot',
  'chicken_restaurant': 'chicken',
  'soup_restaurant': 'soup',
};
```

### Маппинг format

```ts
const FORMAT_MAP: Record<string, string> = {
  'fine_dining_restaurant': 'fine_dining',
  'fast_food_restaurant': 'fast_food',
  'family_restaurant': 'family',
  'breakfast_restaurant': 'breakfast',
  'brunch_restaurant': 'brunch',
  'buffet_restaurant': 'buffet',
  'bistro': 'bistro',
  'gastropub': 'gastropub',
  'diner': 'diner',
  'cafeteria': 'cafeteria',
  'food_court': 'food_court',
  'cafe': 'cafe',
  'coffee_shop': 'coffee_shop',
  'tea_house': 'tea_house',
  'bakery': 'bakery',
  'bar': 'bar',
  'pub': 'pub',
  'wine_bar': 'wine_bar',
  'cocktail_bar': 'cocktail_bar',
  'sports_bar': 'sports_bar',
  'hookah_bar': 'hookah',
  'lounge_bar': 'lounge',
  'beer_garden': 'beer_garden',
  'brewery': 'brewery',
  'winery': 'winery',
  'irish_pub': 'irish_pub',
  'bar_and_grill': 'bar_and_grill',
  'night_club': 'club',
  'karaoke': 'karaoke',
  'dessert_shop': 'dessert',
  'dessert_restaurant': 'dessert',
  'ice_cream_shop': 'ice_cream',
  'donut_shop': 'donut',
  'pastry_shop': 'pastry',
  'cake_shop': 'cake',
  'candy_store': 'candy',
  'chocolate_shop': 'chocolate',
  'sandwich_shop': 'sandwich',
  'snack_bar': 'snack',
  'coffee_roastery': 'coffee_roastery',
  'internet_cafe': 'internet_cafe',
};
```

### Маппинг price_tier (из price_level)

```ts
function mapPriceTier(priceLevel: number | null): { tier: number; conf: number } {
  if (priceLevel == null) return { tier: 3, conf: 0.3 };  // average, low confidence
  // Google: 0=free, 1=inexpensive, 2=moderate, 3=expensive, 4=very_expensive
  return { tier: priceLevel + 1, conf: 0.9 };  // 1-5 scale, high confidence
}
```

### Логика маппинга

```ts
async mapFacets(): Promise<{ mapped: number; skipped: number }> {
  const places = await this.placeRepo.find({ relations: { venue: true } });
  let mapped = 0, skipped = 0;

  for (const place of places) {
    const types: string[] = place.googleTypes ?? [];
    if (types.length === 0) { skipped++; continue; }

    // Cuisine
    const cuisines = types
      .map(t => CUISINE_MAP[t])
      .filter(Boolean);
    if (cuisines.length > 0) place.facetCuisine = [...new Set(cuisines)];

    // Format
    const formats = types
      .map(t => FORMAT_MAP[t])
      .filter(Boolean);
    if (formats.length > 0) place.facetFormat = [...new Set(formats)];

    // Price tier
    if (place.priceLevel != null) {
      const { tier, conf } = mapPriceTier(place.priceLevel);
      place.facetPriceTier = tier;
      place.facetPriceConf = conf;
    }

    await this.placeRepo.save(place);
    mapped++;
  }

  return { mapped, skipped };
}
```

**НЕ заполняет:** `facet_atmosphere`, `facet_occasion` — эти заполняет Gemini (A8).

**Трудозатраты:** 4ч (маппинг таблицы + service + endpoint + entity fields + migration + run).

**Выход → A8:** Gemini enrichment НЕ перезаписывает cuisine/format если уже заполнены маппингом. Gemini заполняет только atmosphere, occasion, и gaps.

---

## A1. osm_id миграция (018)

**Что:** стабильный внешний ключ для синхронизации local↔prod.

**Миграция SQL:**
```sql
ALTER TABLE venues ADD COLUMN osm_id BIGINT;
ALTER TABLE venues ADD COLUMN osm_type VARCHAR(8);  -- 'node' | 'way' | 'relation'

CREATE UNIQUE INDEX idx_venues_osm ON venues (osm_type, osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venues_coords ON venues (lat, lng);
```

**Entity:** `apps/api/src/app/database/entities/venue.entity.ts`:
```ts
@Column({ type: 'bigint', nullable: true, name: 'osm_id' })
osmId: string | null;  // bigint → string в TypeORM

@Column({ type: 'varchar', length: 8, nullable: true, name: 'osm_type' })
osmType: 'node' | 'way' | 'relation' | null;
```

**Импортер:** `osm-import.service.ts` — при парсинге Overpass элемента добавить:
```ts
venue.osmId = String(element.id);
venue.osmType = element.type;
```

**Бэкфилл:** `tools/backfill-osm-id.ts`:
1. Прочитать OSM датасет (тот же что использовался для импорта)
2. Для каждого элемента → найти venue по `ABS(lat - $1) < 0.0000001 AND ABS(lng - $2) < 0.0000001`
3. При коллизиях координат → добавить name match
4. UPDATE venues SET osm_id, osm_type WHERE id = ?

**Верификация:** хэши osm_id должны совпасть local vs prod.

**После бэкфилла:** переписать `import-enrichment` endpoint на osm_id вместо координат.

**Трудозатраты:** 3-4ч.

**Выход → A5:** osm_id позволяет надёжный синк atmosphere данных local→prod.

---

## A2. enriched_at timestamp

**Что:** когда venue последний раз обогащён Google данными. Для 30-day TTL и isStale().

**Миграция (в той же 018 или отдельная):**
```sql
ALTER TABLE places ADD COLUMN enriched_at TIMESTAMPTZ;
```

**Запись:** в `google-enrichment.service.ts`, после каждого enrichment (Pro, Enterprise, Atmosphere):
```ts
place.enrichedAt = new Date();
```

**Бэкфилл:** для уже обогащённых мест:
```sql
UPDATE places SET enriched_at = NOW() WHERE google_rating IS NOT NULL AND enriched_at IS NULL;
```

**Использование:**
```ts
function isStale(enrichedAt: Date | null): boolean {
  if (!enrichedAt) return true;
  return (Date.now() - enrichedAt.getTime()) > 30 * 24 * 60 * 60 * 1000;
}
```

**Трудозатраты:** 1ч.

**Выход → A3:** refresh cron использует enriched_at для выбора stale мест.
**Выход → F1.2:** isStale() для "часы не подтверждены" с проверкой свежести (сейчас только null check).

---

## A5. Atmosphere sync на прод

**Что:** перенести allowsDogs, goodForChildren, outdoorSeating, liveMusic с локальной БД на прод.

**Зависит от:** A1 (osm_id для надёжного синка).

**Подход:** переписать `import-enrichment` endpoint на osm_id, затем:
```bash
# Экспорт локально
node -e "... SELECT osm_id, osm_type, attributes FROM ..."

# POST на прод
node -e "... fetch('/v1/admin/ingestion/import-enrichment', ...)"
```

**Или:** после A1 запустить Atmosphere enrichment прямо на проде (locationRestriction уже работает):
```
POST /v1/admin/ingestion/google-enrich-atmosphere?limit=200
```

**Предпочтительно:** sync из локальной (уже оплачено, 524 allowsDogs + 1210 goodForChildren). Atmosphere enrichment на проде — только для новых/не покрытых.

**Трудозатраты:** 2ч (после A1 готов).

**Выход → scoring:** pet modifier использует реальный allowsDogs вместо tag proxy.
**Выход → F2:** facet_atmosphere может включать Google boolean attributes.

---

## A3. 30-day refresh cron

**Что:** ежемесячное обновление волатильных Google данных (rating, hours, businessStatus).

**Зависит от:** A2 (enriched_at для выбора stale).

**Логика:**
```ts
@Cron('0 3 * * 0')  // воскресенье 03:00 UTC = 07:00 Tbilisi
async weeklyRefresh() {
  // Найти stale места (enriched_at > 30 дней)
  const stale = await this.placeRepo
    .createQueryBuilder('p')
    .innerJoin('p.venue', 'v')
    .where('v.googlePlaceId IS NOT NULL')
    .andWhere("p.enrichedAt < NOW() - INTERVAL '30 days'")
    .orderBy('p.enrichedAt', 'ASC')
    .take(200)  // батч
    .getMany();

  // Re-fetch Enterprise details по существующему googlePlaceId
  // Place Details (не Text Search) — $20/1K vs $35/1K
  for (const place of stale) {
    const details = await this.fetchEnterpriseDetails(place.venue.googlePlaceId, apiKey);
    if (details) {
      this.applyEnterpriseDetails(place.venue.id, details);
      place.enrichedAt = new Date();
      await this.placeRepo.save(place);
    }
  }
}
```

**Budget:** ~200 мест/неделю × $20/1K = ~$4/месяц. В рамках бюджета.

**Трудозатраты:** 2-3ч.

---

## A4. UI "часы не подтверждены" с isStale

**Что:** расширить текущий null check до проверки свежести.

**Зависит от:** A2 (enriched_at).

**Бек:** добавить `openingHoursFetchedAt` в response карточки:
```ts
// В recommendation service, при построении карточки:
openingHoursFetchedAt: c.enriched_at?.toISOString() ?? null,
```

**Фронт:** уже есть "Часы не подтверждены" при null. Расширить:
```ts
// В result-card statusTone():
if (!card.openStatus && !card.openingHoursFetchedAt) return 'muted';  // нет данных
// + если есть openStatus но stale:
if (card.openingHoursFetchedAt && isStale(card.openingHoursFetchedAt)) return 'muted';
```

**Трудозатраты:** 1ч.

---

## A7. Google Cloud budget controls

**Что:** защита от случайного перерасхода.

**Действия:**
1. Google Cloud Console → Billing → Budgets & alerts → создать бюджет $50/month
2. Alert при 50%, 80%, 100%
3. Для hard cap: Cloud Functions billing disable (или просто alert + ручная реакция на MVP)

**Трудозатраты:** 30мин.

---

## A8. Gemini обогащение фасетов

**Что:** заполнить facet_atmosphere, facet_occasion, и gaps в cuisine/format/price через Gemini Flash-Lite.

**Зависит от:** A9 (сначала бесплатные данные, Gemini только для gaps).

### Prompt template

```
You are a venue classifier for a Tbilisi leisure discovery app.

TAXONOMY (use ONLY these values):

atmosphere (pick 1-4): cozy, lively, romantic, quiet, trendy, traditional, outdoorsy, family_friendly, work_friendly, date_worthy, group_friendly, upscale, casual, cultural, scenic, live_music, instagram_worthy

occasion (pick 1-3): date, family_outing, solo, work, friends, celebration, quick_stop, exploring

price_tier (1-5): 1=cheap, 2=below_average, 3=average, 4=above_average, 5=high

venue_role: meal | activity | shopping | drink | sight
anchor_vs_filler: anchor | filler
typical_duration_min: estimated visit duration in minutes (30, 60, 90, 120, 180)
time_of_day_fit: array from [morning, midday, afternoon, evening, late]

RULES:
- If data is insufficient to determine a field, output "unknown". Do NOT guess.
- Do NOT override existing cuisine/format if provided.
- Georgian names: interpret in context of Tbilisi venues.
- Output valid JSON only.

VENUE DATA:
name: {name}
name_en: {name_en}
category: {category}
google_types: {google_types}
existing_cuisine: {facet_cuisine or "none"}
existing_format: {facet_format or "none"}
existing_price_tier: {facet_price_tier or "none"}
rating: {google_rating}
rating_count: {google_rating_count}
attributes: {attributes JSON}
tags: {tags}

OUTPUT JSON:
```

### Output schema (structured output)

```json
{
  "atmosphere": ["cozy", "romantic"],
  "occasion": ["date"],
  "price_tier": 4,
  "price_tier_confidence": 0.7,
  "cuisine": "unknown",
  "format": "unknown",
  "venue_role": "meal",
  "anchor_vs_filler": "anchor",
  "typical_duration_min": 90,
  "time_of_day_fit": ["evening", "late"]
}
```

### Запись в БД

```ts
// Не перезаписывать существующие маппинг-данные
if (!place.facetCuisine?.length && result.cuisine !== 'unknown') {
  place.facetCuisine = [result.cuisine];
}
if (!place.facetFormat?.length && result.format !== 'unknown') {
  place.facetFormat = [result.format];
}
// Атмосфера и occasion — всегда от Gemini (нет структурного источника)
if (result.atmosphere.length > 0 && result.atmosphere[0] !== 'unknown') {
  place.facetAtmosphere = result.atmosphere;
}
if (result.occasion.length > 0 && result.occasion[0] !== 'unknown') {
  place.facetOccasion = result.occasion;
}
// Price tier — Gemini только если нет Google price_level
if (!place.facetPriceTier && result.price_tier !== 'unknown') {
  place.facetPriceTier = result.price_tier;
  place.facetPriceConf = result.price_tier_confidence;
}
// "Спланируй день" поля — заполняем всегда, используем позже
place.typicalDurationMin = result.typical_duration_min;
place.timeOfDayFit = result.time_of_day_fit;  // stored as smallint bitmask or text[]
place.venueRole = result.venue_role;
place.anchorVsFiller = result.anchor_vs_filler;
```

### Батчинг

- Gemini Batch API: 50% discount, 24h SLA
- Один venue per request (clean reconciliation)
- ~3,168 requests × ~800 tokens = ~$0.23 на Flash-Lite batch
- С retry + slack: ≤$3

### QA

- Спот-чек 100 мест (стратифицированно: rich/sparse/Georgian-only)
- Замерить % unknown по каждому полю
- Cross-check cuisine Gemini vs A9 маппинг (где оба есть)

**Трудозатраты:** 6-8ч (prompt tuning + batch script + QA + entity fields).

---

## A10. IDF таблица

**Что:** Inverse Document Frequency для каждого фасета. Используется в F2 для взвешивания.

**Зависит от:** A8 + A9 (фасеты должны быть заполнены).

**Формула:**
```
idf(f) = log(N_venues / (1 + n_venues_with_f))
```

Где:
- `N_venues` = общее число мест (3,168)
- `n_venues_with_f` = число мест с этим фасетом

**Пример:**
- `georgian` (186 мест): idf = log(3168/187) ≈ 2.83 (низкий — common)
- `fine_dining` (5 мест): idf = log(3168/6) ≈ 6.27 (высокий — rare)
- `romantic` (~50 мест): idf = log(3168/51) ≈ 4.13 (средний)

**Cron:**
```ts
@Cron('0 4 * * *')  // 04:00 UTC daily
async recalculateIdf() {
  const totalVenues = await this.placeRepo.count();

  // Все фасеты по типам
  for (const facetType of ['cuisine', 'format', 'atmosphere', 'occasion']) {
    const column = `facet_${facetType}`;
    const counts = await this.dataSource.query(`
      SELECT val, COUNT(*) as n
      FROM places, unnest(${column}) AS val
      WHERE ${column} IS NOT NULL
      GROUP BY val
    `);

    for (const { val, n } of counts) {
      const idf = Math.log(totalVenues / (1 + Number(n)));
      await this.dataSource.query(`
        INSERT INTO facet_idf (facet_key, idf, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (facet_key) DO UPDATE SET idf = $2, updated_at = NOW()
      `, [`${facetType}:${val}`, idf]);
    }
  }
}
```

**Трудозатраты:** 2ч.

**Выход → F2:** `facet_idf` используется при:
- Обновлении профиля (rare facets весят больше)
- Негатив-атрибуции (не штрафовать low-IDF facets)

---

## Миграция 018 — сводная SQL

Все schema changes Phase A в одной миграции:

```sql
-- A1: osm_id
ALTER TABLE venues ADD COLUMN IF NOT EXISTS osm_id BIGINT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS osm_type VARCHAR(8);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_osm ON venues (osm_type, osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venues_coords ON venues (lat, lng);

-- A2: enriched_at
ALTER TABLE places ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- A6: price_level
ALTER TABLE places ADD COLUMN IF NOT EXISTS price_level SMALLINT;

-- A9/A8: facets
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_cuisine TEXT[];
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_format TEXT[];
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_price_tier SMALLINT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_price_conf REAL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_atmosphere TEXT[];
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_occasion TEXT[];

-- A8: "Спланируй день" schema (заполнять, логику отложить)
ALTER TABLE places ADD COLUMN IF NOT EXISTS typical_duration_min SMALLINT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS time_of_day_fit TEXT[];
ALTER TABLE places ADD COLUMN IF NOT EXISTS venue_role TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS anchor_vs_filler TEXT;

-- A10: IDF
CREATE TABLE IF NOT EXISTS facet_idf (
  facet_key TEXT PRIMARY KEY,
  idf REAL NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill enriched_at
UPDATE places SET enriched_at = NOW() WHERE google_rating IS NOT NULL AND enriched_at IS NULL;
```

---

## Сводка трудозатрат

| Задача | Часы | Зависит от |
|---|---|---|
| A6 price_level в mask | 1 | — |
| A9 Google types → фасеты | 4 | — |
| A1 osm_id миграция + бэкфилл | 3-4 | — |
| A2 enriched_at | 1 | — |
| A5 atmosphere sync | 2 | A1 |
| A3 refresh cron | 2-3 | A2 |
| A4 UI isStale | 1 | A2 |
| A7 budget controls | 0.5 | — |
| A8 Gemini enrichment | 6-8 | A9 |
| A10 IDF таблица | 2 | A8+A9 |
| **Total** | **~23-27ч** | |

---

## Контракт выхода (что получает Phase F1/F2)

Phase A выдаёт:
1. **Каждое место** имеет `facet_cuisine[]`, `facet_format[]`, `facet_price_tier`, `facet_atmosphere[]`, `facet_occasion[]`
2. **facet_idf** таблица с IDF для каждого уникального фасета
3. **enriched_at** timestamp для isStale() проверки
4. **price_level** из Google (где есть)
5. **atmosphere attributes** на проде (allowsDogs, goodForChildren, etc.)
6. **osm_id** на venues для стабильного синка

Phase F1 использует: venue_id (уже есть), enriched_at (для isStale)
Phase F2 использует: facet_* поля + facet_idf для cosine scoring и IDF-weighted profile updates
