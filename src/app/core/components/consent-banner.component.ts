import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';

const CONSENT_KEY = 'ld_consent';

export type ConsentState = 'accepted' | 'declined' | 'pending';

export function getConsentState(): ConsentState {
  return (localStorage.getItem(CONSENT_KEY) as ConsentState) || 'pending';
}

@Component({
  selector: 'app-consent-banner',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="consent">
        <div class="consent__content">
          <p class="consent__text">
            We use your clicks and saves to improve recommendations.
            No cookies, no personal data.
            <a class="consent__link" routerLink="/privacy">Learn more</a>
          </p>
          <div class="consent__actions">
            <button class="consent__btn consent__btn--accept" (click)="accept()">Accept</button>
            <button class="consent__btn consent__btn--decline" (click)="decline()">Essentials only</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .consent {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: var(--ld-card-bg, #fff);
      border-top: 1px solid var(--ld-divider);
      box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
      padding: 16px;
    }

    .consent__content {
      max-width: 600px;
      margin: 0 auto;
    }

    .consent__text {
      font-size: 13px;
      line-height: 1.5;
      color: var(--ld-text-secondary);
      margin-bottom: 12px;
    }

    .consent__link {
      color: var(--ld-primary, #6366f1);
      text-decoration: underline;
    }

    .consent__actions {
      display: flex;
      gap: 8px;
    }

    .consent__btn {
      flex: 1;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      min-height: 44px;
      border: none;
    }

    .consent__btn--accept {
      background: var(--ld-primary, #6366f1);
      color: white;
    }

    .consent__btn--decline {
      background: none;
      border: 1px solid var(--ld-divider);
      color: var(--ld-text-secondary);
    }
  `,
})
export class ConsentBannerComponent {
  visible = signal(getConsentState() === 'pending');

  accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    this.visible.set(false);
  }

  decline() {
    localStorage.setItem(CONSENT_KEY, 'declined');
    this.visible.set(false);
  }
}
