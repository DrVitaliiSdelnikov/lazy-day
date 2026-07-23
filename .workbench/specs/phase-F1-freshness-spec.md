# Phase F1 — Freshness & Venue-Level Negative: Детальная спека

*Не требует фасетов. Можно параллельно с Phase A. Самый быстрый видимый win.*
*Вход: venue_id из существующей БД, enriched_at из Phase A.A2*
*Выход: impression_agg таблица → Phase F2 использует для анти-пузыря; discount множитель в scoring pipeline*

---

## Зависимости

```
Phase 0 done ─── BLOCKER
Phase A.A2 (enriched_at) ─── для isStale() в F1.2, но F1 может стартовать без (fallback на null check)
  ↓
F1.1 impression_agg таблица ── фундамент
F1.2 impression discount ──── главный рычаг
F1.5 favorite exception ───── защита любимых
  ↓ (параллельно)
F1.3 session dithering ────── diversity внутри сессии
F1.4 epsilon explore ──────── подмешивание нового
F1.6 adaptive radius ──────── свежесть через расширение
F1.7 venue-level negative ─── hide подавляет место
```

---

## F1.1 impression_agg таблица

**Миграция (019 или в составе 018):**
```sql
CREATE TABLE IF NOT EXISTS impression_agg (
  device_id_hash  TEXT NOT NULL,
  venue_id        UUID NOT NULL,
  unengaged_count SMALLINT NOT NULL DEFAULT 0,
  last_shown_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engaged         BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (device_id_hash, venue_id)
);
CREATE INDEX IF NOT EXISTS idx_impr_device ON impression_agg (device_id_hash);
```

**Запись показа** (в `RecommendationService.discover`, после построения карточек):

```ts
// После формирования top-60 карточек, асинхронно (не блокируя ответ)
private async recordImpressions(deviceIdHash: string, cardIds: string[]) {
  for (const id of cardIds) {
    await this.dataSource.query(`
      INSERT INTO impression_agg (device_id_hash, venue_id, unengaged_count, last_shown_at, engaged)
      VALUES ($1, $2, 1, NOW(), false)
      ON CONFLICT (device_id_hash, venue_id) DO UPDATE SET
        unengaged_count = CASE
          WHEN impression_agg.engaged THEN 1  -- reset после engagement
          ELSE impression_agg.unengaged_count + 1
        END,
        last_shown_at = NOW(),
        engaged = false
    `, [deviceIdHash, id]);
  }
}
```

**Запись engagement** (в `InteractionService`, при route/save/click):

```ts
async recordEngagement(deviceIdHash: string, venueId: string) {
  await this.dataSource.query(`
    UPDATE impression_agg
    SET engaged = true, unengaged_count = 0
    WHERE device_id_hash = $1 AND venue_id = $2
  `, [deviceIdHash, venueId]);
}
```

**Cron прунинг** (добавить в `EventCronService` или отдельный):
```ts
@Cron('0 5 * * *')  // 05:00 UTC daily
async pruneImpressions() {
  await this.dataSource.query(`
    DELETE FROM impression_agg WHERE last_shown_at < NOW() - INTERVAL '30 days'
  `);
}
```

**Cron decay счётчика** (честность 14-дневного окна):
```ts
// В том же cron:
// Если last_shown_at > 14 дней → обнулить unengaged_count
// (показы старше окна не должны штрафовать)
await this.dataSource.query(`
  UPDATE impression_agg
  SET unengaged_count = 0
  WHERE last_shown_at < NOW() - INTERVAL '14 days'
    AND unengaged_count > 0
    AND NOT engaged
`);
```

**Трудозатраты:** 3ч.

---

## F1.2 Impression discount (главный рычаг свежести)

**Формула:**
```
discount(u, i) = BASE ^ unengaged_count

Если last_shown_at < 24ч И НЕ engaged:
  discount *= RECENCY_GATE

BASE = 0.85 (стартовое)
RECENCY_GATE = 0.6
```

**Таблица значений:**
| unengaged_count | discount (base 0.85) | с 24h gate |
|---|---|---|
| 0 | 1.0 | 1.0 |
| 1 | 0.85 | 0.51 |
| 2 | 0.72 | 0.43 |
| 3 | 0.61 | 0.37 |
| 5 | 0.44 | 0.27 |
| 10 | 0.20 | 0.12 |

**Применение в scoring pipeline** (ПОСЛЕ base score, ДО dithering):

