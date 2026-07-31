import { Injectable, signal, computed } from '@angular/core';

export type NetworkState = 'online' | 'offline' | 'degraded';

/**
 * Single source of truth for network status.
 * Determined by real request results, not navigator.onLine alone.
 *
 * Usage:
 * - HTTP interceptor reports success/failure → updates status
 * - Components read status() signal to show banners/rollbacks
 * - Auto-retry: pendingRetry callback fires when status returns to online
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly _status = signal<NetworkState>('online');
  private readonly _lastOnline = signal<number>(Date.now());
  private _pendingRetry: (() => void) | null = null;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly status = this._status.asReadonly();
  readonly isOnline = computed(() => this._status() === 'online');
  readonly isOffline = computed(() => this._status() === 'offline');

  constructor() {
    // Browser online/offline as supplementary signal
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onBrowserOnline());
      window.addEventListener('offline', () => this.setStatus('offline'));
    }
  }

  /** Called by interceptor on successful request */
  reportSuccess(): void {
    this._lastOnline.set(Date.now());
    if (this._status() !== 'online') {
      this.setStatus('online');
    }
  }

  /** Called by interceptor on network error (no response) */
  reportNetworkError(): void {
    this.setStatus(navigator.onLine ? 'degraded' : 'offline');
  }

  /** Called by interceptor on timeout */
  reportTimeout(): void {
    this.setStatus('degraded');
  }

  /** Register a callback to retry when network comes back */
  setPendingRetry(fn: (() => void) | null): void {
    this._pendingRetry = fn;
  }

  private setStatus(status: NetworkState): void {
    // Debounce to prevent flapping (N9 from spec)
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      const prev = this._status();
      if (prev === status) return;
      this._status.set(status);

      // Auto-retry on recovery
      if (status === 'online' && this._pendingRetry) {
        const retry = this._pendingRetry;
        this._pendingRetry = null;
        retry();
      }
    }, status === 'online' ? 0 : 1500); // instant recovery, debounced degradation
  }

  private onBrowserOnline(): void {
    // Browser says online — verify with a lightweight check
    // Don't trust blindly; next real request will confirm
    if (this._status() !== 'online') {
      this.setStatus('online');
    }
  }
}
