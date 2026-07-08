# Pre-Deploy Strategy: SEO → Behavioral → Social

Research from general (SEO foundation) to specific (social growth loops).

---

## Part 1: SEO — Фундамент видимости

### Проблема

Angular SPA = Google видит `<div id="app"></div>`. Без рендеренного HTML контента Google не может проиндексировать ни одну страницу. Нулевой органический трафик.

### Три подхода к рендерингу

| Подход | Как работает | Плюсы | Минусы | Для нас |
|---|---|---|---|---|
| **Client-side (текущее)** | JS рендерит в браузере | Простота | SEO = 0, боты не видят контент | Не годится |
| **Prerendering (build-time)** | HTML генерируется при сборке для известных URL | Быстро, дёшево, CDN-friendly | Только для статических/полустатических страниц | **Для landing, category pages** |
| **SSR (@angular/ssr)** | Node-сервер рендерит на лету | Полная SEO, динамический контент | Нужен Node-сервер, сложнее деплой | **Для event/venue pages** |

### Рекомендация: Hybrid

- **Prerender** (build-time): landing page, about, category landing pages ("Parks in Tbilisi")
- **SSR** (server): event pages (`/event/:id`), venue pages (`/place/:id`) — у каждого уникальный URL с meta tags
- **SPA** (client): personalized feed (`/discover`), settings, saved — НЕ индексируются

Angular 21 нативно поддерживает hybrid: `project.json` → `outputMode: "server"` вместо `"static"`. Cloudflare Workers или Hetzner VPS для SSR.

### Минимум до deploy (без SSR)

Даже без полного SSR можно сделать базовый SEO:

**1. `robots.txt`**
```
User-agent: *
Allow: /
Disallow: /discover
Disallow: /settings
Disallow: /saved

Sitemap: https://lazyday.app/sitemap.xml
```

**2. `sitemap.xml`** (статический для MVP)
```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://lazyday.app/</loc><changefreq>daily</changefreq></url>
  <url><loc>https://lazyday.app/about</loc></url>
</urlset>
```
Динамический (v1): генерировать из events + venue categories на сервере.

**3. Meta tags на `index.html`**
```html
<title>LazyDay — What to do in Tbilisi</title>
<meta name="description" content="Personalized leisure discovery in Tbilisi. Find places, events, restaurants matched to your mood, company, and time.">
<meta property="og:title" content="LazyDay — What to do in Tbilisi">
<meta property="og:description" content="Your lazy guide to the best of Tbilisi">
<meta property="og:image" content="https://lazyday.app/og-image.png">
<meta property="og:url" content="https://lazyday.app">
<meta name="twitter:card" content="summary_large_image">
```

**4. Event JSON-LD** (критично — Google Events rich results)

