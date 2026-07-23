# «Реши за меня» — Алгоритм выбора v1

*На основе deep research (2026-07-17). Только Фаза 1 — клиентский ре-ранкер.*

## Проблема (4 бага текущей реализации)

1. **Нет рандомности** — всегда top-4 из ленты в том же порядке. "Другой вариант" = следующий по списку.
2. **Нет антиповтора** — переоткрыл модалку → те же карточки.
3. **Нет квоты типа** — может показать 3 места и 0 событий, даже если события есть.
4. **Нет разнообразия** — 3 музея подряд при фильтре "культура".

## Текущая реализация

```
decideCards = computed(() => {
  const all = this.cards();                              // отскоренная лента
  const ideal = all.filter(c => !c.isChain && explanations > 0);
  if (ideal.length >= 2) return ideal.slice(0, 4);       // ← жёстко top-4
  const nonChain = all.filter(c => !c.isChain);
  if (nonChain.length >= 2) return nonChain.slice(0, 4);
  return all.slice(0, 4);
});

// В модалке:
current = computed(() => this.cards()[this.attempt()]);   // ← просто cards[0], cards[1], cards[2]
```

Проблемы очевидны: `slice(0, 4)` + `cards[attempt]` = детерминированный, повторяемый, без разнообразия.

## Решение: клиентский ре-ранкер

### Архитектура

```
Существующая лента (отскоренная, отсортированная, ~60 карточек)
  │
  ▼
decidePick(cards, ctx, attempt)
  │
  ├─ 1. Полоса кандидатов (DELTA_BAND = 0.15 от top score)
  ├─ 2. Сессионные штрафы (skips → impression discount)
  ├─ 3. Квота типа (≥1 событие в тройке если есть)
  ├─ 4. MMR переранжирование (разнообразие категорий/типов/районов)
  └─ 5. Сидированный выбор (mulberry32, seed = deviceId + date + attempt)
  │
  ▼
Один пик → показать в модалке
```

**Ни новой инфраструктуры, ни серверных изменений, ни ML.** Всё в Angular, ~150 строк TypeScript.

### Детальный алгоритм

#### Шаг 1: Полоса кандидатов

Вместо жёсткого `slice(0, 4)` — все карточки в пределах `DELTA_BAND` от лучшего скора.

```ts
const eligible = cards.filter(c =>
  !sessionState.shownIds.has(c.id) &&   // антиповтор
  isUsable(c, ctx)                       // open-now / окно события / радиус
);
const topScore = eligible[0]?.score ?? 0;
let pool = eligible.filter(c => topScore - c.score <= DELTA_BAND);
if (pool.length < 4) pool = eligible.slice(0, 8);  // адаптивное расширение
```

- `DELTA_BAND = 0.15` — шире чем tie-band ленты (0.05), чтобы "другой вариант" имел простор
- Если полоса слишком узкая (< 4) — расширяем до top-8
- `isUsable` наследует текущие фильтры (open-now, timeWindow, radius)

#### Шаг 2: Сессионные штрафы

```ts
function applyPenalties(card: Card, state: SessionState): number {
  let score = card.score;

  // Impression discounting (паттерн LinkedIn)
  const seen = state.impressions[card.id] ?? 0;
  score *= Math.pow(0.6, seen);  // каждый показ = ×0.6

  // Штраф категории при скипе (слабый)
  if (state.skippedCategories.has(card.category)) {
    score *= 0.85;
  }

  // Штраф района при скипе (только если эвристика дистанции сработала)
  if (state.skippedAreas.has(distanceBand(card))) {
    score *= 0.9;
  }

  return score;
}
```

- `impressions` — Map<id, count>, инкрементируется при каждом показе
- `skippedCategories` — Set<string>, добавляется при скипе
- `skippedAreas` — Set<number>, добавляется при скипе если venue далеко (>2× медианы)
- **Всё живёт только в памяти компонента** — умирает при закрытии модалки

#### Шаг 3: Квота типа

```ts
const needEvent = hasRelevantEvents(eligible)
  && !sessionState.shownCards.some(c => c.type === 'event')
  && attempt === pickEventSlot(sessionState);  // слот для события (обычно attempt=1 или 2)
```

