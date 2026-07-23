# Personalization System — Overview & Integration Requirements

*Как 4 фазы связаны. Контракты между ними. Единый pipeline.*

---

## Карта фаз

```
Phase A (DATA)                    Phase F1 (FRESHNESS)
  ├── facet_* поля ──────────────────→ (не использует)
  ├── facet_idf ─────────────────────→ (не использует)
  ├── enriched_at ───────────────────→ isStale() для discount
  ├── price_level ───────────────────→ (не использует)
  └── osm_id ────────────────────────→ (не использует)
        │                                    │
        │                                    ├── impression_agg ─────────→
        │                                    ├── discount multiplier ────→
        │                                    ├── dithering ─────────────→
        │                                    ├── epsilon slot ──────────→
        │                                    └── venue-level negative ──→
        │                                                                │
        ▼                                                                ▼
Phase F2 (PERSONALIZATION)
  ├── uses: facet_* + facet_idf (from A) ◄──────────────────────────────┘
  ├── uses: impression_agg (from F1) for anti-bubble
  ├── user_taste_profile ────────────────────────────────────────────→
  ├── personalizationScore ──────────────────────────────────────────→
  ├── facet negative ────────────────────────────────────────────────→
  └── price gaussian boost ──────────────────────────────────────────→
        │
        ▼
Phase F3 (TRANSPARENCY)
  ├── uses: facet_weights (from F2) for "ваш вайб"
  ├── uses: signal_count (from F2) for ramp decisions
  ├── uses: _isExplore (from F1.4) for "новое место"
  ├── "почему" строка
  ├── скрутируемый профиль
  └── онбординг-рефрейм
```

---

## Единый scoring pipeline (финальный)

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                    REQUEST (lat, lng, interests, ...)           │
 └─────────────────────────┬───────────────────────────────────────┘
                           │
 1. FETCH candidates       │  SQL: places + events, bbox, haversine
                           ▼
 2. HARD FILTER            │  hidden, budget, closed (existing)
                           ▼
 3. BASE SCORE             │  0.45×interest + 0.25×distance + 0.15×time
                           │  + 0.10×quality + 0.05×source
                           │  + company modifier + pet modifier
                           │  × chain penalty (0.85)
                           ▼
 3.5 PERSONALIZATION [F2]  │  + w_personal × cosine(profile, venue_facets)
                           │    w_personal: 0→0.20, ramp by signal_count
                           ▼
 3.6 PRICE BOOST [F2]      │  + β × gaussian(venue_tier, μ, σ)
                           │    β ≤ 0.08
                           ▼
 4. INTEREST FILTER         │  strict (≥0.7) → must match
                           │  soft (0.3-0.7) → must have primaryTag
                           ▼
 5. AVAILABILITY FILTER    │  checkOpenStatus ≠ 'closed'
                           ▼
 6. ADAPTIVE RADIUS        │  <5 results → radius ×1.5
                           │  [F1.6] pool exhausted → radius ×1.5
                           ▼
 7. IMPRESSION DISCOUNT [F1] │  score × 0.85^unengaged_count
                           │  + 24h recency gate ×0.6
                           ▼
 8. SORT by score desc      │
                           ▼
 9. FAVORITE RE-SURFACE [F1]│  saved + >7 days → ×1.05
                           ▼
10. [STECK CALIBRATION] [F2]│  GATED: only if signal_count≥10
                           │  70/30 taste/explore ratio
                           ▼
11. SESSION DITHERING [F1]  │  log(rank) + N(0, log(ε))
                           │  top-2 stable
                           ▼
12. DAILY ROTATION          │  date-seed swap |Δ|<0.05 (existing)
                           ▼
13. DIVERSITY FILTER        │  category streak ≤2, chain ≤1 in top-20
                           ▼
14. EPSILON SLOT [F1]       │  1/8 = explore candidate
                           │  label: "новое место рядом"
                           ▼
15. BUILD CARDS             │  top-60, "почему" строка [F3]
                           ▼
16. RECORD IMPRESSIONS [F1] │  async: impression_agg upsert
                           ▼
17. UPDATE PROFILE [F2]     │  async on engagement: facet_weights + IDF
                           │
 └─────────────────────────────────────────────────────────────────┘
