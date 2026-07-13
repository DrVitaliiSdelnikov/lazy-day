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
  saved_ids TEXT[] DEFAULT '{}',
  hidden_ids TEXT[] DEFAULT '{}',
  consent_state TEXT NOT NULL DEFAULT 'pending',
  auth_provider TEXT,
  auth_external_id TEXT,
  device_ids TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_auth ON users (auth_provider, auth_external_id)
  WHERE auth_provider IS NOT NULL;
```

### Endpoint: POST /v1/auth/anon

**Key design: client-generated uid for idempotency.**

Race condition risk: two tabs, SWR revalidate, beacon — all can hit
`/auth/anon` concurrently without cookie yet. If server generates uid,
two requests create two users. Fix: client sends its localStorage uid,
server uses it as PK via `INSERT ... ON CONFLICT DO UPDATE`.

```typescript
@Post('anon')
async createOrRestore(@Req() req, @Res({ passthrough: true }) res) {
  // 1. Check for existing cookie
  const cookieUid = req.cookies?.['ld_uid'];
  if (cookieUid) {
    const user = await this.usersRepo.findOne({ where: { id: cookieUid } });
    if (user) {
      user.lastSeenAt = new Date();
      await this.usersRepo.save(user);
      return { uid: user.id, profile: user.profile, restored: true };
    }
  }

  // 2. Client-generated uid (idempotent)
  const clientUid = req.body?.clientUid; // from localStorage ld_server_uid
  const deviceIdHash = req.body?.deviceIdHash; // old device_id for linking

  if (clientUid) {
    // Upsert: create if missing, update last_seen if exists
    const result = await this.dataSource.query(`
      INSERT INTO users (id, profile, saved_ids, hidden_ids, consent_state, device_ids, last_seen_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW()
      RETURNING *
    `, [
      clientUid,
      req.body?.profile || {},
      req.body?.savedIds || [],
      req.body?.hiddenIds || [],
      req.body?.consentState || 'pending',
      deviceIdHash ? [deviceIdHash] : [],
    ]);

    const user = result[0];
    const restored = user.created_at < new Date(Date.now() - 5000); // existed before
    this.setCookie(res, user.id);
    return { uid: user.id, profile: user.profile, restored };
  }

  // 3. No client uid — create fresh
  const user = await this.usersRepo.save(this.usersRepo.create({
    profile: req.body?.profile || {},
    savedIds: req.body?.savedIds || [],
    hiddenIds: req.body?.hiddenIds || [],
    consentState: req.body?.consentState || 'pending',
    deviceIds: deviceIdHash ? [deviceIdHash] : [],
  }));

  this.setCookie(res, user.id);
  return { uid: user.id, profile: user.profile, restored: false };
}

private setCookie(res: Response, uid: string) {
  res.cookie('ld_uid', uid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    domain: '.lazigo.app',
    path: '/',
  });
}
```

### Cookie hierarchy (restore order)

1. HttpOnly cookie `ld_uid` → most reliable (server-set, ITP-proof)
2. localStorage `ld_server_uid` → sent as `clientUid` in body (idempotent)
3. Neither → server generates new UUID

---

## Step 2: Profile sync service (frontend)

### ProfileSyncService

```typescript
@Injectable({ providedIn: 'root' })
export class ProfileSyncService {
  private serverUid = signal<string | null>(null);
  private mergeComplete = false; // ← sync guard (bug fix #4)
  readonly identityReady = new Promise<void>(...); // ← all services wait on this

  constructor() { this.init(); }

  private async init() {
    const localUid = localStorage.getItem('ld_server_uid') || crypto.randomUUID();
    localStorage.setItem('ld_server_uid', localUid); // ensure exists before POST

    const oldDeviceId = localStorage.getItem('ld_device_id');
    const localProfile = this.profileStore.snapshot();

    const res = await firstValueFrom(this.http.post<any>(
      `${API_BASE}/auth/anon`,
      {
        clientUid: localUid, // idempotent — same uid = same user
        deviceIdHash: oldDeviceId ? sha256(oldDeviceId).slice(0,16) : undefined,
        profile: localProfile,
        savedIds: localProfile.savedIds,
        hiddenIds: localProfile.hiddenIds,
        consentState: localStorage.getItem('ld_consent') || 'pending',
      },
      { withCredentials: true }
    ));

    this.serverUid.set(res.uid);

    // Restore: if server has richer profile (Safari cleared localStorage)
    if (res.restored && res.profile && Object.keys(res.profile).length > 0) {
      const localEmpty = Object.keys(localProfile.interests || {}).length === 0;
      if (localEmpty) {
        this.profileStore.mergeFromServer(res.profile);
      }
    }

    this.mergeComplete = true; // ← NOW sync is safe
    this.resolveIdentityReady();
  }

