import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ConsentBannerComponent } from '../components/consent-banner.component';
import { LdIconComponent } from '../components/ld-icon.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterModule, TranslatePipe, ConsentBannerComponent, LdIconComponent],
  template: `
    <div class="shell">
      <!-- Desktop top nav (≥1024) -->
      <header class="shell__topnav">
        <span class="shell__logo ld-display">LaziGo</span>
        <nav class="shell__topnav-tabs">
          <a routerLink="/discover" routerLinkActive="topnav--active" class="topnav__link">Лента</a>
          <a routerLink="/saved" routerLinkActive="topnav--active" class="topnav__link">Избранное</a>
          <a routerLink="/settings" routerLinkActive="topnav--active" class="topnav__link">Профиль</a>
        </nav>
      </header>

      <main class="shell__content">
        <ng-content />
      </main>

      <app-consent-banner />

      <!-- Mobile bottom nav (<1024) -->
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
    </div>
  `,
  styles: `
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
export class AppShellComponent {}
