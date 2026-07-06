# API Endpoints

Base URL: `http://localhost:3000/v1`

## Health

```
GET /v1/health
→ { status: "ok"|"degraded", db: "ok"|"down", uptime: number }
```

## Recommendations

```
POST /v1/recommendations
Headers: X-Device-Id: <uuid>
Body: {
  lat: number,              // обязательно
  lng: number,              // обязательно
  radiusM?: number,         // default 5000, min 100, max 50000
  timeWindow: {
    from: string,           // ISO datetime
    to: string
  },
  profile: {
    interests: Record<string, number>,   // slug → weight (0-1)
    company?: "solo"|"couple"|"family"|"friends",
    budgetMax?: number      // GEL
  },
  hiddenIds?: string[],
  locale: "ru"|"en"|"ka"
}
→ { sessionId, cards: RecommendationCard[], hasMore: boolean }
```

```
GET /v1/recommendations/:sessionId/more
→ { sessionId, cards: [], hasMore: false }
```

## Cards

```
GET /v1/cards/:type/:id
type: "place" | "event"
→ Place | Event (с venue relation)
```

## Interactions

```
POST /v1/interactions
Headers: X-Device-Id: <uuid>
Body: {
  sessionId: string,
  cardType: "place"|"event",
  cardId: uuid,
  action: "impression"|"click"|"save"|"hide"|"share"|"clickout",
  context?: {}
}
→ { ok: true }
```

## Meta

```
GET /v1/meta/categories?locale=ru
→ CategoryNode[] (дерево: food, culture, entertainment, outdoor, shopping, wellness)
```

## Admin (internal)

```
POST /v1/admin/ingestion/osm
→ { imported: number, skipped: number, errors: number }
```

Триггерит OSM import из Overpass API → venues + places в PostgreSQL.

## Rate Limits (будущее)

| Endpoint | Лимит |
|---|---|
| recommendations | 20 req/min |
| cards | 60 req/min |
| interactions | 100 req/min |
| meta | 10 req/min |
