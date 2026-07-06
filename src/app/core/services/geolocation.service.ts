import { Injectable, signal } from '@angular/core';

export interface GeoPosition {
  lat: number;
  lng: number;
  source: 'gps' | 'fallback';
}

// Tbilisi center fallback
const TBILISI_CENTER: GeoPosition = {
  lat: 41.7151,
  lng: 44.8271,
  source: 'fallback',
};

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  readonly position = signal<GeoPosition>(TBILISI_CENTER);
  readonly loading = signal(false);
  readonly denied = signal(false);

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
          timeout: 5000,
          maximumAge: 60000,
        });
      });

      const result: GeoPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        source: 'gps',
      };
      this.position.set(result);
      return result;
    } catch {
      this.denied.set(true);
      return TBILISI_CENTER;
    } finally {
      this.loading.set(false);
    }
  }

  setFallback(lat: number, lng: number) {
    this.position.set({ lat, lng, source: 'fallback' });
  }
}
