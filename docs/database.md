# База данных

PostgreSQL 16 + PostGIS. Подключение: `postgresql://lazyday:lazyday_dev@localhost:5432/lazyday`

## Таблицы

| Таблица | Назначение |
|---|---|
| `venues` | Физические точки (координаты, адрес, название) |
| `places` | POI-активности (категория, теги, рейтинг, часы работы) |
| `events` | События с датами (концерты, выставки, спектакли) |
| `source_items` | Сырые данные из источников (JSON payload) |
| `source_refs` | Связь canonical entity ↔ внешний ID |
| `interactions` | Действия пользователей (impression, click, save, hide) |
| `recommendation_logs` | Логи выдач для отладки и тюнинга |
| `dedup_candidates` | Очередь дублей на модерацию |
| `users` | Анонимные пользователи (profile, saved/hidden IDs, consent, device_ids) |
| `_migrations` | Трекинг прогнанных миграций |

## Миграции

Файлы: `apps/api/src/app/database/migrations/001_*.sql` — `015_*.sql`

```bash
npx tsx tools/run-migrations.ts
```

## Полезные запросы

```sql
-- Подключиться
docker compose -f docker/docker-compose.yml exec postgres psql -U lazyday -d lazyday

-- Проверить PostGIS
SELECT PostGIS_Version();

-- Проверить таблицы
\dt

-- Места в радиусе 2км от центра Тбилиси
SELECT p.id, v.name, p.category,
       ST_Distance(v.geom, ST_MakePoint(44.8271, 41.7151)::geography) AS dist_m
FROM places p
JOIN venues v ON p.venue_id = v.id
WHERE ST_DWithin(v.geom, ST_MakePoint(44.8271, 41.7151)::geography, 2000)
ORDER BY dist_m;

-- События на эту неделю
SELECT title, starts_at, status FROM events
WHERE status = 'scheduled' AND starts_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY starts_at;

-- Статистика
SELECT 'venues' AS t, COUNT(*) FROM venues
UNION ALL SELECT 'places', COUNT(*) FROM places
UNION ALL SELECT 'events', COUNT(*) FROM events;
```
