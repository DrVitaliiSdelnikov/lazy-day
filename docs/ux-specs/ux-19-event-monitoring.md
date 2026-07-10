# UX-19: Event Source Monitoring

Priority: **pre-deploy**
Effort: 1-2 hours

## Problem

Event cron runs daily at 06:00 Tbilisi. If a source site goes down or changes
HTML structure, events silently disappear. If this lasts a week, the evening
anchor habit is broken — users see "no events" and stop coming back.

## Solution

### Health check after each cron run

In `event-cron.service.ts`, after running all adapters:

```typescript
async checkSourceHealth() {
  const sources = ['opera_ge', 'google_events', 'yolo_ge'];

  for (const source of sources) {
    const count = await this.repo.count({
      where: {
        source,
        created_at: MoreThan(new Date(Date.now() - 48 * 3600 * 1000)),
      },
    });

    if (count === 0) {
      this.logger.error(`[EVENT ALERT] Source "${source}" returned 0 events in last 48h`);
      await this.sendAlert(source);
    }
  }
}
```

### Alert channel

Same as UX-14 feedback: Telegram bot notification.

```typescript
private async sendAlert(source: string) {
  const text = `⚠️ Event source "${source}" — 0 events in 48h. Check adapter.`;
  // reuse feedback telegram forwarding
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
}
```

### API health endpoint extension

`GET /v1/health` — add event source freshness:

```json
{
  "status": "ok",
  "db": "ok",
  "events": {
    "opera_ge": { "last48h": 8, "status": "ok" },
    "google_events": { "last48h": 15, "status": "ok" },
    "yolo_ge": { "last48h": 0, "status": "stale" }
  }
}
```

### Adapter error handling

Each adapter should catch errors and log, not crash the entire cron:

```typescript
try {
  const events = await adapter.fetch();
  // ...
} catch (e) {
  this.logger.error(`Adapter ${name} failed: ${e.message}`);
  // Don't rethrow — other adapters should still run
}
```

This is likely already the case but verify.

## Files to modify

| File | Action |
|------|--------|
| `apps/api/src/app/ingestion/event-cron.service.ts` | add health check after run |
| `apps/api/src/app/health/health.controller.ts` | add event source status |