На event detail pages (`/detail/event/:id`) вставлять:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Ricky Martin Concert",
  "startDate": "2026-07-16T19:00:00+04:00",
  "endDate": "2026-07-16T22:00:00+04:00",
  "location": {
    "@type": "Place",
    "name": "Tbilisi Autodrome",
    "address": { "@type": "PostalAddress", "addressLocality": "Tbilisi", "addressCountry": "GE" }
  },
  "offers": { "@type": "Offer", "url": "https://tkt.ge/...", "priceCurrency": "GEL" }
}
</script>
```
Требует SSR или prerendering. Без рендеренного HTML — Google не увидит JSON-LD.

**Вывод по SEO**: для MVP deploy без SSR — сделать robots.txt, sitemap, meta tags на index.html. Это даст минимальную видимость. Полный SEO (event pages, venue pages с JSON-LD) — требует SSR, это v1 задача.

---

## Part 2: Behavioral Data — Фундамент персонализации

### Что собираем (по приоритету)

| Signal | Когда | Ценность | Реализация |
|---|---|---|---|
| **Click** (открыл detail) | При переходе на /detail | Высокая — интерес подтверждён | POST /v1/interactions `action: 'click'` |
| **Save** (сердечко) | При тапе save | Высокая — явное намерение | Уже работает через ProfileStore |
| **Hide** (скрыть) | При dismiss карточки | Высокая — негативный сигнал | Уже работает через ProfileStore |
| **Session context** | При каждом запросе | Средняя — что искал, когда | Логировать в recommendation_logs |
| **Dwell time** | Время на detail page | Средняя — 3 сек = скроллнул, 30 сек = заинтересовался | Frontend timer → interaction |
| **Visited** ("был тут") | Явная кнопка | Высокая — факт, не намерение | Новый action type |
| **Explanation click** | Какой чип привлёк | Низкая но полезная — "pet friendly" drove click? | Frontend event |

### Идентификация пользователей

| Метод | Privacy | Cross-device | Для нас |
|---|---|---|---|
| Device UUID (текущее) | Хорошо — нет PII | Нет | **MVP** |
| Optional email account | Нужен consent | Да | v1 |
| Social login (Google/Apple) | Нужен consent | Да | v2 |

**Для MVP**: device UUID достаточно. Один телефон = один профиль. Без PII = минимальный GDPR risk. Но всё равно нужен consent banner (GDPR требует consent для любого tracking, даже anonymous).

### GDPR compliance (минимум)

1. **Consent banner** при первом открытии: "We use anonymous usage data to improve recommendations. [Accept] [Decline]"
2. Если declined — не отправлять interactions, не логировать session context
3. Хранить consent choice в localStorage
4. Privacy policy page (статическая) с описанием что собираем

Грузия не в EU, но:
- Туристы из EU используют приложение
- Google Play / App Store требуют privacy policy
- Best practice = GDPR-compliant by default

### Как signals влияют на scoring (фазы)

**Phase 1 (deploy)**: Только собираем. Scoring не меняем. Копим данные.

**Phase 2 (после 1000+ interactions)**: Простой re-ranking:
```
userBoost = clickedCategories.includes(candidate.category) ? 1.15 : 1.0
userPenalty = hiddenCategories.includes(candidate.category) ? 0.7 : 1.0
adjustedScore = baseScore × userBoost × userPenalty
```

**Phase 3 (после 10000+ interactions)**: Collaborative filtering — "users who liked X also liked Y". Нужны реальные данные.

### Storage

```sql
-- interactions table already exists, extend:
ALTER TABLE interactions ADD COLUMN dwell_seconds INT;
ALTER TABLE interactions ADD COLUMN explanation_type TEXT;
ALTER TABLE interactions ADD COLUMN session_interests JSONB;

-- Aggregated profile (materialized, refreshed hourly/daily):
CREATE TABLE user_profiles (
  device_id TEXT PRIMARY KEY,
  clicked_categories JSONB DEFAULT '{}',   -- { "park": 12, "restaurant": 5 }
  hidden_categories JSONB DEFAULT '{}',
  saved_count INT DEFAULT 0,
  visited_count INT DEFAULT 0,
  preferred_time TEXT,                      -- 'evening', 'morning', 'weekend'
  preferred_radius INT,
  last_active TIMESTAMPTZ
);
```

---

## Part 3: Social & Growth — Фундамент вирусности

### Viral loop для LazyDay

```
User finds cool place → Saves to collection → Shares link with friend
  → Friend opens link → Sees place + "Install LazyDay for more"
    → Friend installs → Finds their own places → Shares → ...
