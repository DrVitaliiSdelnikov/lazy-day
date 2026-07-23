# Phase F3 — Transparency & Onboarding Reframe: Детальная спека

*Требует F2 (taste profile, personalizationScore).*
*Вход: facet_weights, signal_count, personalizationScore из F2*
*Выход: объяснения на карточках, скрутируемый профиль, новый онбординг flow*

---

## Зависимости

```
Phase F2 done ─── BLOCKER (нужен facet_weights для отображения)
  ↓
F3.1 строка "почему" на карточке
F3.2 скрутируемый профиль в настройках
F3.3 "правила игры" карточка
  ↓
F3.4 онбординг-рефрейм (мгновенные результаты)
F3.5 ветки турист/местный
F3.6 уточняющая карточка в ленте
```

---

## F3.1 Строка "почему" на карточке

**Что:** одна строка на карточке объясняющая ПОЧЕМУ это место показано. Разворачивается по тапу.

**Где:** `result-card.component.ts`, slot 3 (status) или новый slot между meta и status.

**Шаблоны (по приоритету):**

| Приоритет | Условие | Шаблон (ru) | Шаблон (en) |
|---|---|---|---|
| 1 | `_isExplore` (F1.4) | Новое место рядом | New place nearby |
| 2 | saved ранее + re-surface | Вы сохраняли | You saved this |
| 3 | personalizationScore > 0.6 | Ваш вайб: {top_matching_facet} | Your vibe: {facet} |
| 4 | facet match + company | Подходит для {company} | Good for {company} |
| 5 | high interestScore + no personal | Совпадает с интересом | Matches your interest |
| 6 | proximity only | Рядом с вами | Near you |

**Логика выбора:**
```ts
function resolveWhyLabel(card: Card, profile: TasteProfile | null, locale: string): string | null {
  if ((card as any)._isExplore) return t('card.why_explore', locale);
  if (card._isSavedResurface) return t('card.why_saved', locale);

  if (profile && profile.signal_count >= 3) {
    const topFacet = findTopMatchingFacet(profile.facet_weights, card);
    if (topFacet && card._personalScore > 0.6) {
      return t('card.why_vibe', locale, { facet: translateFacet(topFacet, locale) });
    }
  }

  if (card.companyFit === 'boosted') {
    return t('card.why_company', locale, { company: translateCompany(card._company, locale) });
  }

  if (card.interestScore > 0.5) return t('card.why_interest', locale);
  if (card.distance_m < 500) return t('card.why_near', locale);

  return null;
}
```

**i18n ключи:**
```json
{
  "card": {
    "why_explore": "Новое место рядом",
    "why_saved": "Вы сохраняли",
    "why_vibe": "Ваш вайб: {{facet}}",
    "why_company": "Подходит для {{company}}",
    "why_interest": "Совпадает с интересом",
    "why_near": "Рядом с вами"
  }
}
```

**UI:** мелкий текст под status slot, `--ld-text-3`, без иконки. Не badge, не chip — просто текст.

**Трудозатраты:** 3ч (логика + i18n + component update).

---

## F3.2 Скрутируемый профиль

**Что:** страница в настройках где пользователь видит что система "думает" о его вкусах и может поправить.

**Где:** `settings.component.ts`, новая секция "Ваш вкус".

**UI:**

```
┌─────────────────────────────────────┐
│ Ваш вкус                            │
│                                     │
│ Кажется, вам нравится:              │
│ [🍷 Винные бары] [🎵 Живая музыка]   │
│ [🇬🇪 Грузинская кухня]              │
│                                     │
│ Уводим от:                          │
│ [🍔 Фастфуд ×]                      │
│                                     │
│ Ценовой вкус: ████░ (выше среднего)  │
│                                     │
│ Верно? Нажмите на тег чтобы убрать  │
│ или добавить.                        │
│                                     │
│ [Сбросить вкус]                      │
└─────────────────────────────────────┘
```

**Логика:**
```ts
// Показать top-N позитивных фасетов (weight > 0.3)
const positives = Object.entries(flatWeights)
  .filter(([_, w]) => w > 0.3)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6);

// Показать негативные (weight < -0.2)
const negatives = Object.entries(flatWeights)
  .filter(([_, w]) => w < -0.2)
  .sort((a, b) => a[1] - b[1])
  .slice(0, 3);
```

**Редактирование:** тап на позитивный тег → удалить из weights (set to 0). Тап × на негативный → удалить штраф. Изменение → PATCH user_taste_profile → мгновенный эффект на следующий запрос.

**"Сбросить вкус":** `facet_weights = {}`, `price_pref = {}`, `neg_counters = {}`, `signal_count = 0`.

**Трудозатраты:** 4ч (UI + API endpoint + profile sync).

---

## F3.3 "Правила игры"

**Что:** статичная info-карточка доступная из settings.

**Контент:**
```
Как LaziGo подбирает

• Учимся по вашим тапам, сохранениям и маршрутам
• Подмешиваем новые места — вы можете открыть неожиданное
• Скрытые места больше не появятся
• Ваш вкус можно посмотреть и поправить в профиле
• Всё хранится на устройстве
```

