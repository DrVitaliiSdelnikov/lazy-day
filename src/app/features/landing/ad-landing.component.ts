import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ProfileStore } from '../../core/stores/profile.store';
import { GeolocationService } from '../../core/services/geolocation.service';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { ResultCardComponent } from '../discover/result-card/result-card.component';
import { apiProviders } from '../../core/providers';
import { RecommendationCard, Locale } from '../../core/models';

@Component({
  selector: 'app-ad-landing',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent, ResultCardComponent],
  providers: [...apiProviders],
  template: `
    <div class="land">
      <!-- Language switcher -->
      <div class="land__lang">
        @for (l of langs; track l.code) {
          <button class="land__lang-btn" [class.land__lang-btn--active]="currentLang() === l.code"
            (click)="setLang(l.code)">{{ l.label }}</button>
        }
      </div>

      <!-- Hero -->
      <section class="land__hero">
        <div class="land__hero-inner">
          <h1 class="land__title ld-display">{{ 'landing.title' | translate }}</h1>
          <p class="land__subtitle">{{ 'landing.subtitle' | translate }}</p>
          <button class="ld-btn ld-btn--primary land__cta" (click)="goToFeed()">
            {{ 'landing.cta' | translate }}
          </button>
          <p class="land__no-account">
            <ld-icon name="user" [size]="11" /> {{ 'landing.no_account' | translate }}
          </p>
        </div>
      </section>

      <!-- Example cards -->
      @if (exampleCards().length > 0) {
        <section class="land__examples">
          <h2 class="land__section-title">{{ 'landing.examples_title' | translate }}</h2>
          <div class="land__cards">
            @for (card of exampleCards(); track card.id) {
              <app-result-card [card]="card" [isSaved]="false"
                (openDetail)="goToFeed()" />
            }
          </div>
        </section>
      }

      <!-- How it works -->
      <section class="land__how">
        <h2 class="land__section-title">{{ 'landing.how_title' | translate }}</h2>
        <div class="land__steps">
          <div class="land__step">
            <div class="land__step-num">1</div>
            <p>{{ 'landing.how_1' | translate }}</p>
          </div>
          <div class="land__step">
            <div class="land__step-num">2</div>
            <p>{{ 'landing.how_2' | translate }}</p>
          </div>
          <div class="land__step">
            <div class="land__step-num">3</div>
            <p>{{ 'landing.how_3' | translate }}</p>
          </div>
        </div>
      </section>

      <!-- Context examples -->
      <section class="land__contexts">
        <h2 class="land__section-title">{{ 'landing.context_title' | translate }}</h2>
        <div class="land__chips">
          <span class="ld-chip">{{ 'company.solo' | translate }}</span>
          <span class="ld-chip">{{ 'company.couple' | translate }}</span>
          <span class="ld-chip">{{ 'company.friends' | translate }}</span>
          <span class="ld-chip">{{ 'company.family' | translate }}</span>
          <span class="ld-chip">{{ 'company.with_pet' | translate }}</span>
        </div>
        <div class="land__chips" style="margin-top: 8px">
          <span class="ld-chip">{{ 'interest.food' | translate }}</span>
          <span class="ld-chip">{{ 'interest.nature' | translate }}</span>
          <span class="ld-chip">{{ 'interest.culture' | translate }}</span>
          <span class="ld-chip">{{ 'interest.nightlife' | translate }}</span>
          <span class="ld-chip">{{ 'interest.active' | translate }}</span>
        </div>
      </section>

      <!-- Differentiator -->
      <section class="land__diff">
        <h2 class="land__section-title">{{ 'landing.diff_title' | translate }}</h2>
        <p class="land__diff-text">{{ 'landing.diff_text' | translate }}</p>
      </section>

      <!-- Final CTA -->
      <section class="land__final">
        <button class="ld-btn ld-btn--primary land__cta" (click)="goToFeed()">
          {{ 'landing.cta' | translate }}
        </button>
      </section>
    </div>
  `,
  styles: `
    .land {
      background: var(--ld-bg);
      min-height: 100vh;
      position: relative;
    }

    .land__lang {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 2px;
      background: var(--ld-surface);
      border-radius: 10px;
      padding: 3px;
      z-index: 1;
    }

    .land__lang-btn {
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

    .land__lang-btn--active {
      color: var(--ld-primary);
      background: var(--ld-primary-soft);
      font-weight: 600;
    }

    .land__hero {
      padding: 64px 20px 32px;
      text-align: center;
    }

    .land__hero-inner {
      max-width: 560px;
      margin: 0 auto;
    }

    .land__title {
      font-size: 28px;
      color: var(--ld-text);
      margin: 0 0 12px;
      line-height: 1.2;
    }

    @media (min-width: 1024px) {
      .land__title { font-size: 36px; }
    }

    .land__subtitle {
      font-size: 15px;
      color: var(--ld-text-2);
      margin: 0 0 24px;
      line-height: 1.5;
    }

    .land__cta {
      min-width: 200px;
      min-height: 48px;
      font-size: 16px;
    }

    .land__no-account {
      font-size: 11px;
      color: var(--ld-text-3);
      margin: 12px 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .land__section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--ld-text);
      margin: 0 0 16px;
      text-align: center;
    }

    .land__examples {
      padding: 24px 16px;
    }

    .land__cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      max-width: 800px;
      margin: 0 auto;
    }

    @media (min-width: 640px) {
      .land__cards { grid-template-columns: repeat(2, 1fr); }
    }

    @media (min-width: 1024px) {
      .land__cards { grid-template-columns: repeat(3, 1fr); }
    }

    .land__how {
      padding: 32px 20px;
      background: var(--ld-surface);
    }

    .land__steps {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 480px;
      margin: 0 auto;
    }

    @media (min-width: 640px) {
      .land__steps { flex-direction: row; gap: 24px; max-width: 700px; }
    }

    .land__step {
      flex: 1;
      text-align: center;
    }

    .land__step-num {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--ld-primary);
      color: var(--ld-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      margin: 0 auto 8px;
    }

    .land__step p {
      font-size: 13px;
      color: var(--ld-text-2);
      margin: 0;
      line-height: 1.4;
    }

    .land__contexts {
      padding: 32px 20px;
    }

    .land__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
    }

    .land__diff {
      padding: 32px 20px;
      background: var(--ld-primary-soft);
      text-align: center;
    }

    .land__diff-text {
      font-size: 14px;
      color: var(--ld-text);
      max-width: 480px;
      margin: 0 auto;
      line-height: 1.5;
    }

    .land__final {
      padding: 32px 20px 64px;
      text-align: center;
    }
  `,
})
export class AdLandingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private profileStore = inject(ProfileStore);
  private translate = inject(TranslateService);
  private geo = inject(GeolocationService);

  langs = [
    { code: 'ru', label: 'RU' },
    { code: 'en', label: 'EN' },
    { code: 'ka', label: 'KA' },
  ];
  currentLang = signal(this.profileStore.locale());
  exampleCards = signal<RecommendationCard[]>([]);

  ngOnInit() {
    // Set language from URL param
    const lang = this.route.snapshot.paramMap.get('lang') || 'en';
    if (['ru', 'en', 'ka'].includes(lang)) {
      this.setLang(lang);
    }

    // Fire landing_view GA4 event
    (window as any).gtag?.('event', 'landing_view', {
      language: lang,
      landing_type: 'today',
    });

    // Load example cards
    this.loadExamples();
  }

  setLang(code: string) {
    this.profileStore.setLocale(code as Locale);
    this.translate.use(code);
    this.currentLang.set(code as Locale);
  }

  goToFeed() {
    // Skip onboarding — go directly to feed (ghost path)
    this.profileStore.completeOnboarding();
    localStorage.setItem('ld_welcome_done', 'true');
    this.router.navigate(['/discover']);
  }

  private loadExamples() {
    const pos = this.geo.position();
    this.api.discover({
      lat: pos.lat,
      lng: pos.lng,
      radiusM: 5000,
      timeWindow: this.defaultTimeWindow(),
      profile: { interests: {} },
      hiddenIds: [],
      locale: this.currentLang(),
    }).subscribe(res => {
      // Show first 6 non-chain cards
      const filtered = res.cards.filter(c => !c.isChain).slice(0, 6);
      this.exampleCards.set(filtered);
    });
  }

  private defaultTimeWindow() {
    const now = new Date();
    return { from: now.toISOString(), to: new Date(now.getTime() + 6 * 3600000).toISOString() };
  }
}
