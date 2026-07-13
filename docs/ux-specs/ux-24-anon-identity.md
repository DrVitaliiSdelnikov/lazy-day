# UX-24: Anonymous Server Identity

Priority: **HIGH — prerequisite for K2-lite, fixes kill/scale metrics**
Effort: 1.5 days
Depends on: api.lazigo.app custom domain (step 0)

## Problem

1. **Safari ITP**: localStorage-only identity lives max 7 days without visit.
   D7 return metric undercounts — users who return after clearing are "new".
2. **K2-lite needs server identity**: "decide together" sessions require
   stable user ID on server, not client-only localStorage.
3. **Cross-device impossible**: profile (interests, saved, hidden) stuck
   on one browser. No sync path.

## Principle

User never sees the word "account". Anonymous identity is invisible.
Server creates it silently, HttpOnly cookie persists it. OAuth comes
later as "sync between devices" — not as gate.

---

## Step 0: api.lazigo.app (PREREQUISITE)

**Why**: API is on `lazy-day-production.up.railway.app`. Cookie from this
domain is third-party for `lazigo.app` — Safari/Chrome will block it.
Must be same eTLD+1 for first-party cookie.

**How**:
1. Railway → API service → Settings → Networking → Custom Domains
2. Add `api.lazigo.app`
3. Cloudflare DNS → CNAME `api` → Railway provided target
4. Railway auto-provisions SSL
5. Update frontend `baseUrl` from `lazy-day-production.up.railway.app` to `api.lazigo.app`
6. Update CORS origin list

**Effort**: 1-2 hours.
**Bonus**: cleaner URLs, better branding, simpler CORS.

---

## Step 1: Users table + anon session

### Migration 015

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  profile JSONB NOT NULL DEFAULT '{}',
  -- profile: { interests, company, hasPet, locale, theme, localLevel, budgetMax }
  saved_ids TEXT[] DEFAULT '{}',
  hidden_ids TEXT[] DEFAULT '{}',
  consent_state TEXT NOT NULL DEFAULT 'pending',
  auth_provider TEXT,  -- null = anon, 'google', 'yandex' (future)
  auth_external_id TEXT,  -- provider user ID (future)
  device_ids TEXT[] DEFAULT '{}'  -- all device_id_hash that linked to this user
);

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_auth ON users (auth_provider, auth_external_id)
  WHERE auth_provider IS NOT NULL;
```

### Endpoint: POST /v1/auth/anon

```typescript
@Post('anon')
async createOrRestore(@Req() req, @Res() res) {
  // 1. Check for existing cookie
  const existingUid = req.cookies?.['ld_uid'];
  if (existingUid) {
    const user = await this.usersRepo.findOne({ where: { id: existingUid } });
    if (user) {
      user.lastSeenAt = new Date();
      await this.usersRepo.save(user);
      return res.json({ uid: user.id, profile: user.profile, restored: true });
    }
  }

  // 2. Check for localStorage uid in body (fallback)
  const bodyUid = req.body?.localStorageUid;
  if (bodyUid) {
    const user = await this.usersRepo.findOne({ where: { id: bodyUid } });
    if (user) {
      this.setCookie(res, user.id);
      user.lastSeenAt = new Date();
      await this.usersRepo.save(user);
      return res.json({ uid: user.id, profile: user.profile, restored: true });
    }
  }

  // 3. Create new anon user
  const user = await this.usersRepo.save(this.usersRepo.create({
    profile: req.body?.profile || {},
    savedIds: req.body?.savedIds || [],
    hiddenIds: req.body?.hiddenIds || [],
    consentState: req.body?.consentState || 'pending',
  }));

  this.setCookie(res, user.id);
  return res.json({ uid: user.id, profile: user.profile, restored: false });
}

private setCookie(res: Response, uid: string) {
  res.cookie('ld_uid', uid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    domain: '.lazigo.app', // works for api.lazigo.app → lazigo.app
    path: '/',
  });
}
```

### Cookie hierarchy (restore order)

1. HttpOnly cookie `ld_uid` → most reliable (server-set, ITP-proof)
2. localStorage `ld_server_uid` → fallback (sent in body)
3. Neither → create new anon user

---

## Step 2: Profile sync service (frontend)

### ProfileSyncService

```typescript
@Injectable({ providedIn: 'root' })
export class ProfileSyncService {
  private serverUid = signal<string | null>(null);

  constructor(
    private http: HttpClient,
    private profileStore: ProfileStore,
  ) {
    this.init();
  }