```

---

## Таблицы (по фазам)

| Таблица | Фаза | Тип | Используется в |
|---|---|---|---|
| facet_idf | A.10 | cron-computed | F2 (IDF weighting) |
| impression_agg | F1.1 | per (user, venue) | F1.2 (discount), F2.6 (anti-bubble) |
| user_taste_profile | F2.1 | per user | F2.3 (scoring), F3.1 (why), F3.2 (profile UI) |

**Поля на places (миграция 018):**

| Поле | Фаза | Тип | Заполняется |
|---|---|---|---|
| facet_cuisine | A.9 | text[] | Google types маппинг + Gemini gaps |
| facet_format | A.9 | text[] | Google types маппинг + Gemini gaps |
| facet_price_tier | A.9/A.8 | smallint | Google price_level + Gemini |
| facet_price_conf | A.9/A.8 | real | автоматически |
| facet_atmosphere | A.8 | text[] | Gemini enrichment |
| facet_occasion | A.8 | text[] | Gemini enrichment |
| enriched_at | A.2 | timestamptz | при enrichment |
| price_level | A.6 | smallint | Google Enterprise |
| typical_duration_min | A.8 | smallint | Gemini (schema only) |
| time_of_day_fit | A.8 | text[] | Gemini (schema only) |
| venue_role | A.8 | text | Gemini (schema only) |
| anchor_vs_filler | A.8 | text | Gemini (schema only) |

**Поля на venues (миграция 018):**

| Поле | Фаза | Тип |
|---|---|---|
| osm_id | A.1 | bigint |
| osm_type | A.1 | varchar(8) |

---

## Контракты между фазами

### A → F1
- enriched_at используется в F1.2 для isStale() fallback
- Если A.2 не готов → F1 работает без isStale (fallback на null check, как сейчас)

### A → F2
- **ЖЁСТКИЙ БЛОКЕР.** Без facet_* полей cosine scoring невозможен
- Без facet_idf IDF-weighting невозможен
- **Минимальное требование:** facet_cuisine ≥50% food venues, facet_idf computed

### F1 → F2
- impression_agg используется в F2.6 anti-bubble диагностике
- Discount multiplier применяется ПОСЛЕ personalizationScore
- venue-level negative (unengaged_count=100 при hide) → F2.4 использует для facet attribution

### F2 → F3
- facet_weights для "ваш вайб: X" и скрутируемого профиля
- signal_count для ramp decisions (показывать ли personalized why)
- _isExplore flag из F1.4 для "новое место рядом"
- personalizationScore для выбора why-шаблона

---

## Инварианты (НИКОГДА не нарушать)

1. **Категория floor 10%.** Ни при каких обстоятельствах категория не падает ниже 10% видимости в выдаче.
2. **w_personal starts at 0.** Новый пользователь = чистый content-based scoring. Персонализация только по мере данных.
3. **Skip ≠ hide.** Skip → усталость (impression_agg). Hide → неприязнь (neg_counters). Не смешивать.
4. **Low-IDF фасеты не штрафуются.** "food", "restaurant" — слишком общие для негатива.
5. **Price НИКОГДА не отсекает.** Gaussian boost β ≤ 0.08, soft only.
6. **Epsilon slot честно помечен.** "Новое место рядом" — не обман.
7. **Профиль скрутируемый.** Пользователь ВСЕГДА может посмотреть и поправить.
8. **Онбординг не блокирует.** Лента доступна мгновенно, без ввода.
9. **Impression записываются async.** Не блокировать ответ.
10. **Все параметры — стартовые эвристики.** 0.85, 0.6, 0.20 — тюнить по данным, не по теории.

---

## Трудозатраты (сводка)

| Фаза | Часы | Зависит от |
|---|---|---|
| Phase A (data) | 23-27 | Phase 0 done |
| Phase F1 (freshness) | 12 | Phase 0 done (параллельно с A) |
| Phase F2 (personalization) | 12 | Phase A + F1 done |
| Phase F3 (transparency) | 17 | Phase F2 done |
| **Total** | **64-68ч** | **~3 недели** |

---

## Consistency checks

✅ Миграция 018 содержит ВСЕ schema changes для A + F1
✅ Pipeline order: base → personal → price → discount → sort → dither → epsilon
✅ impression_agg: одна строка per pair, UPDATE not INSERT (из ревью)
✅ Steck gated: только signal_count≥10 (из ревью)
✅ Уточняющая карточка: позиция 5-6, композитный триггер (из ревью)
✅ JSONB профиля: парсится 1 раз за запрос, venue facets нативные text[]
✅ Профиль для всех (Грузия), consent-gated для analytics/ads
✅ "Спланируй день" поля заполняются в A8, логика отложена на Future
✅ Негатив decay: 21-30 дней (быстрее позитива 60-90)
✅ F1 не требует фасетов → параллелится с Phase A
