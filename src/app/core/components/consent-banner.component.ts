import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

const CONSENT_KEY = 'ld_consent';

export type ConsentState = 'accepted' | 'declined' | 'pending';

export function getConsentState(): ConsentState {
  return (localStorage.getItem(CONSENT_KEY) as ConsentState) || 'pending';
}

@Component({
  selector: 'app-consent-banner',
  standalone: true,
  imports: [RouterModule, TranslatePipe],
  template: `
    @if (visible()) {
      <div class="consent">
        <div class="consent__content">
          <p class="consent__text">
            {{ 'consent.text' | translate }}
            <a class="consent__link" routerLink="/privacy">{{ 'consent.learn_more' | translate }}</a>
          </p>
          <div class="consent__actions">
            <button class="consent__btn consent__btn--accept" (click)="accept()">{{ 'consent.accept' | translate }}</button>
            <button class="consent__btn consent__btn--decline" (click)="decline()">{{ 'consent.decline' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .consent {
      position: fixed;
      bottom: 56px;
      left: 0;
      right: 0;
      z-index: 9999;
      background: var(--ld-surface);
      border-top: 1px solid var(--ld-border);
      box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
      padding: 14px 16px;
    }

    @media (min-width: 1024px) {
      .consent { bottom: 0; }
    }

    .consent__content {
      max-width: 600px;
      margin: 0 auto;
    }

    .consent__text {
      font-size: 12px;
      line-height: 1.5;
      color: var(--ld-text-2);
      margin: 0 0 10px;
    }

    .consent__link {
      color: var(--ld-primary);
      text-decoration: underline;
    }

    .consent__actions {
      display: flex;
      gap: 8px;
    }

    .consent__btn {
      flex: 1;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      min-height: 40px;
      border: none;
      font-family: inherit;
    }

    .consent__btn--accept {
      background: var(--ld-primary);
      color: var(--ld-bg);
    }

    .consent__btn--decline {
      background: none;
      border: 1px solid var(--ld-border);
      color: var(--ld-text-2);
    }
  `,
})
export class ConsentBannerComponent {
  visible = signal(getConsentState() === 'pending');

  accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    this.visible.set(false);
    // Analytics already loaded unconditionally (Georgia jurisdiction)
  }

  decline() {
    localStorage.setItem(CONSENT_KEY, 'declined');
    this.visible.set(false);
    // Analytics still running — consent banner is informational only
  }

  private loadMetrika() {
    if (document.getElementById('ym-script')) return;
    const s = document.createElement('script');
    s.id = 'ym-script';
    s.async = true;
    s.src = 'https://mc.yandex.ru/metrika/tag.js?id=110570889';
    document.head.appendChild(s);
    s.onload = () => {
      (window as any).ym?.(110570889, 'init', {
        clickmap: true, trackLinks: true, accurateTrackBounce: true,
      });
      // Send first-touch URL so Metrika attributes the source correctly
      // (by the time consent is granted, Angular router has stripped UTM params)
      try {
        const ft = localStorage.getItem('ld_first_touch');
        if (ft) {
          const parsed = JSON.parse(ft);
          if (parsed.landing_url) {
            (window as any).ym?.(110570889, 'hit', parsed.landing_url, {
              params: { first_touch: true, ...parsed },
            });
          }
        }
      } catch { /* ignore */ }
    };
  }

  private loadGA() {
    if (document.getElementById('ga-script')) return;
    const s = document.createElement('script');
    s.id = 'ga-script';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-8RSG5LFWBC';
    document.head.appendChild(s);
    (window as any).dataLayer = (window as any).dataLayer || [];
    const gtag = (...args: any[]) => (window as any).dataLayer.push(args);
    gtag('js', new Date());
    gtag('config', 'G-8RSG5LFWBC');
    gtag('config', 'AW-18318311908');
  }
}
