# LazyDay — набор иконок (Tabler Icons v3.44, MIT)

Все иконки — stroke `currentColor`: цвет наследуется из CSS, красятся токенами `--ld-*`.
Размеры в дизайне: табы 22–24 px, чипы 16 px, метаданные/бейджи 13–14 px, detail-плашка 40 px.

## Маппинг: где какая иконка

### Навигация и служебные (`outline/`)
| Файл | Где | Цвет |
|---|---|---|
| compass | таб «Лента» | активный `--ld-primary`, иначе `--ld-text-3` |
| heart | таб «Избранное», сердце на карточке (не сохранено) | `--ld-text-3` |
| user | таб «Профиль», компания «один» | по состоянию |
| arrow-left | назад (detail, онбординг) | `--ld-text` |
| x | закрыть sheet/модалку | `--ld-text-2` |
| chevron-down | collapsible «часы работы» | `--ld-text-2` |
| adjustments-horizontal | кнопка «Фильтры» (мобайл) | `--ld-text` |
| refresh | «Повторить» в error state | `--ld-primary` |

### Контекст и темы
| Файл | Где | Цвет |
|---|---|---|
| map-pin | пилюля локации, сайдбар | `--ld-primary` |
| clock | пилюля времени «Сейчас» | `--ld-primary` |
| sun / moon | переключатель темы в header; moon — вечерняя пилюля времени | `--ld-text-2` / `--ld-secondary` |

### Mood-пресеты и категории
| Файл | Пресет |
|---|---|
| trees | Прогулка / Природа |
| coffee | Кофе |
| balloon | С детьми / компания «семья» |
| run | Активно |
| tools-kitchen-2 | Поесть / Ужин |
| masks-theater | Культура |
| moon | Выйти (вечер) |
| glass-cocktail | Бар |
| music | Музыка |
| movie | Кино |
| hearts | Романтика / компания «пара» |

Цвет: активный чип — `--ld-on-primary-soft` (день) / `--ld-on-primary` (вечер, solid); неактивный — `--ld-text-2`.

### Карточки и действия
| Файл | Где | Цвет |
|---|---|---|
| ticket | событие (угол карточки, CTA «Билеты») | `--ld-event` |
| star | рейтинг | `--ld-warn` |
| share-2 | «Поделиться» | `--ld-text-2` |
| route | «Маршрут» (deeplink в карты) | `--ld-primary` |
| eye-off | «Скрыть» (swipe, detail) | `--ld-danger` |
| dog | toggle «С питомцем» | `--ld-secondary` |
| users | компания «друзья» | по состоянию |
| zzz | empty state | `--ld-text-3` |

### Filled (`filled/`) — активные состояния
| Файл | Где |
|---|---|
| heart | сохранено: `--ld-heart`, анимация scale 1→1.2→1 |
| star | альтернатива для рейтинга, если outline сливается |

## Подключение в Angular

Вариант А (рекомендую): пакет `@tabler/icons` + inline `<svg>` через свой `ld-icon` компонент — тришейкается, красится CSS.
Вариант Б: webfont `@tabler/icons-webfont` — проще, но тянет весь шрифт (~100 KB woff2).

```html
<!-- пример: сердце на карточке -->
<svg class="ld-icon" [class.saved]="isSaved()" width="20" height="20">...</svg>
```
```css
.ld-icon { color: var(--ld-text-3); }
.ld-icon.saved { color: var(--ld-heart); }
```
