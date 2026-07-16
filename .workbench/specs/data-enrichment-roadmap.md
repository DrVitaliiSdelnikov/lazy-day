# Data Enrichment Roadmap

*На основе deep research (2026-07-16). Разделено на две фазы: стабилизация → расширение.*

## Phase A: Стабилизация текущего (Google + OSM)

Цель: довести то что есть до production-grade качества. Без новых источников.

### A1. osm_id миграция (018) — ~3-4ч
- Добавить `osm_id BIGINT` + `osm_type VARCHAR(8)` на venues
- Unique index `(osm_type, osm_id)`
- Обновить OSM importer: сохранять osm_id при импорте
- Backfill существующих venues из OSM данных
- Переписать `import-enrichment` endpoint на osm_id
- Sync оставшихся ~500 мест local→prod
- Удалить временный coord-based endpoint

### A2. `fetched_at` на Google поля — ~1ч
- Добавить `enriched_at TIMESTAMPTZ` на places таблицу
- Записывать timestamp при каждом enrichment (Pro, Enterprise, Atmosphere)
- Нужен для 30-day TTL compliance и "hours unknown" policy

### A3. 30-day refresh cron — ~2-3ч
- Cron job: найти places где `enriched_at < NOW() - 30 days`
- Re-fetch Enterprise данные (rating, hours) по существующему google_place_id
- Place Details (не Text Search) — дешевле: $20/1K vs $35/1K
- Free place_id refresh (ID-only) раз в 12 месяцев
- Budget: ~$20-30/мес для 1 города при monthly refresh

### A4. "Часы неизвестны" UI policy — ~1ч
- Если `opening_hours` IS NULL → "Уточните у заведения"
- Если `enriched_at` старше 30 дней → тоже "Уточните"
- Не показывать стухшие часы как текущие
- Subtle "обновлено {дата}" индикатор

### A5. Atmosphere enrichment на проде — ~30мин
- `POST /v1/admin/ingestion/google-enrich-atmosphere?limit=200`
- allowsDogs, goodForChildren, outdoorSeating, servesVegetarianFood
- Зависит от A1 (sync даст больше google_place_id на проде)

### A6. Field mask audit — ~30мин
- Проверить что каждый Google API вызов запрашивает МИНИМУМ полей
- Каждое лишнее поле может поднять tier (Pro→Enterprise→Atmosphere)
- Text Search: только `id, displayName, location` (Pro tier)
- Enterprise Details: только нужные поля, не wildcard

### A7. Google Cloud budget controls — ~30мин
- Установить monthly budget alert в Google Cloud Console
- Hard cap: billing disable function при превышении
- Мониторинг: SKU breakdown в Billing → Reports

### Порядок A-фазы:
```
A1 (osm_id) → A5 (atmosphere, после sync) → A2 (fetched_at) → A3 (refresh cron) → A4 (UI) → A6 (audit) → A7 (budget)
```

Ожидаемый результат:
- 1,755/3,164 мест с рейтингами на проде (55%, как локально)
- 30-day compliance с Google ToS
- "Часы неизвестны" вместо стухших данных
- Budget контроль

---

## Phase B: Расширение источников данных

Цель: повысить coverage и качество за счёт бесплатных и платных источников. **Только после Phase A.**

### B1. Overture Maps Places — бесплатно, ~4-5ч
- 72M+ POI, GeoParquet на S3, monthly releases
- CDLA/Apache license — коммерчески свободно
- DuckDB query по Tbilisi bbox → reconciliation
- **GERS ID** — стабильный глобальный ID, идеален для cross-provider matching
- `confidence` score (0-1) — фильтровать < 0.75
- `operating_status` — пока placeholder, не полагаться для closure detection
- Роль: conflation backbone, gap detection, closure signals

### B2. Foursquare OS Places — бесплатно, ~3-4ч
- 106M+ POI, Apache 2.0
- `date_refreshed` / `date_closed` — лучший сигнал закрытия
- Доступ: Places Portal (Iceberg, free token) или Hugging Face
- Роль: closure detection, gap-filling

