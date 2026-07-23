import { Component, computed, inject, isDevMode, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConsentBannerComponent } from '../components/consent-banner.component';
import { LdIconComponent } from '../components/ld-icon.component';
import { ProfileStore } from '../stores/profile.store';
import { ApiService } from '../services/api.service';
import { Locale } from '../models';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterModule, TranslatePipe, ConsentBannerComponent, LdIconComponent],
  template: `
    <div class="shell">
      <!-- Dev strip: taste profile indicator (dev only) -->
      @if (devMode && devProfile()) {
        <div class="dev-strip">
          <span class="dev-strip__label">🧪</span>
          <span>signals: {{ devProfile()!.signalCount }}</span>
          <span>w: {{ devProfile()!.wPersonal }}</span>
          @for (f of devProfile()!.topFacets; track f) {
            <span class="dev-strip__facet">{{ f }}</span>
          }
          @if (devProfile()!.negFacets.length) {
            <span class="dev-strip__neg">⊘ {{ devProfile()!.negFacets.join(', ') }}</span>
          }
        </div>
      }

      <!-- Desktop top nav (≥1024) — hidden during onboarding -->
      @if (showNav()) {
        <header class="shell__topnav">
          <span class="shell__logo ld-display">LaziGo</span>
          <nav class="shell__topnav-tabs">
            <a routerLink="/discover" routerLinkActive="topnav--active" class="topnav__link">{{ 'nav.discover' | translate }}</a>
            <a routerLink="/saved" routerLinkActive="topnav--active" class="topnav__link">{{ 'nav.saved' | translate }}</a>
            <a routerLink="/settings" routerLinkActive="topnav--active" class="topnav__link">{{ 'nav.settings' | translate }}</a>
          </nav>
          <div class="shell__lang">
            @for (l of langs; track l.code) {
              <button class="shell__lang-btn" [class.shell__lang-btn--active]="currentLang() === l.code"
                (click)="setLang(l.code)">{{ l.label }}</button>
            }
          </div>
        </header>
      }

      <main class="shell__content">
        <ng-content />
      </main>

      <app-consent-banner />

      <!-- Mobile bottom nav (<1024) — hidden during onboarding -->
      @if (showNav()) {
        <nav class="shell__nav">
          <a routerLink="/discover" routerLinkActive="active" class="nav-item">
            <ld-icon name="compass" [size]="22" />
            <span class="nav-item__label">{{ 'nav.discover' | translate }}</span>
          </a>
          <a routerLink="/saved" routerLinkActive="active" class="nav-item">
            <ld-icon name="heart" [size]="22" />
            <span class="nav-item__label">{{ 'nav.saved' | translate }}</span>
          </a>
          <a routerLink="/settings" routerLinkActive="active" class="nav-item">
            <ld-icon name="user" [size]="22" />
            <span class="nav-item__label">{{ 'nav.settings' | translate }}</span>
          </a>
        </nav>
      }
    </div>
  `,
  styles: `
    .dev-strip {
      background: #1a1a2e;
      color: #0f0;
      font-family: monospace;
      font-size: 11px;
      padding: 4px 12px;
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      z-index: 9999;
    }
    .dev-strip__label { font-size: 14px; }
    .dev-strip__facet {
      background: #0f03;
      padding: 1px 6px;
      border-radius: 4px;
      color: #4f4;
    }
    .dev-strip__neg {
      color: #f44;
    }

    .shell {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--ld-bg);
    }

    .shell__content {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    /* ─── Desktop top nav ─── */
    .shell__topnav {
      display: none;
    }

    @media (min-width: 1024px) {
      .shell__topnav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 24px;
        background: var(--ld-surface);
        border-bottom: 1px solid var(--ld-border);
      }
    }

    .shell__logo {
      font-size: 18px;
      color: var(--ld-primary);
    }

    .shell__topnav-tabs {
      display: flex;
      gap: 24px;
    }

    .shell__lang {
      display: flex;
      gap: 2px;
      margin-left: 16px;
    }

    .shell__lang-btn {
      background: none;
      border: none;
      font-family: inherit;
      font-size: 12px;
      color: var(--ld-text-3);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 6px;
    }

    .shell__lang-btn--active {
      color: var(--ld-primary);
      font-weight: 600;
      background: var(--ld-primary-soft);
    }

    .topnav__link {
      font-size: 14px;
      font-weight: 500;
      color: var(--ld-text-2);
      text-decoration: none;
      padding: 4px 2px;
      border-bottom: 2px solid transparent;
      transition: color 150ms, border-color 150ms;
    }

    .topnav--active {
      color: var(--ld-primary);
      border-bottom-color: var(--ld-primary);
    }

    /* ─── Mobile bottom nav ─── */
    .shell__nav {
      display: flex;
      justify-content: space-around;
      align-items: center;
      height: 56px;
      background: var(--ld-surface);
      border-top: 1px solid var(--ld-border);
      padding-bottom: env(safe-area-inset-bottom);
    }

    @media (min-width: 1024px) {
      .shell__nav { display: none; }
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      text-decoration: none;
      color: var(--ld-text-3);
      font-size: 12px;
      padding: 6px 16px;
      min-width: 48px;
      min-height: 48px;
      justify-content: center;

      &.active {
        color: var(--ld-primary);
      }
    }

    .nav-item__label {
      font-size: 11px;
    }
  `,
})
export class AppShellComponent implements OnInit {
  private router = inject(Router);
  private translate = inject(TranslateService);
  private profileStore = inject(ProfileStore);
  private api = inject(ApiService, { optional: true });
  private currentUrl = signal(this.router.url);

  readonly devMode = isDevMode();
  readonly devProfile = signal<{ signalCount: number; wPersonal: string; topFacets: string[]; negFacets: string[] } | null>(null);

  langs = [
    { code: 'ru', label: 'RU' },
    { code: 'en', label: 'EN' },
    { code: 'ka', label: 'KA' },
  ];
  currentLang = signal(this.profileStore.locale());

  constructor() {
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        this.currentUrl.set(e.urlAfterRedirects);
        // Analytics: track SPA route changes
        const url = e.urlAfterRedirects;
        try {
          (window as any).ym?.(110570889, 'hit', url);
          (window as any).gtag?.('event', 'page_view', { page_path: url });
        } catch {}
        // Refresh dev strip on navigation
        if (this.devMode) this.loadDevProfile();
      }
    });
  }

  ngOnInit() {
    if (this.devMode) this.loadDevProfile();
  }

  private loadDevProfile() {
    this.api?.getTasteProfile().subscribe({
      next: (data: any) => {
        const top = (data.positives ?? []).slice(0, 5).map((f: any) => f.value);
        const neg = (data.negatives ?? []).slice(0, 3).map((f: any) => f.value);
        const sc = data.signalCount ?? 0;
        const w = (0.20 * Math.min(1, sc / 15)).toFixed(3);
        this.devProfile.set({ signalCount: sc, wPersonal: w, topFacets: top, negFacets: neg });
      },
      error: () => this.devProfile.set(null),
    });
  }

  readonly showNav = computed(() => {
    const url = this.currentUrl();
    return url !== '/'
      && !url.includes('/welcome')
      && !url.includes('/onboarding')
      && !url.includes('/tbilisi/');
  });

  setLang(code: string) {
    this.profileStore.setLocale(code as Locale);
    this.translate.use(code);
    this.currentLang.set(code as Locale);
  }
}
