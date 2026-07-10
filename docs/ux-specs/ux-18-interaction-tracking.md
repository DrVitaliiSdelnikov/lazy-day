# UX-18: Interaction Tracking — Kill/Scale Data

Priority: **pre-deploy (blocker for decisions)**
Effort: 2 hours

## Problem

Without interaction tracking, in 2 months there's no data for the kill/scale
decision. The key metric — "top-3 CTR → route built" — cannot be measured.
Migration 013 schema exists in docs but is not applied.

## What to track (MVP)

| Event | When | Key fields |
|---|---|---|
| `impression` | Card rendered in feed | card_position, card_id, card_type |
| `card_click` | User taps card → detail | card_position, card_id |
| `save` | Heart tap | card_id |
| `hide` | Swipe/button hide | card_id, context.reason (from UX-4 phase 2) |
| `route` | "Маршрут" button tap | card_id |
| `share` | Share action | card_id |
| `taxi` | Taxi button tap | card_id, context.provider (yandex/bolt) |

### Derived metrics (computed from raw events)

| Metric | Formula | Kill/scale threshold |
|---|---|---|
| Top-3 CTR | clicks on position 0-2 / impressions position 0-2 | ≥ 25% = scale |
| Route rate | route events / card_click events | ≥ 15% = scale |
| D1 return | sessions day N+1 / sessions day N | ≥ 15% |
| D7 return | sessions day N+7 / sessions day N | ≥ 10% |
| Save rate | save / impressions | health indicator |
| Hide rate | hide / impressions | < 10% = healthy |

## Implementation

### Database (migration 013)

Already designed in roadmap. Apply as-is:

```sql
CREATE TABLE interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id_hash TEXT NOT NULL,
  session_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  city_id TEXT NOT NULL DEFAULT 'tbilisi',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  card_position INT,
  score_breakdown JSONB,
  explanation_codes TEXT[],
  context JSONB,
  consent_state TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_ie_device ON interaction_events (device_id_hash);
CREATE INDEX idx_ie_target ON interaction_events (target_type, target_id);
CREATE INDEX idx_ie_occurred ON interaction_events (occurred_at);
```

### API endpoint

```
POST /v1/interactions
{
  sessionId: string,
  events: [{
    eventType: string,
    targetType: string,
    targetId: string,
    cardPosition?: number,
    context?: Record<string, unknown>
  }]
}
```

Batch endpoint — client buffers events and sends in batches (on page hide,
every 30s, or when buffer > 10 events).

### Frontend: InteractionService

```typescript
@Injectable({ providedIn: 'root' })
export class InteractionService {
  private buffer: InteractionEvent[] = [];
  private sessionId = crypto.randomUUID();
  private deviceId = this.getOrCreateDeviceId();

  track(event: Omit<InteractionEvent, 'sessionId' | 'deviceId'>) {
    this.buffer.push({ ...event, sessionId: this.sessionId });
    if (this.buffer.length >= 10) this.flush();
  }

  constructor() {
    // Flush on page hide (mobile: tab switch, app background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
    // Periodic flush
    setInterval(() => this.flush(), 30000);
  }

  private flush() {
    if (!this.buffer.length) return;
    const events = [...this.buffer];
    this.buffer = [];
    navigator.sendBeacon('/v1/interactions',
      JSON.stringify({ sessionId: this.sessionId, events }));
  }
}
```

### Consent gate

Events are recorded with `consent_state` from localStorage flag (UX consent banner).
If consent = 'pending', still record but with `device_id_hash = 'anonymous'` —
aggregate metrics work, per-user re-ranking doesn't.

## Files to create/modify

| File | Action |
|------|--------|
| `apps/api/src/app/database/migrations/013_interaction_events.sql` | create |
| `apps/api/src/app/interactions/interactions.module.ts` | create |
| `apps/api/src/app/interactions/interactions.controller.ts` | create |
| `apps/api/src/app/interactions/interactions.service.ts` | create |
| `src/app/core/services/interaction.service.ts` | create |
| `src/app/features/discover/discover.component.ts` | add tracking calls |
| `src/app/features/detail/detail.component.ts` | add tracking calls |