- Если в пуле есть события и в тройке ещё нет ни одного — форсировать
- `pickEventSlot` — не всегда attempt 0 (первый пик может быть местом), выбирается сидированно
- Если релевантных событий нет — квота пропускается (мягкая деградация)

#### Шаг 4: MMR переранжирование

```ts
function mmr(pool: Card[], alreadyShown: Card[], lambda = 0.6): Card[] {
  const result: Card[] = [];
  const candidates = [...pool];
  const selected = [...alreadyShown];

  while (candidates.length > 0) {
    let bestCard: Card | null = null;
    let bestValue = -Infinity;

    for (const c of candidates) {
      const maxSim = selected.length > 0
        ? Math.max(...selected.map(s => venueSim(c, s)))
        : 0;
      const value = lambda * c.effScore - (1 - lambda) * maxSim;
      if (value > bestValue) {
        bestValue = value;
        bestCard = c;
      }
    }

    result.push(bestCard!);
    selected.push(bestCard!);
    candidates.splice(candidates.indexOf(bestCard!), 1);
  }

  return result;
}
```

- `lambda = 0.6` — релевантность чуть важнее разнообразия
- O(n·k) при n≈8, k≤3 — мгновенно
- Жадный алгоритм, как в оригинале Carbonell & Goldstein 1998

#### Шаг 4.1: Функция похожести

```ts
function venueSim(a: Card, b: Card): number {
  let sim = 0;
  if (a.category === b.category) sim += 0.5;    // два музея = похожи
  if (a.type === b.type)         sim += 0.2;    // оба места (не событие)
  if (distanceBand(a) === distanceBand(b)) sim += 0.3;  // тот же район
  return sim;  // [0, 1]
}

function distanceBand(card: Card): number {
  return Math.floor((card.distanceM ?? 0) / 500);  // полосы по 500м
}
```

- Без эмбеддингов, без геохешей — 3 поля, O(1)
- `distanceBand` по 500м — два места на расстоянии 200м и 400м в одном кольце = "тот же район"

#### Шаг 5: Сидированный выбор

```ts
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Сид = hash(deviceId + дата + attempt)
const seed = simpleHash(ctx.deviceIdHash + ctx.tbilisiDate + attempt);
const rng = mulberry32(seed);

const tier = needEvent
  ? ranked.filter(c => c.type === 'event')
  : ranked.slice(0, Math.min(4, ranked.length));

const pick = tier[Math.floor(rng() * tier.length)];
```

- **Стабильно внутри сессии**: переоткрыл модалку → тот же пик (не баг)
- **Свежо между днями**: дата в сиде → завтра другой выбор
- **"Другой вариант" = другой attempt**: `attempt++` → другой сид → другой пик
- `simpleHash` — уже есть в `RecommendationService` (строка 710)

### Сессионное состояние

```ts
interface DecideSessionState {
  shownIds: Set<string>;           // что уже показано — антиповтор
  shownCards: Card[];              // для MMR — разнообразие последовательности
  impressions: Map<string, number>; // id → count показов
  skippedCategories: Set<string>;  // категории скипнутых — слабый штраф
  skippedAreas: Set<number>;       // distanceBand скипнутых — штраф района
}
```

- Создаётся при открытии модалки
- Умирает при закрытии
- **Не персистится** — каждый раз свежая сессия

### Обработка скипа

```ts
onAnother() {
  const current = this.current();

  // Трекинг (уже есть)
  this.interactions.track({ eventType: 'decide_skip', targetType: current.type, targetId: current.id, cardPosition: this.attempt() });

  // Сессионные штрафы
  this.sessionState.impressions.set(current.id, (this.sessionState.impressions.get(current.id) ?? 0) + 1);
  this.sessionState.skippedCategories.add(current.category);

  // Эвристика "далеко" — если venue дальше 2× медианы пула
  const medianDist = this.medianDistance(this.pool);
  if (current.distanceM > medianDist * 2) {
    this.sessionState.skippedAreas.add(distanceBand(current));
  }

  // Следующий пик
  this.attempt.update(n => n + 1);
  this.currentPick.set(this.decidePick(this.attempt()));
}
```