### B3. OSM улучшение — бесплатно, ~2-3ч
- `check_date:opening_hours` — когда часы последний раз проверялись
- `opening_hours.js` для парсинга OSM-формата часов
- Wikidata QID из `wikidata` / `brand:wikidata` тегов — самый стабильный cross-source ID
- Geofabrik `georgia-latest.osm.pbf` — daily updates
- Роль: reconciliation, hours cross-check, ID broker

### B4. owner_maintenance_score — ~2-3ч
- Proxy: наличие hours + phone + website (Google "owner trio")
- Attribute density (больше заполненных полей = вероятнее claimed)
- OSM `check_date` freshness
- Overture `confidence`
- Использовать как ranking feature в скоринге рекомендаций

### B5. Entity resolution pipeline — ~1-2 недели
- Geohash blocking (без PostGIS)
- Deterministic keys: phone (E.164), website domain, Wikidata QID, GERS ID
- Probabilistic: Jaro-Winkler (name) + Haversine (distance) + category match
- Confidence score per match (0-1)
- Review queue для 0.6-0.85 confidence
- Georgian↔Latin transliteration (biggest risk)

### B6. 2GIS коммерческая интеграция — переговоры + 1-2 нед
- Лучший owner-verified источник для Тбилиси (proactive phone verification)
- Catalog API: `catalog.api.2gis.com/3.0/items`
- Pricing: unpublished, "contact manager"
- Demo key: 1 month, 50 objects
- Роль: owner-verified cross-check для hours/phone (highest trust)

### B7. Yandex Maps — ~$2,750/yr minimum
- ~43,600 Tbilisi businesses
- Owner phone-verification
- Free tier: 500 req/day, NO storage allowed
- Paid: annual license from $2,750/yr
- Роль: Phase 3, только если 2GIS gaps или нужны Russian-language reviews

### Порядок B-фазы:
```
B1 (Overture, free) → B2 (FSQ, free) → B3 (OSM improve) → B4 (maintenance score) → B5 (entity resolution) → B6 (2GIS) → B7 (Yandex)
```

**Trigger для B-фазы**: Phase A полностью завершена + есть реальный трафик + нужно >55% coverage.

---

## Per-field trust hierarchy (для Phase B)

Когда источники конфликтуют — разрешаем per-field:

| Поле | Trust order | Примечание |
|---|---|---|
| hours, phone, website | 2GIS verified > Yandex verified > Google owner-trio > OSM check_date | Owner-verified побеждает |
| coordinates | Google > 2GIS > OSM > Overture | Точность footprint |
| rating | Хранить раздельно per-source | Никогда не мерджить в одно число |
| closure status | Google businessStatus + FSQ date_closed + OSM deletion (≥2 sources agree) | Не скрывать по одному сигналу |
| amenities (dogs, kids) | Owner-verified > ≥2 sources agree > omit | "Не знаем" лучше чем угадывать |

---

## Budget projections

| Масштаб | Google/мес | Другие | Total |
|---|---|---|---|
| 1 город (текущий) | $20-50 | $0 (free sources) | $20-50 |
| 5 городов | $100-300 | 2GIS demo free | $100-300 |
| 20 городов | $500-1500 | 2GIS commercial + free sources | $1000-2000 |

**При 20 городах free sources становятся стратегически критичными** — Google только для owner-field verification top venues.

---

## Google Places API pricing reference (2026)

### Text Search (per 1,000):
- Essentials (IDs only): FREE
- Pro: ~$32 (displayName, location, types, photos, businessStatus)
- Enterprise: ~$35 (+ rating, hours, phone, website, priceLevel)
- Enterprise+Atmosphere: ~$40 (+ allowsDogs, goodForChildren, outdoorSeating, etc.)

### Place Details (per 1,000):
- Essentials: ~$5 (IDs, address, location)
- Pro: ~$17 (+ displayName, types, photos)
- Enterprise: ~$20 (+ rating, hours, phone)
- Enterprise+Atmosphere: ~$25 (+ amenity booleans)

### Free monthly caps:
- Essentials: ~10,000
- Pro: ~5,000
- Enterprise: ~1,000

### Key rules:
- Billed at HIGHEST tier in your field mask
- `place_id` storable indefinitely (explicit exception)
- All other fields: 30-day TTL (Terms of Service §3.2.3(b))
- place_id refresh (ID-only): FREE, recommended every 12 months
