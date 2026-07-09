# Redesign v4: Splash Loader + Welcome + Onboarding

## Шаг 1: Splash Loader

**Файл**: `src/index.html`
- Вставить SVG анимацию внутрь `<app-root>` (Angular автоматически удалит при bootstrap)
- Стили + theme script инлайн в `<head>` (до бандла)
- "Дремлющий пин" с Z-z-z, качается, тень дышит
- Текст: "LazyDay" + "Просыпаемся…" (пульсирует)
- Поддержка prefers-reduced-motion

## Шаг 2: Welcome Screen (step 0, первый запуск)

**Файл**: новый `src/app/features/discover/welcome/welcome.component.ts`
- Иконка 88px (из lazyday-app-icon/icon.svg или inline SVG)
- Логотип Unbounded "LaziGo" 22px
- Слоган "Куда сходить в Тбилиси — без раздумий"
- Value prop карточка (3 строки с иконками)
- CTA Primary "Начать · 30 секунд"
- Ghost "Лень отвечать — просто покажи ленту" → skip to discover
- Строка доверия "Без аккаунта · всё хранится на устройстве"
- Показывается ОДИН раз (flag `ld_welcome_done` в localStorage)
- Route: `/discover/welcome` → после CTA → `/discover/onboarding`
- Desktop: двухколоночный hero layout

## Шаг 3: Onboarding Interests (step 1)

**Файл**: `src/app/features/discover/onboarding/onboarding.component.ts`
- Progress pills (активная вытянутая 20×6, остальные 6×6)
- "Пропустить" вверху справа
- Display заголовок Unbounded "Что вам по душе?"
- Подзаголовок "Хотя бы одно — можно поменять потом"
- Grid 2 col: карточки-чипы с иконкой 18px + label
- Выбранная: primary-soft bg + primary border 1.5px + check icon в углу
- CTA с живым счётчиком: "Дальше · выбрано N"
- CTA disabled если 0 выбрано + подпись "Выберите хотя бы одно"
- Desktop: 560px центрированная карточка, grid 4 col

## Порядок

1. Splash в index.html
2. Welcome component + route
3. Onboarding redesign