### Параметры

| Параметр | Значение | Смысл | Когда менять |
|---|---|---|---|
| `DELTA_BAND` | 0.15 | Ширина полосы кандидатов | ↑ если пики однообразные, ↓ если качество падает |
| `MMR_LAMBDA` | 0.6 | Релевантность vs разнообразие | ↓ к 0.4 если похожи, ↑ к 0.8 если случайные |
| `IMPRESSION_DECAY` | 0.6 | Штраф за повторный показ | ↓ если повторы раздражают |
| `CATEGORY_SKIP_PENALTY` | 0.85 | Штраф категории при скипе | ↓ если скипы = нелюбовь к категории |
| `AREA_SKIP_PENALTY` | 0.9 | Штраф района при скипе | фиксировано |
| `MAX_ATTEMPTS` | 3 | Количество попыток | оставить 3 |
| `EVENT_WINDOW_MIN` | 30 | Минимум минут до начала | шире для "вечером" |
| `EVENT_WINDOW_MAX` | 120 | Максимум минут до начала | шире для "вечером" |
| `DISTANCE_BAND_M` | 500 | Ширина полосы района | крупнее для больших городов |

### Что логировать

Уже есть: `decide_skip` с `targetId`, `cardPosition`.

Добавить на каждый пик:
```ts
{
  eventType: 'decide_pick',
  attempt: number,
  pickId: string,
  pickType: 'place' | 'event',
  pickCategory: string,
  poolSize: number,
  seed: number,
  wasEventQuota: boolean
}
```

### Изменения в коде

**Файлы:**
- `src/app/features/discover/decide-for-me/decide-for-me.component.ts` — основные изменения
- `src/app/features/discover/discover.component.ts` — убрать `decideCards` computed, передавать всю ленту

**Что меняется в discover.component.ts:**
```ts
// БЫЛО:
readonly decideCards = computed(() => {
  const all = this.cards();
  const ideal = all.filter(c => !c.isChain && explanations > 0);
  return ideal.slice(0, 4);
});

// СТАЛО:
// Передаём всю ленту, decide-for-me сам выбирает
<app-decide-for-me [cards]="cards()" ... />
```

**Что меняется в decide-for-me.component.ts:**
- Вместо `current = cards[attempt]` → `current = decidePick(cards, attempt)`
- Добавить `DecideSessionState` и `decidePick()` функцию
- `onAnother()` — добавить сессионные штрафы
- Убрать `maxAttempts = 3` из cards.length check (теперь определяется пулом)

### Оценка трудозатрат

| Шаг | Время |
|---|---|
| `decidePick()` + `mmr()` + `venueSim()` + `mulberry32()` | 2ч |
| `DecideSessionState` + штрафы + обработка скипа | 1ч |
| Квота типа (события) | 30мин |
| Логирование `decide_pick` | 15мин |
| Тестирование (ручное, 3 сценария) | 30мин |
| **Итого** | **~4ч** |

---

## Что НЕ делаем сейчас (Фазы 2-3)

### Фаза 2 (после метрик, недели)
- Межсессионный impression discounting (Postgres, затухание ~7 дней)
- Эвристика декомпозиции причины скипа (далеко/тайминг/категория → разные штрафы)
- Интерливинг для оценки (чередовать v1 и челленджер)
- Турист vs местный: разные веса радиуса и chain penalty

### Фаза 3 (после трафика, месяцы)
- Beta-Thompson Sampling на уровне категорий (~12 рук)
- `α = m·s, β = (1−m)·s`, s ≈ 5, γ ≈ 0.95 для нестационарности
- Только если decide-сессий > 200/неделю
- **Per-venue бандиты — не делать**

### Kill/Scale пороги
- Deploy + 2 месяца: top-3 route-CTR ≥ 25% И D7 ≥ 10% → масштабировать
- Оба ниже → заморозить
- Decide-сессий < 200/неделю → остаться на Фазе 1
- Логи скипов > 50% "далеко" → чинить радиус/дистанцию, не алгоритм
- Покрытие < 20 venues → поднять DELTA_BAND и снизить MMR λ
