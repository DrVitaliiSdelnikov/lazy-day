import { Injectable } from '@angular/core';

const UTM_KEY = 'ld_utm';
const TRACKED_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'device', 'matchtype', 'gclid', 'campaign_id', 'adgroup_id', 'creative_id',
];

@Injectable({ providedIn: 'root' })
export class UtmService {
  private params: Record<string, string> = {};

  constructor() {
    // Capture from current URL
    const url = new URL(window.location.href);
    const fromUrl: Record<string, string> = {};
    for (const key of TRACKED_PARAMS) {
      const val = url.searchParams.get(key);
      if (val) fromUrl[key] = val;
    }

    if (Object.keys(fromUrl).length > 0) {
      this.params = fromUrl;
      sessionStorage.setItem(UTM_KEY, JSON.stringify(this.params));
    } else {
      // Restore from sessionStorage (SPA navigation loses URL params)
      try {
        const stored = sessionStorage.getItem(UTM_KEY);
        if (stored) this.params = JSON.parse(stored);
      } catch { /* ignore */ }
    }
  }

  /** Get all captured UTM/ad params */
  get(): Record<string, string> {
    return { ...this.params };
  }

  /** Check if this session came from paid ads */
  isAdTraffic(): boolean {
    return !!this.params['gclid'] || this.params['utm_source'] === 'google';
  }

  /** Get specific param */
  param(key: string): string | undefined {
    return this.params[key];
  }
}