  /** Debounced sync: local changes → server (background) */
  syncToServer() {
    if (!this.mergeComplete) return; // ← guard: no sync before merge!
    const uid = this.serverUid();
    if (!uid) return;
    // Debounce 2s, then PATCH /v1/me
  }
}
```

### Sync strategy

- **localStorage = primary** (instant UX, offline-capable)
- **Server = background sync** (debounced 2s after any change)
- **Merge guard**: sync to server ONLY after restore-merge complete.
  Without this: Safari clears localStorage → empty local profile →
  sync overwrites server's rich profile with empty → saves lost.
- **Conflict resolution**: local wins UNLESS local is empty (fresh start)
- **identityReady** promise: InteractionService, feed requests wait on it

---

## Step 3: DELETE /v1/me (GDPR — anonymize, not delete)

**Critical**: GDPR requires removing *link to person*, not destroying
anonymous statistics. Physical deletion of interaction_events would
corrupt venue_interaction_stats (impressions disappear, CTR drifts).

```typescript
@Delete('me')
async deleteMe(@Req() req, @Res({ passthrough: true }) res) {
  const uid = req.cookies?.['ld_uid'];
  if (!uid) throw new UnauthorizedException();

  const user = await this.usersRepo.findOne({ where: { id: uid } });
  if (!user) throw new NotFoundException();

  // Anonymize events (NOT delete) — keeps aggregates accurate
  const allDeviceIds = [uid, ...(user.deviceIds || [])];
  for (const did of allDeviceIds) {
    await this.dataSource.query(
      `UPDATE interaction_events
       SET device_id_hash = 'deleted',
           context = context - 'utm_source' - 'utm_campaign' - 'gclid'
       WHERE device_id_hash = $1`,
      [did],
    );
  }

  // Delete user record
  await this.usersRepo.delete(uid);

  // Clear cookie
  res.clearCookie('ld_uid', { domain: '.lazigo.app', path: '/' });
  return { ok: true };
}
```

**Why anonymize not delete**:
- Events become `device_id_hash='deleted'` — no link to person
- Impressions, CTR, venue_interaction_stats stay correct
- PII in context (UTM, gclid) stripped
- GDPR satisfied: data no longer personally identifiable
- Privacy page says: "мы удаляем профиль и разрываем связь событий с вами"

**device_ids linking**: old events used sha256(localStorage device_id).
New events use server uid. `users.device_ids` stores both, so DELETE
anonymizes all historical events regardless of when they were created.

### Settings UI

Profile → "Удалить мои данные" (danger button).
Confirmation dialog: "Это удалит профиль, сохранённые места и историю.
Действие нельзя отменить."

---

## Step 4: interaction_events unification

InteractionService uses `serverUid` when available:

```typescript
private getDeviceId(): string {
  return localStorage.getItem('ld_server_uid')
    || this.getOrCreateDeviceId(); // old fallback
}
```

On init, ProfileSyncService sends old `deviceIdHash` to server,
which stores it in `users.device_ids`. This links old events
to the server identity for cohort analysis and GDPR deletion.

---

## Step 5: Garbage collection

Anonymous users with no activity accumulate (bots, incognito).
Weekly cron removes empty users:

```sql
-- Add to event-cron or separate cron
DELETE FROM users
WHERE auth_provider IS NULL
  AND last_seen_at < NOW() - INTERVAL '90 days'
  AND saved_ids = '{}'
  AND hidden_ids = '{}'
  AND (profile = '{}' OR profile IS NULL);
```

---

## NestJS setup notes

```typescript
// main.ts
import * as cookieParser from 'cookie-parser';

app.use(cookieParser());
app.enableCors({
  origin: ['https://lazigo.app', 'http://localhost:4200'],
  credentials: true, // required for cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-device-id', 'x-admin-token'],
});
```

**beacon + credentials**: `navigator.sendBeacon` sends cookies
automatically for same-site requests. With `api.lazigo.app` ↔ `lazigo.app`
(same eTLD+1), cookies are first-party. CORS must respond with
`Access-Control-Allow-Credentials: true` and exact origin (not `*`) —
already configured.

**`@Res({ passthrough: true })`** — use instead of `@Res()` to keep
NestJS interceptors working while still setting cookies.

---

## What NOT to do in this iteration

- **No OAuth** — separate task, only when cross-device demand proven
- **No username/email** — anonymous identity only
- **No UI for "account"** — invisible to user
- **No migration popup** — first visit silently imports localStorage
- **No blocking** — if server unreachable, localStorage works standalone

---

## Implementation order

| Step | What | Effort | Acceptance |
|---|---|---|---|
| 0 | `api.lazigo.app` custom domain + CORS + frontend URL | 1-2 hours | `curl https://api.lazigo.app/v1/health` works |
| 1 | Users table (015) + POST /v1/auth/anon (idempotent) + cookie | 2-3 hours | Cookie set, second tab reuses same user |
| 2 | ProfileSyncService + PATCH /v1/me (merge guard) | 2-3 hours | Profile syncs, empty local doesn't overwrite server |
| 3 | DELETE /v1/me (anonymize) + Settings UI | 30 min | Events anonymized, user deleted, cookie cleared |
| 4 | InteractionService uid + device_ids linking | 30 min | New events use server uid |
| 5 | GC cron for empty anon users | 15 min | Cron runs weekly |

**Total: ~1.5 days**

---

## Consequences (bonuses)

1. **D7 metric accuracy** — server uid survives Safari ITP, browser clear
2. **K2-lite unblocked** — server identity for "decide together" sessions
3. **Future OAuth** — just links provider to existing anon user
4. **Saved/hidden persist** — survive browser clear, available cross-device later
5. **GDPR compliance** — anonymize (not delete) events + DELETE /v1/me
6. **Consent unification** — consent_state on server, not just localStorage
7. **No phantom users** — idempotent creation prevents race condition duplicates
8. **Clean aggregates** — anonymization preserves CTR/impressions accuracy
