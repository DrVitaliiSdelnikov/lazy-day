# LaziGo — Categories & Taxonomy Analysis

*Полный аудит данных. 3,168 мест + 299 событий. Данные из локальной БД, 2026-07-18.*

## Текущие категории мест (OSM-based)

| Категория | Кол-во | % | Описание |
|---|---|---|---|
| restaurant | 1,220 | 38.5% | Рестораны, столовые |
| cafe | 736 | 23.2% | Кафе, кофейни |
| bar | 280 | 8.8% | Бары, пабы |
| viewpoint | 260 | 8.2% | Смотровые площадки, скульптуры, достопримечательности |
| bakery | 175 | 5.5% | Пекарни, кондитерские |
| gym | 134 | 4.2% | Спортзалы, фитнес |
| park | 101 | 3.2% | Парки, сады |
| museum | 77 | 2.4% | Музеи |
| gallery | 42 | 1.3% | Галереи |
| club | 36 | 1.1% | Ночные клубы |
| mall | 32 | 1.0% | ТЦ |
| theater | 32 | 1.0% | Театры |
| spa | 13 | 0.4% | Спа |
| entertainment | 11 | 0.3% | Развлечения |
| cinema | 11 | 0.3% | Кинотеатры |
| bath | 8 | 0.3% | Бани |

**Проблема:** 16 плоских категорий. Нет подкатегорий (кухня, формат, атмосфера).

---

## Google Types — подкатегории которые УЖЕ есть

Данные из `google_types[]` у 1,755 мест (55%). 227 уникальных типов.

### Еда: кухни мира (из google_types)

| Кухня | Кол-во | Google type |
|---|---|---|
| Восточноевропейская/Кавказская | 186 | `eastern_european_restaurant` |
| Пицца | 45 | `pizza_restaurant` |
| Азиатская (общая) | 30 | `asian_restaurant` |
| Американская | 29 | `american_restaurant` |
| Семейная | 28 | `family_restaurant` |
| Итальянская | 24 | `italian_restaurant` |
| Халяль | 23 | `halal_restaurant` |
| Ближневосточная | 31 | `middle_eastern_restaurant` |
| Гамбургеры | 20 | `hamburger_restaurant` |
| Вегетарианская | 19 | `vegetarian_restaurant` |
| Индийская | 19 | `indian_restaurant` |
| Шаурма | 19 | `shawarma_restaurant` |
| Европейская | 19 | `european_restaurant` |
| Японская | 14 | `japanese_restaurant` |
| Тайская | 12 | `thai_restaurant` |
| Веганская | 11 | `vegan_restaurant` |
| Китайская | 10 | `chinese_restaurant` |
| Турецкая | 9 | `turkish_restaurant` |
| Буфет | 7 | `buffet_restaurant` |
| Фьюжн | 6 | `fusion_restaurant` |
| Fine dining | 5 | `fine_dining_restaurant` |
| Ливанская | 5 | `lebanese_restaurant` |
| Французская | 4 | `french_restaurant` |
| Персидская | 4 | `persian_restaurant` |
| Суши | 4 | `sushi_restaurant` |
| Мексиканская | 4 | `mexican_restaurant` |
| Пельмени | 4 | `dumpling_restaurant` |
| Фалафель | 4 | `falafel_restaurant` |
| Азиатский фьюжн | 4 | `asian_fusion_restaurant` |
| Украинская | 3 | `ukrainian_restaurant` |
| Корейская | 3 | `korean_restaurant` |
| Барбекю | 3 | `barbecue_restaurant` |
| Морепродукты | 3 | `seafood_restaurant` |
| Средиземноморская | 3 | `mediterranean_restaurant` |
| Греческая | 3 | `greek_restaurant` |
| Тако | 3 | `taco_restaurant` |
| Стейк | 2 | `steak_house` |
| Вьетнамская | 2 | `vietnamese_restaurant` |
| Кебаб | 2 | `kebab_shop` |
| + ещё 15 кухонь | 1 каждая | african, basque, russian, spanish, hawaiian... |

### Еда: формат заведения

| Формат | Кол-во | Google type |
|---|---|---|
| Ресторан (общий) | 902 | `restaurant` |
| Кафе | 320 | `cafe` |
| Фастфуд | 124 | `fast_food_restaurant` |
| Пекарня | 114 | `bakery` |
| Завтраки | 31 | `breakfast_restaurant` |
| Бранч | 13 | `brunch_restaurant` |
| Десерты | 11 | `dessert_restaurant` + 31 `dessert_shop` |
| Бистро | 10 | `bistro` |
| Гастропаб | 7 | `gastropub` |
| Сэндвичи | 11 | `sandwich_shop` |
| Пончики | 17 | `donut_shop` |
| Мороженое | 9 | `ice_cream_shop` |
| Кондитерская | 32 | `confectionery` |
| Закусочная | 4 | `diner` |
| Фудкорт | 3 | `food_court` |