**UI:** bottomsheet или отдельная страница, ссылка из settings ("Как это работает").

**Трудозатраты:** 1ч.

---

## F3.4 Онбординг-рефрейм

**Что:** переосмысление онбординга. Мгновенные результаты БЕЗ ввода, всё остальное опционально.

**Текущее:** Welcome → Onboarding (interests + company + GPS) → Discover.

**Новое:**
```
Landing (/) → мгновенная лента по контексту (GPS + время + popularity)
              ├── 7 чипов настроения (один тап пере-ранжирует)
              ├── компания/питомец (вторичные)
              └── "Настроить интересы" → полный профиль (тихая ссылка)
```

**Ключевые изменения:**
1. Landing = discover. Никакого гейта. GPS запрашивается inline с объяснением.
2. Popularity-фолбэк при нуле данных (как Netflix "trending").
3. Турист/местный — компактный выбор (2 чипа вверху или в settings), а не отдельный шаг.
4. Полный онбординг (interests grid, company, pet) → доступен из settings, не навязывается.

**Связь с текущим кодом:**
- `AdLandingComponent` уже есть как entry point с чипами
- `DiscoverComponent` уже показывает ленту
- Нужно: убрать обязательный welcome/onboarding gate, сделать их опциональными
- `ld_welcome_done` localStorage → убрать как blocker, оставить для analytics

**Трудозатраты:** 4ч (refactor routing + landing merge + conditional onboarding).

**⚠️ Не ломать:** текущий flow landing → discover должен продолжать работать для тех кто уже прошёл онбординг.

---

## F3.5 Ветки турист/местный

**Что:** разные параметры скоринга для туристов и местных.

**Текущее:** флаг в онбординге (First time / Been before / I live here), хранится в ProfileStore.

**Имплементация в scoring:**
```ts
// В discover(), перед scoring:
const isLocal = dto.profile.localType === 'local';
const isTourist = dto.profile.localType === 'tourist' || dto.profile.localType === 'first_time';

// Модификаторы:
if (isTourist) {
  radiusM *= 1.3;                    // шире поиск
  CHAIN_SCORE_MULTIPLIER = 0.90;     // мягче к chain (турист не знает)
  // Буст tourist_attraction, museum, viewpoint
  // Не учитывать "уже был" (impression_discount мягче)
}
if (isLocal) {
  radiusM *= 0.8;                    // ближе к дому
  CHAIN_SCORE_MULTIPLIER = 0.80;     // жёстче к chain
  // Буст новизне (impression_discount строже)
}
```

**Трудозатраты:** 2ч.

---

## F3.6 Уточняющая карточка в ленте

**Что:** inline карточка "Не то? Уточни" с 3-4 фасет-чипами.

**Триггер (композитный):**
```ts
function shouldShowTuneCard(
  scrollPosition: number,
  engagementCount: number,
  scrollSpeed: number,  // средняя скорость свайпа
  sessionTuneShown: boolean,
): boolean {
  if (sessionTuneShown) return false;           // раз за сессию
  if (scrollPosition < 5) return false;          // не раньше позиции 5
  if (engagementCount > 0) return false;         // если уже тапал — не мешать
  if (scrollSpeed < FAST_SCROLL_THRESHOLD) return false;  // медленный скролл = читает
  return true;
}
```

**UI:**
```
┌─────────────────────────────────────┐
│ Не то, что ищете?                    │
│                                     │
│ [Грузинская] [Бары] [Уютное] [Дата] │
│                                     │
│                        [Пропустить] │
└─────────────────────────────────────┘
```

**Чипы:** top-4 фасета из таксономии, исключая уже активные presets. Или: top-4 по IDF (самые различающие).

**Действие:** тап на чип → добавить как фильтр → re-fetch с фасет-фильтром. Записать как позитивный сигнал.

**Частотный кэп:** раз за сессию. При dismiss → backoff (не показывать 3 сессии).

**Трудозатраты:** 3ч.

---

## Сводка трудозатрат

| Задача | Часы |
|---|---|
| F3.1 строка "почему" | 3 |
| F3.2 скрутируемый профиль | 4 |
| F3.3 "правила игры" | 1 |
| F3.4 онбординг-рефрейм | 4 |
| F3.5 турист/местный | 2 |
| F3.6 уточняющая карточка | 3 |
| **Total** | **~17ч** |

---

## Контракт выхода

**Phase F3 выдаёт:**
1. "Почему" строка на каждой карточке (контекстная, 6 шаблонов)
2. Скрутируемый профиль в settings (позитивы, негативы, price, reset)
3. Info "Как LaziGo подбирает"
4. Мгновенный онбординг (лента без гейта, popularity fallback)
5. Турист/местный модификаторы в scoring
6. Уточняющая карточка на позиции 5-6 с композитным триггером

**Ворота выхода:**
- Time to first recommendation <3 сек (нет гейта)
- Онбординг опционален, не блокирует
- Скрутируемый профиль показывает корректные фасеты после 3+ сигналов
- Уточняющая карточка не мешает активным пользователям (триггер композитный)
