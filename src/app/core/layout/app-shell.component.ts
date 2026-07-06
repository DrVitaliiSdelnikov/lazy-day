import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterModule, TranslatePipe],
  template: `
    <div class="shell">
      <main class="shell__content">
        <ng-content />
      </main>

      <nav class="shell__nav">
        <a
          routerLink="/discover"
          routerLinkActive="active"
          class="nav-item"
        >
          <span class="nav-item__icon">&#9733;</span>
          <span class="nav-item__label">{{ 'nav.discover' | translate }}</span>
        </a>
        <a
          routerLink="/saved"
          routerLinkActive="active"
          class="nav-item"
        >
          <span class="nav-item__icon">&#9829;</span>
          <span class="nav-item__label">{{ 'nav.saved' | translate }}</span>
        </a>
        <a
          routerLink="/settings"
          routerLinkActive="active"
          class="nav-item"
        >
          <span class="nav-item__icon">&#9881;</span>
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

    .shell__nav {
      display: flex;
      justify-content: space-around;
      align-items: center;
      height: 56px;
      background: var(--ld-card-bg);
      border-top: 1px solid var(--ld-divider);
      padding-bottom: env(safe-area-inset-bottom);
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      text-decoration: none;
      color: var(--ld-text-secondary);
      font-size: 12px;
      padding: 6px 16px;
      min-width: 48px;
      min-height: 48px;
      justify-content: center;

      &.active {
        color: var(--ld-accent);
      }
    }

    .nav-item__icon {
      font-size: 20px;
      line-height: 1;
    }

    .nav-item__label {
      font-size: 11px;
    }
  `,
})
export class AppShellComponent {}