### Напитки

| Тип | Кол-во | Google type |
|---|---|---|
| Бар | 244 | `bar` |
| Кофейня | 141 | `coffee_shop` |
| Винный бар | 44 | `wine_bar` |
| Коктейль-бар | 33 | `cocktail_bar` |
| Паб | 16 | `pub` |
| Кальянная | 12 | `hookah_bar` |
| Спорт-бар | 9 | `sports_bar` |
| Лаунж-бар | 7 | `lounge_bar` |
| Чайная | 11 | `tea_house` |
| Пивоварня | 5 | `brewery` |
| Пивной сад | 2 | `beer_garden` |
| Кофе-обжарка | 8 | `coffee_roastery` |
| Кофе-стойка | 20 | `coffee_stand` |
| Винодельня | 4 | `winery` |
| Ирландский паб | 3 | `irish_pub` |
| Bar & grill | 10 | `bar_and_grill` |

### Культура и развлечения

| Тип | Кол-во | Google type |
|---|---|---|
| Музей | 35 | `museum` |
| Галерея | 20 | `art_gallery` |
| Арт-музей | 10 | `art_museum` |
| Исторический музей | 4 | `history_museum` |
| Театр | 26 | `performing_arts_theater` |
| Кинотеатр | 10 | `movie_theater` |
| Концертный зал | 7 | `concert_hall` |
| Live music | 31 | `live_music_venue` |
| Опера | 2 | `opera_house` |
| Караоке | 7 | `karaoke` |
| Культурный центр | 3 | `cultural_center` |
| Аудитория | 7 | `auditorium` |
| Event venue | 65 | `event_venue` |

### Спорт и активности

| Тип | Кол-во | Google type |
|---|---|---|
| Спорт-активности | 40 | `sports_activity_location` |
| Тренажёрный зал | 16 | `gym` |
| Спорт-комплекс | 14 | `sports_complex` |
| Спорт-клуб | 12 | `sports_club` |
| Бассейн | 10 | `swimming_pool` |
| Спорт-школа | 7 | `sports_school` |
| Фитнес | 5 | `fitness_center` |
| Спорт-тренировки | 4 | `sports_coaching` |
| Арена | 3 | `arena` |
| Каток | 2 | `ice_skating_rink` |
| Аквапарк | 1 | `water_park` |
| Теннис | 1 | `tennis_court` |
| Боулинг | 1 | `bowling_alley` |

### Отдых и природа

| Тип | Кол-во | Google type |
|---|---|---|
| Парк | 35 | `park` |
| Городской парк | 8 | `city_park` |
| Сад | 5 | `garden` |
| Скульптура | 20 | `sculpture` |
| Историческое место | 6 | `historical_place` |
| Историческая достопримечательность | 5 | `historical_landmark` |
| Мост | 1 | `bridge` |
| Замок | 1 | `castle` |
| Смотровая площадка | 1 | `observation_deck` |
| Площадь | 1 | `plaza` / `town_square` |
| Памятник | 2 | `monument` |

### Здоровье и красота

| Тип | Кол-во | Google type |
|---|---|---|
| Спа | 9 | `spa` |
| Баня | 10 | `public_bath` |
| Сауна | 3 | `sauna` |
| Массаж | 2 | `massage` / `massage_spa` |
| Велнес | 1 | `wellness_center` |

### Ночная жизнь

| Тип | Кол-во | Google type |
|---|---|---|
| Ночной клуб | 32 | `night_club` |
| Бар | 244 | `bar` |
| Лаунж | 7 | `lounge_bar` |
| Live music | 31 | `live_music_venue` |
| Караоке | 7 | `karaoke` |

### Прочее

| Тип | Кол-во | Google type |
|---|---|---|
| ТЦ | 22 | `shopping_mall` |
| Коворкинг | 8 | `coworking_space` |
| Библиотека | 20 | `library` |
| Книжный | 4 | `book_store` |
| Отель | 15 | `hotel` |
| Хостел | 1 | `hostel` |
| Площадки для мероприятий | 65 | `event_venue` |
| Достопримечательность | 42 | `tourist_attraction` |

---

## Google Attributes (boolean) — атмосфера

Данные из `attributes` (Google Atmosphere enrichment). Только локально, 0 на проде.

| Атрибут | С данными | Да (true) | Нет (false) | % true |
|---|---|---|---|---|
| goodForChildren | 1,210 | 1,112 | 98 | 92% |
| restroom | 1,188 | 1,150 | 38 | 97% |
| liveMusic | 777 | 228 | 549 | 29% |
| outdoorSeating | 744 | 550 | 194 | 74% |
| wheelchairAccessibleEntrance | 609 | 341 | 268 | 56% |
| allowsDogs | 524 | 295 | 229 | 56% |
| wheelchairAccessibleParking | 523 | 254 | 269 | 49% |

