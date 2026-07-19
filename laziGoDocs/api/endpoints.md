# API Endpoints

Base URL: `https://api.lazigo.app/v1` (prod) / `http://localhost:3000/v1` (dev)

## Public

| Method | Path | Description |
|---|---|---|
| POST | `/recommendations` | Main discover endpoint (8 scored cards) |
| POST | `/recommendations/explain` | Dev: score decomposition per venue (60 results) |
| GET | `/recommendations/:sessionId/more` | Load more results for session |
| GET | `/recommendations/taste-profile` | Get user's taste profile (header: x-device-id) |
| PATCH | `/recommendations/taste-profile` | Update/reset taste profile |
| POST | `/interactions` | Log interaction (save, hide, route, share, etc.) |
| POST | `/interactions/batch` | Batch interaction events |
| POST | `/feedback` | Submit user feedback |
| GET | `/cards/:type/:id` | Detail card (place or event) |
| GET | `/og/:type/:id` | OpenGraph metadata for SSR |
| GET | `/meta/categories` | Interest category list |
| POST | `/auth/anon` | Create/restore anonymous user |
| GET | `/auth/me` | Get current user |
| PATCH | `/auth/me` | Update user profile |
| DELETE | `/auth/me` | Delete user data (GDPR) |

## Admin (require ADMIN_SECRET)

| Method | Path | Description |
|---|---|---|
| POST | `/admin/ingestion/osm` | Import venues from OpenStreetMap |
| POST | `/admin/ingestion/google-enrich?limit=N` | Google Places Pro match |
| POST | `/admin/ingestion/google-enrich-enterprise?limit=N` | Google Enterprise details |
| POST | `/admin/ingestion/google-enrich-atmosphere?limit=N` | Google Atmosphere details |
| POST | `/admin/ingestion/events/run` | Run all event adapters |
| POST | `/admin/ingestion/events/import` | Import events via push-model |
| POST | `/admin/ingestion/events/source/:name` | Run single adapter |
| GET | `/admin/ingestion/events/sources` | List event sources |
| POST | `/admin/ingestion/map-facets` | Map Google types to facets |
| POST | `/admin/ingestion/recalculate-idf` | Recalculate facet IDF values |
| POST | `/admin/ingestion/gemini-enrich?limit=N` | Gemini atmosphere enrichment |
| POST | `/admin/ingestion/sync-by-osm` | Sync enrichment data by osm_id |
| POST | `/admin/ingestion/fix-chains` | Mark chain venues |
| POST | `/admin/ingestion/translate-names` | Translate venue names |
| POST | `/health/migrate` | Run pending DB migrations |
| GET | `/health` | Health check |

## Key DTOs

### DiscoverRequestDto (POST /recommendations)
```json
{
  "lat": 41.749,
  "lng": 44.786,
  "radiusM": 5000,
  "timeWindow": { "from": "ISO", "to": "ISO" },
  "profile": {
    "interests": { "food": 1, "culture": 0.5 },
    "company": "couple",
    "hasPet": false,
    "localType": "local",
    "budgetMax": 50
  },
  "hiddenIds": ["uuid1", "uuid2"],
  "locale": "ru",
  "deviceIdHash": "cb5e734ba3ffdd0b"
}
```

### InteractionDto (POST /interactions)
```json
{
  "sessionId": "uuid",
  "cardType": "place",
  "cardId": "venue-uuid",
  "action": "save"
}
```
Actions: `save`, `hide`, `route`, `share`, `taxi`, `ticket_click`, `card_click`, `decide_open`

Legacy actions (logged but don't update taste profile): `impression`, `click`, `clickout`

DB: PostgreSQL enum `interaction_action` — extended in migration 019.
