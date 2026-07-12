import { inject, Injectable, isDevMode } from '@angular/core';
import { UtmService } from './utm.service';

export interface TrackEvent {
  eventType: string;
  targetType: string;
  targetId?: string;
  cardPosition?: number;
  context?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class InteractionService {
  private buffer: TrackEvent[] = [];
  private readonly sessionId = crypto.randomUUID();
  private readonly deviceId = this.getOrCreateDeviceId();
  private readonly utm = inject(UtmService);
  private flushTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Flush on page hide (mobile: tab switch, app background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
    // Periodic flush every 30s
    this.flushTimer = setInterval(() => this.flush(), 30000);
  }

  track(event: TrackEvent) {
    // Merge UTM params into event context
    const utmParams = this.utm.get();
    if (Object.keys(utmParams).length > 0) {
      event = { ...event, context: { ...event.context, ...utmParams } };
    }
    this.buffer.push(event);
    if (this.buffer.length >= 10) this.flush();
  }

  /** Track card impression (debounced — only if visible >500ms) */
  trackImpression(targetType: string, targetId: string, cardPosition: number) {
    this.track({ eventType: 'impression', targetType, targetId, cardPosition });
  }

  trackClick(targetType: string, targetId: string, cardPosition: number) {
    this.track({ eventType: 'card_click', targetType, targetId, cardPosition });
  }

  trackRoute(targetType: string, targetId: string) {
    this.track({ eventType: 'route', targetType, targetId });
    (window as any).gtag?.('event', 'route_clicked', { place_id: targetId });
  }

  trackShare(targetType: string, targetId: string) {
    this.track({ eventType: 'share', targetType, targetId });
    (window as any).gtag?.('event', 'share_clicked', { place_id: targetId });
  }

  trackSave(targetType: string, targetId: string) {
    this.track({ eventType: 'save', targetType, targetId });
    (window as any).gtag?.('event', 'favorite_added', { place_id: targetId });
  }

  trackHide(targetType: string, targetId: string, reason?: string) {
    this.track({ eventType: 'hide', targetType, targetId, context: reason ? { reason } : undefined });
  }

  trackTaxi(targetType: string, targetId: string, provider: string) {
    this.track({ eventType: 'taxi', targetType, targetId, context: { provider } });
  }

  private flush() {
    if (!this.buffer.length) return;
    const events = [...this.buffer];
    this.buffer = [];

    const consentState = localStorage.getItem('ld_consent') || 'pending';
    const body = JSON.stringify({ sessionId: this.sessionId, deviceId: this.deviceId, consentState, events });

    if (isDevMode()) {
      console.log(`[Track] Flushing ${events.length} events`, events.map(e => e.eventType));
    }

    // sendBeacon is fire-and-forget, works even when page is closing
    const apiBase = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
      ? 'https://lazy-day-production.up.railway.app/v1'
      : '/v1';
    const url = `${apiBase}/interactions/batch`;
    const sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));

    if (!sent) {
      // Fallback: fetch with keepalive
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-id': this.deviceId },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }

  private getOrCreateDeviceId(): string {
    const key = 'ld_device_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }
}
