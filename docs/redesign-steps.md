# Redesign: пошаговая реализация (expected vs actual)

## Проблемы из скриншотов

### Mobile
1. Фон розовый (evening) — нужен day по умолчанию для дневного тестирования
2. Tab bar — иконки HTML entities (★♥⚙) вместо Tabler SVG ← FIXED
3. Бейджи красные (evening primary) — должны быть мёдовые (day primary-soft)
4. "Всё" чип — круглый красный filled, должен быть pill на surface-2
5. Нет event stripe на карточке событий в ленте

### Desktop (≥1024px)
6. Нет sidebar — фильтры в строку над лентой
7. Нет top nav bar — tab bar снизу как на мобиле
8. Нет hover эффекты на карточках

---

## Шаги реализации

### Шаг 1: Фон темы — исправить автопереключение
**Файл**: `src/app/core/services/theme.service.ts`
**Проблема**: Тбилиси UTC+4, ночью = evening тема. При тестировании днём тоже может попасть в evening.
**Решение**: Проверить `isEvening()` логику. Сейчас правильная, но нужно добавить ручной override в settings. ThemeService уже есть — убедиться что `ProfileStore.theme` интегрирован.
**Файл**: `src/index.html` — inline скрипт определения темы уже есть.

### Шаг 2: "Всё/Места/События" — стиль active чипа
**Файл**: `src/app/features/discover/discover.component.ts` — стили
**Проблема**: Active "Всё" = круглый красный filled. Expected: pill на `--ld-surface` внутри `--ld-surface-2` контейнера (как сегмент-контрол).
**Решение**: Обернуть type-filter чипы в `--ld-surface-2` контейнер с radius. Active = `--ld-surface` + тень. Не использовать `ld-chip--active` стиль.

### Шаг 3: Event stripe на карточке
**Файл**: `src/app/features/discover/result-card/result-card.component.ts`
**Проблема**: Event stripe code есть (`.card__stripe`) но может не рендериться если event не попадает в текущую выдачу.
**Решение**: Проверить что stripe отображается. Цвет = `--ld-event`. Ширина 4px (day), 5px (evening).

### Шаг 4: Desktop top nav bar (≥1024px)
**Файл**: `src/app/core/layout/app-shell.component.ts`
**Что добавить**:
- `@media (min-width: 1024px)`: скрыть bottom tab bar
- Показать top nav: логотип "LaziGo" (Unbounded, `--ld-primary`) слева, табы "Лента / Избранное / Профиль" справа (текст, active = underline `--ld-primary`)
- Переключатель темы (sun/moon иконка)

**HTML**:
```html
<header class="shell__topnav">
  <span class="shell__logo ld-display">LaziGo</span>
  <nav class="shell__topnav-tabs">
    <a routerLink="/discover" routerLinkActive="active">Лента</a>
    <a routerLink="/saved" routerLinkActive="active">Избранное</a>
    <a routerLink="/settings" routerLinkActive="active">Профиль</a>
  </nav>
</header>
```

**CSS**:
```css
.shell__topnav { display: none; }
@media (min-width: 1024px) {
  .shell__topnav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 24px;
    background: var(--ld-surface);
    border-bottom: 1px solid var(--ld-border);
  }
  .shell__nav { display: none; } /* hide bottom tab bar */
}
```

### Шаг 5: Desktop sidebar (≥1024px)
**Файл**: `src/app/features/discover/discover.component.ts`
**Что добавить**:
- `@media (min-width: 1024px)`: обернуть discover в flex layout
- Слева: sidebar 280px (sticky) с секциями: Локация, Секции, Категории, Компания, Питомец, Сбросить
- Справа: greeting + mood presets + card grid
- Sidebar использует те же данные что context-bar/filter-sheet но рендерит inline (не в sheet)

**HTML** (добавить в template discover):
```html
<aside class="discover__sidebar">
  <!-- Location -->
  <!-- Radius slider -->
  <!-- Type filter (vertical) -->
  <!-- Category chips -->
  <!-- Company icons -->
  <!-- Pet toggle -->
  <!-- Reset link -->
</aside>
```

**CSS**:
```css
.discover__sidebar { display: none; }
@media (min-width: 1024px) {
  .discover { display: flex; }
  .discover__sidebar {
    display: block;
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid var(--ld-border);
    padding: 16px;
    background: var(--ld-surface);
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }
  .discover__main { flex: 1; min-width: 0; }
}
```

### Шаг 6: Бейджи — правильные цвета
**Файл**: `src/app/features/discover/result-card/result-card.component.ts`
**Проблема**: Все бейджи используют `ld-badge--primary` = красный в evening.
**Решение**: badgeClass() уже маппит типы → классы. Проверить что:
- `open_now` → `ld-badge--open` (зелёный) ✓
- `matches_interest` → `ld-badge--primary` (мёдовый day / красный evening) ✓
- `pet_friendly`, `company_fit` → `ld-badge--secondary` (фисташковый) ✓
- `walk_time` → нужен отдельный стиль или использовать primary-soft

### Шаг 7: Карточки — hover на десктопе
**Файл**: `src/styles.scss`
**Уже есть**: `.ld-card` имеет `@media (hover: hover)` с translateY и shadow.
**Проверить**: что result-card использует класс `ld-card`.

### Шаг 8: Скрыть context bar на десктопе
**Файл**: `src/app/features/discover/context-bar/context-bar.component.ts`
**Решение**: `@media (min-width: 1024px) { :host { display: none; } }` — sidebar заменяет context bar.

### Шаг 9: Grid карточек — 2 колонки на десктопе
**Файл**: `src/app/features/discover/discover.component.ts` — стили
**Уже есть**: grid responsive. Проверить что работает с sidebar layout.
**Нужно**: `grid-template-columns: repeat(2, 1fr)` на ≥1024 (не 3 — с sidebar места меньше).

---

## Порядок выполнения

1. Шаг 4 — top nav bar (structural, affects layout)
2. Шаг 5 — desktop sidebar (biggest change)
3. Шаг 8 — hide context bar on desktop
4. Шаг 9 — grid adjustment
5. Шаг 2 — type filter segment control style
6. Шаг 3 — verify event stripe
7. Шаг 6 — badge colors verify
8. Шаг 7 — hover verify
9. Шаг 1 — theme verify