**Не запрашиваем но доступны в Google API (Atmosphere tier):**
- `reservable`, `dineIn`, `takeout`, `delivery`, `curbsidePickup`
- `servesBeer`, `servesWine`, `servesCocktails`, `servesCoffee`
- `servesBreakfast`, `servesBrunch`, `servesLunch`, `servesDinner`, `servesDessert`
- `servesVegetarianFood`
- `goodForGroups`, `goodForWatchingSports`
- `parkingOptions`, `paymentOptions`
- `menuForChildren`

---

## Категории событий

| Категория | Кол-во | Источники |
|---|---|---|
| music | 185 | tkt.ge (115), biletebi.ge (54), yolo.ge (16) |
| theater | 48 | tkt.ge (20), biletebi.ge (22), opera.ge (3), yolo.ge (3) |
| entertainment | 24 | tkt.ge (20), yolo.ge (4) |
| family | 13 | tkt.ge (13) |
| exhibition | 12 | google_events (12) |
| culture | 9 | tkt.ge (9) |
| sports | 8 | tkt.ge (8) |

### Теги событий

| Тег | Кол-во |
|---|---|
| music | 186 |
| concert | 181 |
| entertainment | 150 |
| culture | 77 |
| theater | 52 |
| outdoor | 33 |
| nightlife | 17 |
| exhibition | 15 |
| family | 13 |
| festival | 10 |
| workshop | 9 |
| sports | 8 |
| ballet | 2 |
| opera | 1 |
| jazz | 1 |

---

## Предлагаемая таксономия (маппинг google_types → категории)

### Уровень 1: Основные категории (для UI фильтров)

```
food        → restaurant, cafe, bakery, fast_food, dessert, food_court
drinks      → bar, pub, coffee_shop, tea_house, wine_bar, cocktail_bar, brewery
nightlife   → night_club, lounge_bar, hookah_bar, live_music_venue, karaoke
culture     → museum, gallery, theater, cinema, concert_hall, opera_house, library
nature      → park, garden, viewpoint, scenic_spot, observation_deck
active      → gym, sports_complex, swimming_pool, bowling, skating, water_park
wellness    → spa, bath, sauna, massage
family      → playground, amusement_park, amusement_center, water_park
shopping    → mall, market, flea_market
events      → event (from events table)
```

### Уровень 2: Подкатегории (для детализации)

**food:**
- by_cuisine: georgian, italian, japanese, asian, indian, turkish, chinese, thai, mexican, french, korean, mediterranean, middle_eastern, american, vegetarian, vegan, halal, fusion, ...
- by_format: restaurant, cafe, fast_food, bakery, bistro, gastropub, fine_dining, buffet, diner, food_court, dessert_shop
- by_meal: breakfast, brunch, lunch, dinner

**drinks:**
- coffee_shop, tea_house, bar, pub, wine_bar, cocktail_bar, sports_bar, hookah_bar, lounge_bar, beer_garden, brewery, winery, irish_pub

**nightlife:**
- night_club, live_music, karaoke, lounge

**culture:**
- museum, art_museum, history_museum, gallery, theater, cinema, concert_hall, opera, cultural_center, library

**active:**
- gym, fitness, swimming, tennis, bowling, skating, water_park, sports_club, climbing, arena

### Уровень 3: Атрибуты (фильтры/бейджи)

**Из Google (structured, бесплатно):**
- pet_friendly (allowsDogs)
- kid_friendly (goodForChildren)
- outdoor_seating (outdoorSeating)
- live_music (liveMusic)
- wheelchair (wheelchairAccessibleEntrance)
- has_restroom (restroom)

**Нужен LLM или доп. enrichment:**
- cozy, romantic, work_friendly, group_friendly
- date_spot, business_lunch, solo_friendly
- scenic_view, instagram_worthy
- budget, mid_range, upscale, luxury (price_tier)

---

## Coverage gaps

| Данные | Есть | Нет | % gap |
|---|---|---|---|
| google_types (подкатегории) | 1,755 | 1,413 | 45% |
| price_level | 0 | 3,168 | 100% |
| allowsDogs | 524 | 2,644 | 83% |
| goodForChildren | 1,210 | 1,958 | 62% |
| outdoorSeating | 744 | 2,424 | 77% |
| liveMusic | 777 | 2,391 | 75% |
| cuisine (from google_types) | ~600 | ~2,568 | 81% |

**Приоритеты заполнения:**
1. `price_level` — добавить в Enterprise field mask (бесплатно в рамках текущего enrichment)
2. Atmosphere enrichment на проде (allowsDogs, goodForChildren и др.) — sync из локальной БД
3. Google types для оставшихся 45% — нужен enrichment sync (osm_id)
4. Atmosphere/occasion теги (cozy, romantic...) — LLM, Phase 2
