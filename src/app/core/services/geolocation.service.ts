import { Injectable, isDevMode, signal } from '@angular/core';

export type PositionSource = 'gps' | 'default' | 'manual';

export interface GeoPosition {
  lat: number;
  lng: number;
  source: PositionSource;
  label?: string;
}

// Default location: Tbilisi center
const TBILISI_CENTER: GeoPosition = {
  lat: 41.6934,
  lng: 44.8015,
  source: 'default',
  label: 'Центр Тбилиси',
};

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  readonly position = signal<GeoPosition>(TBILISI_CENTER);
  readonly loading = signal(false);
  readonly denied = signal(false);
  /** Fires when position changes after init (GPS acquired) */
  readonly updated = signal(0);

  constructor() {
    this.silentInit();
  }

  /** On startup: if permission already granted, get GPS silently (no prompt) */
  private async silentInit() {
    try {
      if (!navigator.permissions || !navigator.geolocation) {
        if (isDevMode()) console.warn('[Geo] No permissions/geolocation API');
        return;
      }
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (isDevMode()) console.log(`[Geo] Permission: ${perm.state}`);
      if (perm.state === 'granted') {
        await this.requestPosition();
      } else if (isDevMode()) {
        console.log('[Geo] Using default:', TBILISI_CENTER.label);
      }
    } catch (e) {
      if (isDevMode()) console.warn('[Geo] Silent init failed:', e);
    }
  }

  /** Explicitly request GPS (may trigger browser prompt) */
  async requestPosition(): Promise<GeoPosition> {
    if (!navigator.geolocation) {
      this.denied.set(true);
      return TBILISI_CENTER;
    }

    this.loading.set(true);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000,
        });
      });

      const result: GeoPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        source: 'gps',
      };
      if (isDevMode()) console.log(`[Geo] GPS acquired: ${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`);
      this.position.set(result);
      this.denied.set(false);
      this.updated.update(n => n + 1);
      return result;
    } catch (e) {
      if (isDevMode()) console.warn('[Geo] GPS failed:', e);
      this.denied.set(true);
      return this.position();
    } finally {
      this.loading.set(false);
    }
  }

  setManual(lat: number, lng: number, label?: string) {
    this.position.set({ lat, lng, source: 'manual', label: label || 'Моя точка' });
    this.updated.update(n => n + 1);
  }

  setFallback(lat: number, lng: number) {
    this.setManual(lat, lng);
  }
}