  private async init() {
    // On app start: establish server identity
    const localUid = localStorage.getItem('ld_server_uid');
    const localProfile = this.profileStore.snapshot();

    const res = await firstValueFrom(this.http.post<any>(
      `${API_BASE}/auth/anon`,
      {
        localStorageUid: localUid,
        profile: localProfile,
        savedIds: localProfile.savedIds,
        hiddenIds: localProfile.hiddenIds,
        consentState: localStorage.getItem('ld_consent') || 'pending',
      },
      { withCredentials: true } // sends cookie
    ));

    this.serverUid.set(res.uid);
    localStorage.setItem('ld_server_uid', res.uid);

    // If restored from server → merge into local store
    if (res.restored && res.profile && Object.keys(res.profile).length > 0) {
      this.profileStore.mergeFromServer(res.profile);
    }
  }

  /** Debounced sync: local changes → server (background) */
  syncToServer() {
    const uid = this.serverUid();
    if (!uid) return;
    // Debounce 2s, then PATCH /v1/me
    this.http.patch(`${API_BASE}/me`, {
      profile: this.profileStore.snapshot(),
      savedIds: this.profileStore.savedIds(),
      hiddenIds: this.profileStore.hiddenIds(),
    }, { withCredentials: true }).subscribe();
  }
}
```

### Sync strategy

- **localStorage = primary** (instant UX, offline-capable)
- **Server = background sync** (debounced 2s after any change)
- **On restore**: server profile merged into local if local is empty
- **Conflict resolution**: local wins (user's device is source of truth)
- **No loading state**: app starts from localStorage immediately,
  server sync happens in background (SWR pattern already established)

---

## Step 3: API endpoints

```
POST /v1/auth/anon          — Create or restore anon session (sets cookie)
GET  /v1/me                 — Get current user profile
PATCH /v1/me                — Update profile (debounced sync)
DELETE /v1/me               — Delete user + all data (GDPR)
```

All `/me` endpoints use cookie for auth — no token header needed.

### DELETE /v1/me (GDPR)

```typescript
@Delete('me')
async deleteMe(@Req() req, @Res() res) {
  const uid = req.cookies?.['ld_uid'];
  if (!uid) return res.status(401).json({ error: 'Not identified' });

  // Delete all user data
  await this.usersRepo.delete(uid);
  await this.interactionEventsRepo.delete({ deviceIdHash: uid });

  // Clear cookie
  res.clearCookie('ld_uid', { domain: '.lazigo.app', path: '/' });
  return res.json({ ok: true });
}
```

### Settings UI

Profile → "Удалить мои данные" (danger button).
Confirmation: "Это удалит все сохранённые места, настройки и историю.
Действие нельзя отменить."

---

## Step 4: interaction_events unification

Currently: `device_id_hash` = sha256 of localStorage UUID.
After: `device_id_hash` = server-issued `user.id` (stable UUID).

**Migration**: InteractionService uses `serverUid` when available,
falls back to localStorage device_id for pre-migration events.

```typescript
// In InteractionService
private getDeviceId(): string {
  return localStorage.getItem('ld_server_uid')
    || this.getOrCreateDeviceId(); // old fallback
}
```

D7 and cohort metrics become accurate — no more phantom "new users"
from Safari ITP or browser cache clearing.

---

## What NOT to do in this iteration

- **No OAuth** — separate task, only when cross-device demand proven
- **No username/email** — anonymous identity only
- **No UI for "account"** — invisible to user
- **No migration popup** — first visit with server silently imports localStorage
- **No blocking** — if server unreachable, localStorage works standalone

---

## NestJS cookie setup

```typescript
// main.ts
import * as cookieParser from 'cookie-parser';

app.use(cookieParser());
app.enableCors({
  origin: ['https://lazigo.app', 'http://localhost:4200'],
  credentials: true, // <-- required for cookies
  // ... existing config
});
```

Frontend HttpClient must send `withCredentials: true` for cookie endpoints.

---

## Implementation order

| Step | What | Effort | Acceptance |
|---|---|---|---|
| 0 | `api.lazigo.app` custom domain + CORS + frontend URL update | 1-2 hours | `curl https://api.lazigo.app/v1/health` works |
| 1 | Users table (migration 015) + POST /v1/auth/anon + cookie | 2-3 hours | Cookie set on first visit, restored on return |
| 2 | ProfileSyncService + PATCH /v1/me | 2-3 hours | Profile changes sync to server in background |
| 3 | DELETE /v1/me + Settings UI | 30 min | User can delete all data |
| 4 | InteractionService uses server uid | 30 min | interaction_events use stable uid |

**Total: ~1.5 days**

---

## Consequences (bonuses)

1. **D7 metric accuracy** — server uid survives Safari ITP, browser clear
2. **K2-lite unblocked** — server identity for "decide together" sessions
3. **Future OAuth** — just links provider to existing anon user
4. **Saved/hidden persist** — survive browser clear, available cross-device later
5. **GDPR compliance** — DELETE /v1/me provides right to erasure
6. **Consent unification** — consent_state on server, not just localStorage