```ts
// В scoreCandidate или в отдельном post-scoring шаге:
private async applyImpressionDiscount(
  scored: ScoredCandidate[],
  deviceIdHash: string,
): Promise<ScoredCandidate[]> {
  if (!deviceIdHash || deviceIdHash === 'anonymous') return scored;

  const impressions = await this.dataSource.query(`
    SELECT venue_id, unengaged_count, last_shown_at, engaged
    FROM impression_agg
    WHERE device_id_hash = $1
  `, [deviceIdHash]);

  const impMap = new Map(impressions.map((i: any) => [i.venue_id, i]));

  for (const c of scored) {
    const imp = impMap.get(c.id);
    if (!imp || imp.engaged) continue;

    let discount = Math.pow(0.85, imp.unengaged_count);

    // 24h recency gate
    const hoursSinceShown = (Date.now() - new Date(imp.last_shown_at).getTime()) / 3600000;
    if (hoursSinceShown < 24) {
      discount *= 0.6;
    }

    c.score *= discount;
  }

  return scored;
}
```

**Порядок в pipeline:**
```
1. base score (существующий)
2. [future F2: + w_personal × personalizationScore]
3. × impression_discount                    ← ВОТ ЭТО
4. sort
5. daily rotation (уже есть)
6. diversity filter (уже есть)
7. [future F1.4: inject epsilon slots]
```

**Трудозатраты:** 2ч.

**Связь → F2:** impression_agg данные также используются F2.5 для анти-пузырь диагностики (если место показывается часто но без engagement → сигнал).

---

## F1.3 Session dithering

**Что:** расширить текущий date-seed rotation до user+date+session для разнообразия между сессиями одного дня.

**Текущее:** `seed = hash(YYYY-MM-DD)`, swap при |Δscore| < 0.05 для позиций 3+.

**Новое:**
```ts
private applySessionDithering(scored: ScoredCandidate[], deviceIdHash: string) {
  if (scored.length <= 2) return;

  const sessionSeed = this.simpleHash(
    deviceIdHash + new Date().toISOString().slice(0, 10) + Date.now().toString(36)
  );

  // Dithered rank: log(rank) + noise
  const EPSILON = 1.5;  // стартовое
  const rng = this.mulberry32(sessionSeed);

  for (let i = 2; i < scored.length; i++) {  // top-2 стабильны (не top-3)
    const noise = Math.log(EPSILON) * (rng() * 2 - 1);  // N(0, log(ε)) приближённо
    scored[i]._ditheredRank = Math.log(i + 1) + noise;
  }

  // Re-sort позиции 2+ по dithered rank
  const top = scored.slice(0, 2);
  const rest = scored.slice(2).sort((a, b) => (a._ditheredRank ?? 0) - (b._ditheredRank ?? 0));
  scored.splice(0, scored.length, ...top, ...rest);
}
```

**Разница с текущим daily rotation:**
- Daily rotation: swap пар с |Δ| < 0.05, детерминистично по дате
- Session dithering: log-rank + noise, разный каждую сессию
- **Оба оставляем:** daily rotation для "каждый день свежо", session dithering для "каждый визит немного другой"

**Трудозатраты:** 2ч.

---

## F1.4 Epsilon-explore

**Что:** 1 из ~7-10 слотов в выдаче = "исследовательский" пик.

```ts
private injectEpsilonSlot(
  cards: ScoredCandidate[],
  allCandidates: ScoredCandidate[],
  deviceIdHash: string,
) {
  const EPSILON_RATE = 0.12;  // ~1 из 8
  const slotIndex = Math.floor(1 / EPSILON_RATE);  // позиция 8

  if (cards.length < slotIndex) return;

  // Кандидаты для explore: высокий контент-матч + низкая история показов
  const shown = new Set(cards.map(c => c.id));
  const exploreCandidates = allCandidates
    .filter(c => !shown.has(c.id))
    .filter(c => c.interestScore >= 0.3)  // минимальный контент-матч
    .sort((a, b) => {
      // Приоритет: необогащённые (холодные) + мало показов
      const aBoost = !a.google_rating ? 0.3 : 0;  // бонус холодным
      const bBoost = !b.google_rating ? 0.3 : 0;
      return (b.interestScore + bBoost) - (a.interestScore + aBoost);
    });

  if (exploreCandidates.length === 0) return;

  // Детерминированный выбор
  const seed = this.simpleHash(deviceIdHash + Date.now().toString(36) + 'explore');
  const rng = this.mulberry32(seed);
  const pick = exploreCandidates[Math.floor(rng() * Math.min(5, exploreCandidates.length))];

  // Вставить на позицию slotIndex
  cards.splice(slotIndex, 0, pick);

  // Пометить для UI
  (pick as any)._isExplore = true;
}
```

**Explanation для explore:** `{ type: 'explore', label: 'Новое место рядом' }` — честная метка.

**Связь → F3.1:** строка "почему" использует `_isExplore` для показа "новое место рядом".

