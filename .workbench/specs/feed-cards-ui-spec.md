# LaziGo — Feed & Cards UI Spec

*Версия 1.0 · 2026-07-16 · Refactor карточек ленты и карточек детали*

[Full spec content preserved as provided by developer - see source]

## Claude Review Notes (2026-07-16)

### Согласен полностью
- **Удаление дублей** (чип "X мин пешком" + мета-строка distance). Чистая победа.
- **Удаление "Тебе нравится: X"** при совпадении с фильтром. >80% случаев — бесполезный чип.
- **Рейтинг в мета-строку**. Экономит строку, информация не теряется.
- **"Часы не подтверждены"** — правильная политика, совпадает с 30-day TTL.
- **"0м" не показывать** — уже в Phase 0 roadmap.
- **border-left для events** — дешёвый визуальный разделитель.
- **Порядок внедрения 1-3 → 4-6 → 7** — от безрискового к сложному.

### Сомнения и вопросы

1. **Рельс событий (Часть 2.2)** — архитектурно правильно, но это НОВЫЙ компонент (EventsRailComponent), новый layout, scroll-snap. ~3ч работы + тестирование. Предлагаю: сначала шаги 1-6 (карточки), отправить в прод, собрать метрики. Рельс — отдельным PR после.

2. **`closesAt` на бэке** — требует парсинг `regularOpeningHours` → "22:00" для текущего дня в Asia/Tbilisi. Сейчас бек отдаёт `openStatus` как строку ("Открыто"). Нужно:
   - Парсить `opening_hours.periods` → найти close time для текущего дня
   - Учитывать timezone (UTC на сервере → Asia/Tbilisi для пользователя)
   - Edge cases: 24/7 места, места без periods, holiday overrides
   - Оценка: 2ч, не 30мин. Отдельная задача.

3. **`openingHoursFetchedAt`** — поле ещё не существует в БД (это A2 из Phase A). Для `isStale()` нужна миграция. Dependency: Phase A.A2 → Phase 0.cards.

4. **`secondaryInterests`** — бек сейчас отдаёт `primaryTags` и `secondaryTags`. Нужно маппить `secondaryTags` → interest names через INTEREST_SYNONYMS (обратный lookup). Не сложно но нужно сделать.

5. **Высота карточки "~104px, константа"** — зависит от длины title и мета-строки. `text-overflow: ellipsis` на title — ок. Но мета-строка с длинной категорией + дистанция + рейтинг + "также еда" может переноситься. Нужен `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` и на мете тоже.

6. **Tune-block на позиции 6** — что это? Не описано что внутри. Нужна спека.

7. **×0.95 за "часы не подтверждены"** — согласен с идеей, но менять скоринг в recommendation service нужно осторожно. Это затронет ВСЮ выдачу. Лучше добавить после метрик шагов 1-6.

### Предлагаемый порядок (мой)

```
Batch 1 (чистое удаление, 0 риска, 1ч):
  1. Убрать чип "X мин пешком"
  2. Убрать чип "Тебе нравится" при совпадении с фильтром
  3. Рейтинг → мета-строка
  → деплой, смотрим

Batch 2 (status slot, 3-4ч):
  4. "0м" → не показывать distance/walkMinutes когда venue=null
  5. "Часы не подтверждены" (без isStale — просто если openingHours=null)
  6. border-left для events

Batch 3 (API changes, 2-3ч):
  7. closesAt на бэке
  8. secondaryInterests маппинг
  9. openingHoursFetchedAt (BLOCKED on Phase A.A2 migration)

Batch 4 (рельс, 3-4ч):
  10. Events rail component
  11. Feed layout split
```
