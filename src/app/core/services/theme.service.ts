import { Injectable, signal, computed } from '@angular/core';

export type ThemeName = 'auto' | 'day' | 'evening' | 'dark';

const STORAGE_KEY = 'ld_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private preference = signal<ThemeName>(
    (localStorage.getItem(STORAGE_KEY) as ThemeName) || 'auto',
  );

  /** Resolved theme class name applied to <html> */
  readonly activeTheme = computed(() => {
    const pref = this.preference();
    if (pref === 'day') return 'theme-day';
    if (pref === 'evening') return 'theme-evening';
    if (pref === 'dark') return 'theme-dark';
    // auto: based on time of day (Tbilisi timezone)
    return this.isEvening() ? 'theme-evening' : 'theme-day';
  });

  readonly isDayTime = computed(() => this.activeTheme() === 'theme-day');

  constructor() {
    this.applyTheme();
    // Re-check on visibility change (user returns to app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.applyTheme();
    });
  }

  setPreference(theme: ThemeName) {
    this.preference.set(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    this.applyTheme();
  }

  getPreference(): ThemeName {
    return this.preference();
  }

  private isEvening(): boolean {
    // Use Tbilisi time (UTC+4) for auto theme
    const now = new Date();
    const tbilisiHour = (now.getUTCHours() + 4) % 24;
    return tbilisiHour >= 18 || tbilisiHour < 6;
  }

  private applyTheme() {
    const html = document.documentElement;
    html.classList.remove('theme-day', 'theme-evening', 'theme-dark');
    html.classList.add(this.activeTheme());
  }
}
