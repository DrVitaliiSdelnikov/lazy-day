# LazyDay — иконка приложения

Концепция: «ленивый пин» — map-пин прилёг набок и дремлет (z-z).
Место + лень в одном знаке. Цвета дневной темы: #E8862D / #F29A44 / #FFF9EF.

## Файлы и назначение

| Файл | Куда |
|---|---|
| icon.svg | мастер, favicon для современных браузеров (`rel="icon" type="image/svg+xml"`) |
| icon-512.png, icon-192.png | manifest, `purpose: "any"` |
| icon-maskable-512.png, icon-maskable-192.png | manifest, `purpose: "maskable"` (safe zone 75%) |
| apple-touch-icon.png (180) | iOS homescreen, полный квадрат без скруглений |
| favicon.ico (16+32+48) | легаси-браузеры; 16px — упрощённый пин без лица |
| icon-mono.svg | Safari pinned tab (`rel="mask-icon"`), бейджи уведомлений; `currentColor` |

## index.html

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="mask-icon" href="/icons/icon-mono.svg" color="#E8862D">
<meta name="theme-color" content="#FAF6ED">
```

## manifest.webmanifest

```json
"icons": [
  { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
],
"background_color": "#FAF6ED",
"theme_color": "#E8862D"
```

Для OG-image (1200×630, пункт 17 roadmap) используйте мастер-SVG слева + логотип
LazyDay (Unbounded 500, #E8862D) и слоган на #FAF6ED — соберу по запросу.
