import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProfileStore } from '../../../core/stores/profile.store';
import { Locale } from '../../../core/models';
import { LdIconComponent } from '../../../core/components/ld-icon.component';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [LdIconComponent, TranslatePipe],
  template: `
    <div class="welcome">
      <!-- Language switcher -->
      <div class="welcome__lang">
        @for (l of langs; track l.code) {
          <button class="welcome__lang-btn" [class.welcome__lang-btn--active]="currentLang() === l.code"
            (click)="setLang(l.code)">{{ l.label }}</button>
        }
      </div>

      <div class="welcome__content">
        <!-- App icon -->
        <div class="welcome__icon">
          <svg viewBox="0 0 512 512" width="88" height="88" style="border-radius: 22px" role="img" aria-label="LaziGo">
            <rect width="512" height="512" rx="115" fill="#E8862D"/>
            <circle cx="248" cy="268" r="192" fill="#F29A44"/>
            <g transform="rotate(-14 256 266)">
              <path d="M256 96 C 187 96 136 148 136 214 C 136 262 176 318 256 416 C 336 318 376 262 376 214 C 376 148 325 96 256 96 Z" fill="#FFF9EF"/>
              <path d="M204 202 c 8 13 24 13 32 0" fill="none" stroke="#A85B14" stroke-width="13" stroke-linecap="round"/>
              <path d="M276 202 c 8 13 24 13 32 0" fill="none" stroke="#A85B14" stroke-width="13" stroke-linecap="round"/>
              <path d="M238 250 c 8 9 28 9 36 0" fill="none" stroke="#A85B14" stroke-width="12" stroke-linecap="round"/>
              <circle cx="196" cy="236" r="13" fill="#F6C89B"/><circle cx="316" cy="236" r="13" fill="#F6C89B"/>
            </g>
            <g stroke="#FFF9EF" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <path d="M382 108 h 46 l -46 48 h 46" stroke-width="17"/>
              <path d="M446 62 h 30 l -30 33 h 30" stroke-width="12"/>
            </g>
          </svg>
        </div>

        <h1 class="welcome__title ld-display">{{ 'welcome.title' | translate }}</h1>
        <p class="welcome__subtitle">{{ 'welcome.subtitle' | translate }}</p>

        <!-- Value prop card -->
        <div class="welcome__card">
          <div class="welcome__prop">
            <span class="welcome__prop-icon" style="background: var(--ld-primary-soft)">
              <ld-icon name="compass" [size]="16" />
            </span>
            <span>{{ 'welcome.prop_tell' | translate }}</span>
          </div>
          <div class="welcome__prop">
            <span class="welcome__prop-icon" style="background: var(--ld-secondary-soft)">
              <ld-icon name="map-pin" [size]="16" />
            </span>
            <span>{{ 'welcome.prop_ideas' | translate }}</span>
          </div>
          <div class="welcome__prop">
            <span class="welcome__prop-icon" style="background: var(--ld-event-soft)">
              <ld-icon name="ticket" [size]="16" />
            </span>
            <span>{{ 'welcome.prop_feed' | translate }}</span>
          </div>
        </div>

        <button class="ld-btn ld-btn--primary welcome__cta" (click)="start()">
          {{ 'welcome.start' | translate }}
        </button>

        <button class="ld-btn ld-btn--ghost welcome__skip" (click)="skipAll()">
          {{ 'welcome.skip' | translate }}
        </button>

        <p class="welcome__trust">
          <ld-icon name="user" [size]="11" /> {{ 'welcome.trust' | translate }}
        </p>
      </div>
    </div>
  `,
  styles: `
    .welcome {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--ld-bg);
      position: relative;
    }

    .welcome__lang {
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 2px;
      background: var(--ld-surface);
      border-radius: 10px;
      padding: 3px;
    }

    .welcome__lang-btn {
      background: none;
      border: none;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      color: var(--ld-text-3);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 8px;
    }

    .welcome__lang-btn--active {
      color: var(--ld-primary);
      background: var(--ld-primary-soft);
      font-weight: 600;
    }

    .welcome__content {
      max-width: 360px;
      text-align: center;
    }

    .welcome__icon {
      margin-bottom: 0;
    }

    .welcome__title {
      font-size: 22px;
      margin: 16px 0 6px;
      color: var(--ld-primary);
    }

    .welcome__subtitle {
      font-size: 14px;
      color: var(--ld-text-2);
      line-height: 1.5;
      margin: 0 0 24px;
    }

    .welcome__card {
      text-align: left;
      background: var(--ld-surface);
      border: 1px solid var(--ld-border);
      border-radius: 18px;
      padding: 14px;
      margin-bottom: 24px;
    }

    .welcome__prop {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      margin-bottom: 10px;
    }

    .welcome__prop:last-child { margin-bottom: 0; }

    .welcome__prop-icon {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--ld-primary);
    }

    .welcome__cta {
      width: 100%;
      margin-bottom: 10px;
    }

    .welcome__skip {
      width: 100%;
      margin-bottom: 0;
    }

    .welcome__trust {
      font-size: 11px;
      color: var(--ld-text-3);
      margin: 18px 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    /* Desktop: two-column hero */
    @media (min-width: 1024px) {
      .welcome__content {
        max-width: 560px;
      }
    }
  `,
})
export class WelcomeComponent {
  private router = inject(Router);
  private profileStore = inject(ProfileStore);
  private translate = inject(TranslateService);

  langs = [
    { code: 'ru', label: 'RU' },
    { code: 'en', label: 'EN' },
    { code: 'ka', label: 'KA' },
  ];
  currentLang = signal(this.profileStore.locale());

  setLang(code: string) {
    this.profileStore.setLocale(code as Locale);
    this.translate.use(code);
    this.currentLang.set(code as Locale);
  }

  start() {
    localStorage.setItem('ld_welcome_done', 'true');
    this.router.navigate(['/discover/onboarding']);
  }

  skipAll() {
    localStorage.setItem('ld_welcome_done', 'true');
    this.profileStore.completeOnboarding();
    this.router.navigate(['/discover']);
  }
}
