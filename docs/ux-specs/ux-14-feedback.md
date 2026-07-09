# UX-14: User Feedback

Priority: **week 1**
Effort: 0.5-1 day

## Problem

No way for users to report issues, suggest places, or share ideas.
Without push notifications, feedback is the only direct channel.

## Entry points

1. **Profile** — "Обратная связь" link in settings section (primary).
2. **Empty state** — "Не нашли — расскажите, чего не хватило" ghost link.
   Category "Нет места" pre-selected.
3. **Error state** — "Сообщить о проблеме" ghost link.
   Category "Ошибка" pre-selected.

No floating button.

## UI: Bottom sheet

```html
<div class="feedback-sheet">
  <h3>Обратная связь</h3>

  <div class="feedback-sheet__categories">
    @for (cat of categories; track cat.key) {
      <button class="ld-chip" [class.ld-chip--active]="selected() === cat.key"
        (click)="selected.set(cat.key)">{{ cat.label }}</button>
    }
  </div>

  <textarea class="ld-input" placeholder="Что случилось?"
    [(ngModel)]="text" rows="4"></textarea>

  <input class="ld-input" placeholder="Контакт (необязательно)"
    [(ngModel)]="contact" />

  <button class="ld-btn ld-btn--primary" [disabled]="!canSubmit()"
    (click)="submit()">Отправить</button>
</div>
```

### Categories

```typescript
categories = [
  { key: 'bug', label: 'Ошибка' },
  { key: 'idea', label: 'Идея' },
  { key: 'missing', label: 'Нет места' },
  { key: 'other', label: 'Другое' },
];
```

### Validation

- Category: required (at least one chip selected).
- Text: required, min 10 characters.
- Contact: optional (email, telegram, phone — free text).

`canSubmit = computed(() => selected() && text().length >= 10)`

### After submit

- Toast: "Спасибо, читаем всё"
- Sheet closes.

## API

### Endpoint

```
POST /v1/feedback
{
  category: 'bug' | 'idea' | 'missing' | 'other',
  text: string,
  contact?: string,
  meta: {
    locale: string,
    theme: string,
    url: string,
    appVersion: string,
    userAgent: string
  }
}
```

### Database

```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  contact TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'new'  -- new, read, resolved
);
```

### Telegram forwarding

On insert, forward to Telegram bot via HTTP:

```typescript
async forwardToTelegram(feedback: FeedbackEntity) {
  const text = `📩 ${feedback.category}\n\n${feedback.text}`
    + (feedback.contact ? `\n\n📞 ${feedback.contact}` : '')
    + `\n\n🕐 ${feedback.created_at}`;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  });
}
```

Env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
Failure: log error, don't fail the API response.

## Files to create/modify

| File | Action |
|------|--------|
| `src/app/features/settings/feedback-sheet/feedback-sheet.component.ts` | create |
| `src/app/features/settings/settings.component.ts` | modify (add link) |
| `src/app/features/discover/discover.component.ts` | modify (empty/error state links) |
| `src/app/core/services/api.service.ts` | modify (add submitFeedback) |
| `apps/api/src/app/feedback/feedback.module.ts` | create |
| `apps/api/src/app/feedback/feedback.controller.ts` | create |
| `apps/api/src/app/feedback/feedback.service.ts` | create |
| `apps/api/src/app/feedback/feedback.entity.ts` | create |
| Migration 014 | create (feedback table) |
