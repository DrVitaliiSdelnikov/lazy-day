# Personalization Feature — Bugs Found During Testing

*2026-07-19. Тестирование на feature/personalization ветке.*

## Fixed

### 1. crossInterest() crash на undefined
**Симптом:** `TypeError: Cannot read properties of undefined (reading 'find')` при открытии модалки.
**Причина:** `card().explanations` может быть undefined (epsilon-explore карточки не проходят через generateExplanations полностью).
**Фикс:** `this.card().explanations ?? []` — guard на null/undefined.
**Коммит:** `6ba930a`

### 2. whyLabel "Совпадает с интересом" на ВСЕХ карточках
**Симптом:** каждая карточка показывает "Совпадает с интересом" когда активен preset фильтр.
**Причина:** `interestScore > 0.6` при nightlife фильтре = ВСЕ nightlife места проходят порог. Label не различает карточки — noise.
**Фикс:** убран label "Совпадает с интересом" полностью. Оставлены: explore/vibe/company/nearby.
**Коммит:** `6ba930a`

### 3. Detail hide — no-op
**Симптом:** кнопка "Скрыть" в детальной карточке ничего не делает. При возврате в список — карточка на месте.
**Причина:** `onHide()` был `// TODO: implement`.
**Фикс:** `profileStore.addHidden(id)` + `interactions.track('hide')` + `goBack()`.
**Коммит:** `6ba930a`

### 4. Duplicate nearby check в resolveWhyLabel
**Симптом:** два идентичных блока "Nearby" в resolveWhyLabel.
**Причина:** ошибка при редактировании — случайно добавил второй блок.
**Фикс:** удалён дубль.
**Коммит:** `ae9b6b6`

### 5. Preset overrides user radius
**Симптом:** пользователь выбирает радиус 1км в слайдере, но видит места на 3-5 км.
**Причина:** `MOOD_PRESETS.nightlife.radiusM = 10000` перезаписывал `finalRadius` безусловно.
**Фикс:** preset больше не перезаписывает radius. User's chosen radius always wins.
**Коммит:** `78e6f39`

### 6. Epsilon explore карточка — raw internal fields in response
**Симптом:** одна карточка в ответе содержит внутренние поля (`score`, `_ditheredRank`, `_exploreScore`, `_isExplore`, `facet_*`, `tags`, etc.) вместо cleaned card format.
**Причина:** `injectEpsilonSlot()` вставляет raw ScoredCandidate вместо mapped card object. Epsilon slot вставляется ПОСЛЕ `cards.map(buildCard)` — но сам пик не прошёл через маппинг.
**Статус:** KNOWN, low priority. Визуально карточка рендерится нормально (фронт читает нужные поля), но response содержит лишние данные.
**TODO:** маппить epsilon-pick через тот же buildCard перед вставкой.

## Open / Known Issues

### 7. whyLabel пустой на cold start
**Симптом:** ни одна карточка не показывает "причину выбора" при первом визите.
**Причина:** `signal_count = 0` → `w_personal = 0` → vibe match не работает. Nearby только <500м. Company "solo" = нет boost.
**Это BY DESIGN:** персонализация учится, а не угадывает. whyLabel появится после 3+ сигналов (save/route).
**Возможный UX improvement:** добавить fallback label на cold start — показывать атмосферу места ("Lively bar") или просто категорию. Но это может быть noise. Решить по метрикам.

### 8. Address coverage 20%
**Симптом:** у большинства карточек нет адреса, только расстояние.
**Причина:** OSM данные — только 629/3168 venues имеют `addr:street` тег.
**Не баг:** sparse OSM data in Tbilisi. Google enrichment не подтягивает адреса (не в field mask).
**Возможный improvement:** добавить `formattedAddress` в Google enrichment field mask (Pro tier).

### 9. "Часы не подтверждены" на многих местах
**Симптом:** часть мест показывает "Часы не подтверждены" даже если часы есть в Google.
**Причина:** enriched_at > 30 дней → `resolveOpenStatus()` returns undefined → frontend показывает "не подтверждены". Или opening_hours = null (не enriched).
**Не баг на проде пока:** на проде enriched_at свежий. На локальной БД — stale (enrichment был давно).
**TODO:** refresh cron (A3) решит на проде. Локально — re-run enrichment.