**Трудозатраты:** 2ч.

---

## F1.5 Favorite exception

**Что:** сохранённые/посещённые места не топятся затуханием.

```ts
// В applyImpressionDiscount:
// Проверить перед применением discount
const savedIds = await this.getSavedIds(deviceIdHash);  // из user profile
if (savedIds.has(c.id)) continue;  // не штрафовать saved

// Периодический ре-серфейс: если saved + last_shown > 7 дней → мягкий буст
if (savedIds.has(c.id) && hoursSinceShown > 168) {  // 7 дней
  c.score *= 1.05;  // мягкий ре-серфейс
}
```

**Трудозатраты:** 1ч.

---

## F1.6 Adaptive radius как свежесть

**Что:** расширять радиус не только при < 5 результатах, но и когда ближний пул "выдохся".

```ts
// Дополнительное условие расширения:
const avgDiscount = scored.reduce((s, c) => s + (c._discount ?? 1), 0) / scored.length;
if (avgDiscount < 0.5 && scored.length < 30) {
  // Пул "выдохся" — большинство мест уже показаны много раз
  radiusM = Math.round(radiusM * 1.5);
  // Повторить fetch с расширенным радиусом
}
```

**Трудозатраты:** 1ч.

---

## F1.7 Venue-level negative (hide)

**Что:** hide подавляет конкретное место сразу и надолго.

**Текущее:** hide добавляет id в `hiddenIds` → hard filter на шаге 2. Уже работает.

**Дополнение для Phase F2 (негатив-гардрейл):**
- hide на venue → venue подавлен (уже есть)
- hide на venue → записать в impression_agg как сильный negative (для будущего F2.3 facet attribution)

```ts
// При hide:
await this.dataSource.query(`
  INSERT INTO impression_agg (device_id_hash, venue_id, unengaged_count, last_shown_at, engaged)
  VALUES ($1, $2, 100, NOW(), false)
  ON CONFLICT (device_id_hash, venue_id) DO UPDATE SET
    unengaged_count = 100,
    engaged = false
`, [deviceIdHash, venueId]);
// unengaged_count = 100 → discount = 0.85^100 ≈ 0 → фактически подавлен
```

**Пол категории 10%:** проверять ПЕРЕД подавлением:
```ts
// Если hide приведёт к тому что категория venue упадёт ниже 10% видимости → всё равно hide venue,
// но НЕ распространять на фасеты (это гейт F2.3)
```

**Трудозатраты:** 1ч (дополнение к существующему hide).

---

## Композиция: итоговый pipeline с F1

```
BEFORE F1:
  1. fetch candidates
  2. hard filter (hidden, budget)
  3. score (interest + distance + time + quality + source)
  4. interest hard filter
  5. availability filter
  6. adaptive radius
  7. sort
  8. daily rotation
  9. diversity filter

AFTER F1:
  1. fetch candidates
  2. hard filter (hidden, budget)
  3. score (interest + distance + time + quality + source)
  4. interest hard filter
  5. availability filter
  6. adaptive radius (+ F1.6: expand when pool exhausted)
  7. × impression_discount (F1.2)                    ← NEW
  8. sort
  9. favorite re-surface boost (F1.5)                ← NEW
  10. session dithering (F1.3)                        ← REPLACES daily rotation
  11. daily rotation (keep for cross-day freshness)
  12. diversity filter (keep)
  13. inject epsilon slot (F1.4)                      ← NEW
  14. build cards
  15. record impressions async (F1.1)                 ← NEW
```

---

## Сводка трудозатрат

| Задача | Часы |
|---|---|
| F1.1 impression_agg + write/prune | 3 |
| F1.2 impression discount | 2 |
| F1.3 session dithering | 2 |
| F1.4 epsilon explore | 2 |
| F1.5 favorite exception | 1 |
| F1.6 adaptive radius extension | 1 |
| F1.7 venue-level negative | 1 |
| **Total** | **~12ч** |

---

## Контракт выхода

**Phase F1 выдаёт:**
1. `impression_agg` таблица — source of truth для "сколько раз показано без реакции"
2. `discount` множитель в scoring — повторные показы топятся
3. Session dithering — каждый визит немного другой
4. Epsilon slot — подмешивание нового/холодного
5. Favorite protection — saved не топятся
6. venue-level hide с unengaged_count=100

**Phase F2 использует:**
- impression_agg для anti-bubble (F2.5)
- venue-level negative записи для facet attribution (F2.3)
- Discount множитель как часть итогового pipeline (F2 добавляет personalizationScore ПЕРЕД discount)

**Ворота выхода:** повтор top-1 между соседними сессиями одного пользователя <30%.