```

Каждый шаг должен быть **1 tap**. Friction = loop breaks.

### Feature ladder (от простого к сложному)

**Уровень 0 (deploy)**: ничего social, всё локальное.

**Уровень 1 (v1, 2 недели)**:
- **Share single place/event** → URL с OG preview → "Ricky Martin Concert — LazyDay"
- Не нужен аккаунт. Просто кнопка "Поделиться" → native share sheet
- Получатель видит web preview (OG tags) → при открытии — detail page

**Уровень 2 (v1, 4 недели)**:
- **Collections**: "Мой вечер", "Для гостей из Москвы" → список мест/events
- Share collection → URL → web page со списком
- Не нужен аккаунт для создания (localStorage). Нужен для sharing (генерация URL)

**Уровень 3 (v2)**:
- **"Был тут"** badge → видно на карточке "12 людей были тут"
- **Micro-tips**: "Лучший стол — у окна" (140 chars, модерация)
- Optional account для tips (spam prevention)

**Уровень 4 (v2-v3)**:
- Friend graph: "Подруга сохранила это место"
- Curator profiles: "Гид по Тбилиси от @nino"
- Gamification: "Исследователь Ваке" badge

### Share implementation (уровень 1)

Минимальный share flow:
```typescript
// Frontend
async share(card: RecommendationCard) {
  const url = `https://lazyday.app/detail/${card.type}/${card.id}`;
  if (navigator.share) {
    await navigator.share({ title: card.title, url });
  } else {
    navigator.clipboard.writeText(url);
  }
}
```

Нужно: detail page с OG meta tags (требует SSR или prerendering для этой страницы).

### Метрики роста

| Metric | Target (month 1) | Target (month 3) |
|---|---|---|
| Daily active users | 50 | 500 |
| Share rate (% sessions with share) | 2% | 5% |
| Viral coefficient (new users per share) | 0.1 | 0.3 |
| Return rate (day 7) | 15% | 30% |
| Saves per user per session | 0.5 | 1.5 |

### Growth channels (не social features, а distribution)

1. **Organic search** → SEO (Part 1)
2. **Word of mouth** → share links (this section)
3. **Content marketing** → "Weekend in Tbilisi" guides → blog/landing pages
4. **Telegram channels** → post LazyDay picks in local channels
5. **Hotel/hostel partnerships** → QR code "What to do today?" in lobbies

---

## Implementation Roadmap

### Before deploy (1-2 days)

| Task | Effort |
|---|---|
| `public/robots.txt` | 10 min |
| Meta tags + OG on `index.html` | 30 min |
| Privacy policy page (static) | 1 hour |
| Consent banner (localStorage flag) | 1 hour |
| Verify interactions API tracks click/save/hide | 30 min |

### Week 1 after deploy

| Task | Effort |
|---|---|
| Dynamic sitemap endpoint (`/sitemap.xml`) | 2 hours |
| Share button on cards + detail page (native share) | 2 hours |
| Google Search Console registration | 30 min |
| Analytics: basic page views (Plausible/Umami, privacy-friendly) | 1 hour |

### Week 2-4 after deploy (v1 sprint)

| Task | Effort |
|---|---|
| SSR for detail pages (event/venue with JSON-LD) | 2-3 days |
| Collections (create, save to, share link) | 3-4 days |
| user_profiles aggregation table | 1 day |
| Behavioral re-ranking (Phase 2, simple boost/penalty) | 1 day |
| "Visited" button + badge | 1 day |

---

## Sources

- [Angular SSR Guide](https://angular.dev/guide/ssr)
- [Angular SSR Best Practices](https://angular.dev/best-practices/performance/ssr)
- [Angular SEO Strategy](https://www.stackmatix.com/blog/angular-seo-prerendering-strategy)
- [GDPR Consent for Behavioral Tracking](https://www.reform.app/blog/gdpr-consent-for-behavioral-tracking)
- [GDPR Mobile App Compliance 2026](https://secureprivacy.ai/blog/gdpr-compliance-mobile-apps)
- [Google Event Schema Markup](https://developers.google.com/search/docs/appearance/structured-data/event)
- [LocalBusiness Structured Data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Viral Growth Loops 2026](https://wezom.com/blog/how-to-make-a-mobile-app-go-viral-in-2025-proven-growth-strategies)
- [Social Discovery Trends](https://www.marketingdive.com/spons/the-new-rules-of-social-discovery-and-distribution/811750/)
