# Redesign v2: Профиль, Избранное, Карточки

Только эти 4 компонента. Discover/sidebar/context-bar НЕ трогаем.

---

## Шаг 1: Result card — место (6.5)

**Файл**: `src/app/features/discover/result-card/result-card.component.ts`

Текущее → Ожидаемое:
- Title 14px → **17px / 700** (Manrope bold)
- Heart: `<ld-icon>` уже есть ✓. Добавить анимацию scale 1→1.2→1
- Meta: уже есть ✓
- Badges: использовать правильные `ld-badge--*` классы из спеки:
  - Статус "Открыто до 20:00" → `ld-badge--open`
  - "Вы любите: природа" → `ld-badge--primary`
  - "Pet friendly" → `ld-badge--secondary`
- Rating: `<ld-icon name="star-filled">` уже есть ✓. Цвет `--ld-warn`
- Padding 14-16px, radius 20, border + shadow ← использовать `ld-card` класс

## Шаг 2: Result card — событие (6.6)

**Файл**: тот же result-card

- Event stripe 4px `--ld-event` ← уже есть ✓
- Вечером stripe 5px ← `.theme-evening .card__stripe { width: 5px }` уже есть ✓
- Ticket icon в правом верхнем углу рядом с сердцем: `<ld-icon name="ticket">` цвет `--ld-event`
- Meta: "Опера · сегодня 19:00 · 1.2 км" ← уже есть ✓
- Price badge: "Билеты от 30 ₾" → `ld-badge--event`

## Шаг 3: Избранное (6.13)

**Файл**: `src/app/features/saved/saved.component.ts`

Текущее: простой список с title/meta/address.
Ожидаемое:
- Заголовок "Избранное" 20/700 + счётчик
- Segment control: Все / Места / События (ld-surface-2 контейнер)
- Использовать `app-result-card` вместо inline HTML
- Heart всегда filled → тап = удалить + undo toast
- Прошедшие события: приглушённые (opacity 0.75, bg surface-2, серая stripe)
- Empty: ld-icon zzz + "Пока пусто" + "Сердечко на карточке — и оно появится здесь" + кнопка "В ленту"

## Шаг 4: Профиль/Settings (6.14)

**Файл**: `src/app/features/settings/settings.component.ts`

Текущее: секции с чипами, базовый layout.
Ожидаемое:
- Строка доверия: lock icon + "Всё хранится на этом устройстве, без аккаунта"
- Секции в card surfaces (radius 18):
  1. "Мои интересы" — chips + ghost "Изменить"
  2. "Обычно я" — company icons + pet toggle
  3. "Тема" — segment (Авто/☀/🌙/Тёмная) + "Язык" segment (Рус/Eng/ქარ)
  4. Links: Конфиденциальность, О приложении
- Всё мгновенно, без "Сохранить"
- Desktop: центрированный max-width 640, 2 колонки

---

## Порядок выполнения

1. Result card (place) — title size, padding, badge colors
2. Result card (event) — ticket icon, price badge
3. Saved page — полный рефактор с result-card + segment control + empty
4. Settings — секции в cards, строка доверия, segment controls
