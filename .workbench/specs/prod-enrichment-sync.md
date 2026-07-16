# Prod Enrichment Sync — Review & Spec

## Оценка плана v3

План сильный. Правильный порядок: диагностика → архитектурный фикс → синк → cleanup. Ниже — мои дополнения и корректировки на основе того, что уже сделано и что я вижу в коде.

---

## Корректировки к плану

### 1. Номера миграций

План предлагает миграцию 016 для osm_id. **Конфликт**: 016 и 017 уже заняты (biletebi.ge и tkt.ge sources, применены на prod 2026-07-16). Следующая свободная: **018**.

### 2. Аномалия 0.1 — скорее всего НЕ баг

Код Enterprise enrichment (строка 195):
```
.where('v.googlePlaceId IS NOT NULL')
.andWhere('p.googleRating IS NULL')
```

Enterprise **требует** `googlePlaceId` на venue. Без него не обрабатывает. Значит если на prod 1,325 ratings при 525 place_ids — возможные объяснения:

- **Цифра 525 была снята ДО всех прогонов Pro.** Pro суммарно обогатил 518 (293+225), потом ещё 4 после поднятия порога. Итого ~522. Но Enterprise обогатил 1,325 — больше чем Pro матчей.
- **Вероятная причина**: Pro enrichment запускался локально ЧЕРЕЗ prod DB (если DATABASE_URL указывал на Railway). Тогда Pro матчи записались с точного IP, а мы видим только прод-прогоны.
- **Или**: подсчёт 525 был неверен (взят из неполного прогона).

**Вердикт**: Фаза 0.1 всё равно критична. Один SQL-запрос покажет реальную картину. Но "баг записи" маловероятен — код явно проверяет `googlePlaceId IS NOT NULL`.

### 3. Track T1 — locationRestriction: САМЫЙ ВАЖНЫЙ ПУНКТ

Код сейчас использует **New API** (`places.googleapis.com/v1/places:searchText`) с `locationBias`:
```ts
body: JSON.stringify({
  textQuery: venue.name,
  locationBias: {
    circle: { center: { latitude: venue.lat, longitude: venue.lng }, radius: ... }
  }
})
```

`locationBias` — мягкая подсказка. Google может вернуть результат из другого города. `locationRestriction` — жёсткий фильтр, результаты ТОЛЬКО внутри круга.

**Если T1 сработает** — вся проблема с Railway IP исчезает. Enrichment можно гонять на проде напрямую для любого города. osm_id всё равно нужен (для синка и идемпотентности), но срочность падает.

Рекомендация: **T1 первым, параллельно с диагностикой 0.1.** Одно изменение, тест на 20 venue, результат за час.

### 4. Координатный матчинг — рабочий fallback

Тип lat/lng в коде: `float` (TypeORM `@Column({ type: 'float' })`). В PostgreSQL это `double precision`. Exact `=` сравнение для float — **ненадёжно**. Нужен `ABS(a-b) < 1e-7` (~1.1 см). Плюс проверка коллизий (фудкорты, ТЦ).

Но это fallback. Если T1 + osm_id решают — координатный матчинг не нужен.

### 5. Временный import-enrichment endpoint

Уже существует в коде (`ingestion.controller.ts`). Матчит по UUID (не работает). После osm_id — переписать на `(osm_type, osm_id)`. После синка — решить: удалить или оставить для будущих городов.

### 6. UX-24 блокер

План говорит: "мержить UX-24, миграция 015 на prod, только потом 016+". Нужно проверить текущий статус UX-24 branch и конфликты с уже применёнными 016-017.

### 7. NestJS body limit

Столкнулись при попытке синка через API: `413 Request Entity Too Large`. Default ~100KB. Payload с `opening_hours` + `attributes` + `photos` превышает. Фикс: `app.use(json({ limit: '2mb' }))` в `main.ts` или чанки по 50-100 записей.

---

## Рекомендуемый порядок действий

```
1. Диагностика 0.1                    [15 мин]
   └─ SQL-запрос на prod: rating_no_id, реальные цифры

2. T1: locationBias → locationRestriction  [1 час]
   └─ Изменить searchText запрос
   └─ Тест: 20 venue с известными place_id
   └─ Если distance < 200м → Railway IP проблема РЕШЕНА

3. Если T1 сработал:
   ├─ Re-run Pro enrichment на prod         [автоматически]
   ├─ Re-run Enterprise на prod             [автоматически]
   └─ osm_id как архитектурное улучшение   [не срочно]

4. Если T1 НЕ сработал:
   ├─ Фаза 1: osm_id миграция (018)        [3-4 часа]
   ├─ Фаза 2: синк local → prod            [2-3 часа]
   └─ T2: enrichment как отдельный воркер   [long-term]

5. Cleanup                                  [30 мин]
   └─ Убрать/обновить import-enrichment
   └─ Обновить docs
```

---

## Что уже сделано (контекст для следующей сессии)

| Действие | Статус | Результат |
|---|---|---|
| Pro enrichment на prod | done | 522 venues matched |
| Enterprise enrichment на prod | done | ~1,325 places с ratings |
| Atmosphere на prod | NOT done | 0 allowsDogs/goodForChildren |
| Порог 200м → 500м | deployed | +4 venue (минимальный эффект) |
| import-enrichment endpoint | deployed, broken | UUID mismatch, 0 updated |
| Локальный экспорт | done | `tmp/enrichment-venues.json` (1,755), `tmp/enrichment-places.json` (1,725) |
| NestJS body limit | NOT fixed | 413 на payload > 100KB |

## Файлы в контексте

- `apps/api/src/app/ingestion/google-enrichment.service.ts` — enrichment логика, matchVenue (строка 94), порог 500м (строка 127), Enterprise query (строка 192)
- `apps/api/src/app/ingestion/ingestion.controller.ts` — временный import-enrichment endpoint (удалить/переписать)
- `tmp/enrichment-venues.json` / `tmp/enrichment-places.json` — экспортированные данные
- `apps/api/src/app/database/entities/venue.entity.ts` — venue entity (нет osm_id пока)
