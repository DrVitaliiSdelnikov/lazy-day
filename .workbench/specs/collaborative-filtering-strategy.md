# Collaborative Filtering & User-Similarity — Strategy for LaziGo

*На основе deep research (2026-07-17). Сохранено для роудмепа.*

## Резюме

CF на текущем масштабе (3,164 venues, low traffic) — преждевременно. Правильный путь:
1. Content-based score (уже есть) — backbone навсегда
2. Popularity prior → segments → item-item co-occurrence с shrinkage → MF (может никогда)
3. "Been here" кнопка — единственный путь к ground-truth "visited" signal

## Claude Review (2026-07-17)

### Берём (архитектурные решения)

1. **CF как additive term с w_cf=0** — добавлять как `+ w_cf * cf_score` к существующей формуле. Начать с 0, поднимать по мере данных. Никакого rewrite.

2. **Shrinkage λ≈100** — единственная формула которая реально нужна: `s_ij = (n_ij / (n_ij + 100)) * cosine(i,j)`. Предотвращает ложные корреляции от 2 совпадений.

3. **Popularity prior** — `(positives + α) / (impressions + α + β)` как первый "персонализированный" сигнал. Cremonesi 2010: popularity почти матчит CF и бьёт плохо настроенный CF.

4. **Segments > per-user** при низких данных — использовать существующие конструкты (7 moods, tourist/local, company) как сегменты. Не кластеризовать из тонких данных.

5. **"Been here" кнопка — высший приоритет** для CF. Единственный ground-truth "visited" signal. Route click = intent, не visit.

6. **Logging tables NOW** — `user_preference_aggregates` и `venue_cooccurrence`. Даже если CF через 6+ месяцев, данные должны копиться.

7. **Item-item > user-user** — стабильнее, precomputable offline, масштабируется (Amazon 2003).

8. **Require n_ij ≥ 5** before any co-occurrence influences recommendations.

### Согласен но не сейчас

9. **Category-level Thompson Sampling per segment** — правильная идея, но нужны данные. Фаза 2 (месяцы 3-9).

10. **Confidence-weighted implicit MF (Hu et al.)** — только если density > 0.1%. Скорее всего не скоро.

11. **BPR ranking objective** — лучше чем pointwise для implicit, но нужен объём данных.

### Не берём

12. **Neural methods** (two-tower, GRU4Rec, BERT4Rec, LightGCN) — overkill. Reproducibility crisis: 6/7 проигрывают well-tuned kNN.

13. **Apriori/FP-Growth** — threshold cliff. Item-item с shrinkage degrades gracefully.

14. **Social graph** — нет и не нужен. Weakest term в USG framework.

15. **Differential privacy** — noise уничтожает co-occurrence of 3. Не при текущем scale.

16. **Federated/on-device** — heavy engineering для solo dev.

### Сомнения

17. **Precision@5 = 0.04-0.06 в POI литературе** — это значит что "Реши за меня" (один пик) статистически угадывает в ~2-5% случаев по offline метрикам. Но hard constraints (open, nearby, mood) сужают пул до ~20 приемлемых → фактическая "hit rate" выше. Не паниковать по offline метрикам.

18. **Спека предлагает `user_preference_aggregates` таблицу сейчас** — но нужна ли она до того как есть хотя бы 100 qualified sessions? Логи в `interaction_events` уже есть. Агрегирующая таблица — это оптимизация чтения, не сбор данных. Можно добавить когда понадобится.

## Порядок (для роудмепа)

| Этап | Что | Когда | Зависит от |
|---|---|---|---|
| 0 | Logging: session sequences, card_position (ЕСТЬ) | done | — |
| 1 | "Been here" кнопка | Phase 0 или v1 | UI decision |
| 2 | `venue_cooccurrence` table + daily cron | когда ~100+ qualified sessions | "Been here" |
| 3 | Popularity prior (Bayesian-smoothed) | когда ~100+ sessions | logging |
| 4 | Segment-based popularity + category TS | segments k≥5, ~dozens interactions | segments defined |
| 5 | Item-item co-occurrence + shrinkage (w_cf term) | pairs n_ij≥5 exist | venue_cooccurrence |
| 6 | Confidence-weighted ALS (if ever) | density >0.1% on active catalog | Stage 5 shows lift |

## Kill criteria
- D7 <10% AND top-3 CTR <25% at deploy+2mo → freeze
- Item-item CF fails to beat popularity in interleaving → stop at Stage 4
- Density stays <0.1% → no MF

## Full research document
[Stored separately — too large for inline. See original research prompt.]
