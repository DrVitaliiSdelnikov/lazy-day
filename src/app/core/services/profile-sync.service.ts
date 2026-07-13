import { inject, Injectable, isDevMode, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProfileStore } from '../stores/profile.store';

const API_BASE = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
  ? 'https://api.lazigo.app/v1' : '/v1';

@Injectable({ providedIn: 'root' })
export class ProfileSyncService {
  private http = inject(HttpClient);
  private profileStore = inject(ProfileStore);

  readonly serverUid = signal<string | null>(null);
  private mergeComplete = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  private resolveReady!: () => void;
  readonly identityReady = new Promise<void>(r => this.resolveReady = r);

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const localUid = localStorage.getItem('ld_server_uid') || crypto.randomUUID();
      localStorage.setItem('ld_server_uid', localUid);

      const oldDeviceId = localStorage.getItem('ld_device_id');
      const deviceIdHash = oldDeviceId ? this.hashDeviceId(oldDeviceId) : undefined;

      const state = this.profileStore.snapshot();

      const res = await firstValueFrom(this.http.post<any>(
        `${API_BASE}/auth/anon`,
        {
          clientUid: localUid,
          deviceIdHash,
          profile: {
            interests: state.interests,
            company: state.company,
            hasPet: state.hasPet,
            locale: state.locale,
            theme: state.theme,
            localLevel: state.localLevel,
            budgetMax: state.budgetMax,
          },
          savedIds: state.savedIds,
          hiddenIds: state.hiddenIds,
          consentState: localStorage.getItem('ld_consent') || 'pending',
        },
        { withCredentials: true },
      ));

      this.serverUid.set(res.uid);
      localStorage.setItem('ld_server_uid', res.uid); // cookie-uid wins

      if (isDevMode()) {
        console.log(`[Sync] ${res.restored ? 'Restored' : 'Created'} user ${res.uid}`);
      }

      // Restore from server if local was cleared (ITP scenario)
      if (res.restored) {
        const localEmpty = Object.keys(state.interests || {}).length === 0;

        // Profile: server wins if local is empty
        if (localEmpty && res.profile && Object.keys(res.profile).length > 0) {
          this.profileStore.mergeFromServer(res.profile);
        }

        // Saved/Hidden: UNION (not replace)
        if (res.savedIds?.length) {
          const merged = [...new Set([...state.savedIds, ...res.savedIds])];
          this.profileStore.setSavedIds(merged);
        }
        if (res.hiddenIds?.length) {
          const merged = [...new Set([...state.hiddenIds, ...res.hiddenIds])];
          this.profileStore.setHiddenIds(merged);
        }

        // Consent: restore from server → don't re-show banner
        if (res.consentState && res.consentState !== 'pending') {
          const localConsent = localStorage.getItem('ld_consent');
          if (!localConsent || localConsent === 'pending') {
            localStorage.setItem('ld_consent', res.consentState);
            if (isDevMode()) console.log(`[Sync] Consent restored: ${res.consentState}`);
          }
        }
      }

      this.mergeComplete = true;
      this.resolveReady();
    } catch (e) {
      if (isDevMode()) console.warn('[Sync] Init failed, running offline:', e);
      this.mergeComplete = true;
      this.resolveReady();
    }
  }

  /** Debounced sync: call after any profile/saved/hidden change */
  syncToServer() {
    if (!this.mergeComplete) return;
    if (!this.serverUid()) return;

    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.doSync(), 2000);
  }

  private doSync() {
    const state = this.profileStore.snapshot();
    this.http.patch(`${API_BASE}/auth/me`, {
      profile: {
        interests: state.interests,
        company: state.company,
        hasPet: state.hasPet,
        locale: state.locale,
        theme: state.theme,
        localLevel: state.localLevel,
        budgetMax: state.budgetMax,
      },
      savedIds: state.savedIds,
      hiddenIds: state.hiddenIds,
      consentState: localStorage.getItem('ld_consent') || 'pending',
    }, { withCredentials: true }).subscribe({
      next: () => { if (isDevMode()) console.log('[Sync] Profile synced to server'); },
      error: (e) => { if (isDevMode()) console.warn('[Sync] Sync failed:', e); },
    });
  }

  private hashDeviceId(id: string): string {
    // Simple hash for linking old device_id to server user
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).slice(0, 16);
  }
}
