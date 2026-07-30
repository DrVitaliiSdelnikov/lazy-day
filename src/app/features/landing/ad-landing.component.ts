import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ProfileStore } from '../../core/stores/profile.store';
import { GeolocationService } from '../../core/services/geolocation.service';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { ResultCardComponent } from '../discover/result-card/result-card.component';
import { apiProviders } from '../../core/providers';
import { RecommendationCard, Locale, PRESET_META, CANONICAL_PRESETS } from '../../core/models';

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
          <div class="land__actions">
            <button class="ld-btn ld-btn--primary land__cta" (click)="goToFeed()">
              {{ 'landing.cta' | translate }}
            </button>
          </div>
          <a class="land__secondary-link" (click)="goToOnboarding()">{{ 'landing.setup_interests' | translate }}</a>
          <p class="land__no-account">
            <ld-icon name="user" [size]="11" /> {{ 'landing.no_account' | translate }}
          </p>
        </div>
      </section>

      <!-- Preset chips (filters above live cards) -->
      <section class="land__contexts">
        <div class="land__chips">
          @for (p of presetChips; track p.key) {
            <button class="ld-chip"
              [class.ld-chip--active]="selectedPreset() === p.key"
              (click)="selectPreset(p.key)">
              <ld-icon [name]="p.icon" [size]="14" />
              {{ p.labelKey | translate }}
            </button>
          }
        </div>
        @if (selectedPreset()) {
          <p class="land__filter-state">{{ 'landing.showing' | translate }}: {{ selectedPresetLabel() }}</p>
        }
      </section>

      <!-- Live cards (places + events mixed) -->
      @if (exampleCards().length > 0 || eventCards().length > 0) {
        <section class="land__examples">
          <div class="land__cards">
            @for (card of exampleCards(); track card.id) {
              <app-result-card [card]="card" [isSaved]="false"
                (openDetail)="goToFeed()" />
            }
            @for (card of eventCards(); track card.id) {
              <app-result-card [card]="card" [isSaved]="false"
                (openDetail)="goToFeed()" />
            }
          </div>
        </section>
      }

      <!-- Honesty line (M2) -->
      <p class="land__honesty">{{ 'landing.honesty' | translate }}</p>

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

      <!-- Company / pet (below fold) -->
      <section class="land__contexts">
        <h2 class="land__section-title">{{ 'landing.context_title' | translate }}</h2>
        <div class="land__chips">
          @for (c of companyChips; track c.value) {
            <button class="ld-chip"
              [class.ld-chip--active]="selectedCompany() === c.value"
              (click)="selectCompany(c.value)">
              <ld-icon [name]="c.icon" [size]="14" />
              {{ c.labelKey | translate }}
            </button>
          }
          <button class="ld-chip"
            [class.ld-chip--active]="selectedPet()"
            (click)="togglePet()">
            <ld-icon name="dog" [size]="14" />
            {{ 'company.with_pet' | translate }}
          </button>
        </div>
      </section>

      <!-- Final CTA -->
      <section class="land__final">
        <button class="ld-btn ld-btn--primary land__cta" (click)="goToFeed()">
          {{ 'landing.cta' | translate }}
        </button>
        <p class="land__diff-text" style="margin-top: 12px">{{ 'landing.diff_text' | translate }}</p>
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

    .land__actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .land__cta {
      width: 100%;
      max-width: 360px;
      min-height: 48px;
      font-size: 16px;
    }

    .land__segment {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
    }

    .land__seg {
      background: none;
      border: none;
      font-family: inherit;
      font-size: 13px;
      color: var(--ld-text-3);
      cursor: pointer;
      padding: 4px 0;
      border-bottom: 2px solid transparent;
    }

    .land__seg--active {
      color: var(--ld-text);
      font-weight: 600;
      border-bottom-color: var(--ld-primary);
    }

    .land__seg-dot {
      color: var(--ld-text-3);
      font-size: 13px;
    }

    .land__filter-state {
      font-size: 12px;
      color: var(--ld-text-2);
      margin: 8px 0 0;
      text-align: center;
    }

    .land__secondary-link {
      display: block;
      text-align: center;
      font-size: 13px;
      color: var(--ld-text-3);
      cursor: pointer;
      margin-top: 8px;
      text-decoration: underline;
      text-underline-offset: 2px;
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


    .land__honesty {
      font-size: 13px;
      color: var(--ld-text-3);
      text-align: center;
      padding: 0 20px 8px;
      margin: 0;
      font-style: italic;
      line-height: 1.5;
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

  companyChips = [
    { value: 'solo',    labelKey: 'company.solo',    icon: 'user' },
    { value: 'couple',  labelKey: 'company.couple',  icon: 'hearts' },
    { value: 'friends', labelKey: 'company.friends', icon: 'users' },
    { value: 'family',  labelKey: 'company.family',  icon: 'balloon' },
  ];

  presetChips = PRESET_META.map(p => ({ ...p, interests: CANONICAL_PRESETS[p.key] }));

  currentLang     = signal(this.profileStore.locale());
  selectedCompany = signal<string | null>(null);
  selectedPreset  = signal<string | null>(null);
  selectedPet     = signal(false);
  exampleCards    = signal<RecommendationCard[]>([]);
  eventCards      = signal<RecommendationCard[]>([]);
  localLevel      = signal(this.inferLocalLevel());

  ngOnInit() {
    // F3.4: Returning user skips landing → straight to feed
    // New user sees landing with instant examples (no gate)
    if (localStorage.getItem('ld_welcome_done')) {
      this.router.navigate(['/discover'], { replaceUrl: true });
      return;
    }

    // Set language: from route data (ad URLs like /en/tbilisi/today),
    // else from stored profile, else default to Russian
    const routeLang = this.route.snapshot.data['lang'] || this.route.snapshot.paramMap.get('lang');
    const lang = routeLang || this.profileStore.locale() || 'ru';
    if (['ru', 'en', 'ka'].includes(lang)) {
      this.setLang(lang);
    }

    // Fire landing_view GA4 event
    (window as any).gtag?.('event', 'landing_view', {
      language: lang,
      landing_type: routeLang ? 'ad' : 'organic',
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
    this.applySelectionsToStore();
    this.profileStore.completeOnboarding();
    localStorage.setItem('ld_welcome_done', 'true');
    this.router.navigate(['/discover']);
  }

  goToOnboarding() {
    this.applySelectionsToStore();
    // Temp flag so guard lets through to onboarding; ld_welcome_done set on completion
    localStorage.setItem('ld_onboarding_started', 'true');
    this.router.navigate(['/discover/onboarding']);
  }

  private applySelectionsToStore() {
    // Company and pet → ProfileStore (persistent preferences)
    if (this.selectedCompany()) {
      this.profileStore.setCompany(this.selectedCompany() as any);
    }
    if (this.selectedPet()) {
      this.profileStore.setHasPet(true);
    }
    // Preset → sessionStorage ONLY (session filter, not persistent preference)
    const presetKey = this.selectedPreset();
    if (presetKey) {
      const filters = JSON.parse(sessionStorage.getItem('ld_filters') || '{}');
      filters.preset = presetKey;
      sessionStorage.setItem('ld_filters', JSON.stringify(filters));
    }
    // Interests NOT written to ProfileStore from preset chips
    // User can promote to preference via "Запомнить" in feed
  }

  selectCompany(value: string) {
    this.selectedCompany.set(this.selectedCompany() === value ? null : value);
    this.loadExamples();
  }

  togglePet() {
    this.selectedPet.set(!this.selectedPet());
    this.loadExamples();
  }

  private inferLocalLevel(): string {
    const stored = this.profileStore.localLevel();
    if (stored && stored !== 'local') return stored;
    // Infer: ka locale → likely local, ru/en from ad → likely visitor
    const lang = this.profileStore.locale();
    return lang === 'ka' ? 'local' : 'local'; // default to local, user can correct
  }

  setLocalLevel(level: string) {
    this.localLevel.set(level);
    this.profileStore.setLocalLevel(level as any);
    this.loadExamples();
  }

  selectedPresetLabel(): string {
    const key = this.selectedPreset();
    const p = this.presetChips.find(c => c.key === key);
    return p ? this.translate.instant(p.labelKey) : '';
  }

  selectPreset(key: string) {
    this.selectedPreset.set(this.selectedPreset() === key ? null : key);
    this.loadExamples();
  }

  private loadExamples() {
    const pos = this.geo.position();
    const presetKey = this.selectedPreset();
    const preset = this.presetChips.find(p => p.key === presetKey);
    const interests: Record<string, number> = preset?.interests ?? {};
    const companyVal = (this.selectedCompany() ?? undefined) as any;

    const now = new Date();
    const timeWindow = {
      from: now.toISOString(),
      to: new Date(now.getTime() + 72 * 3600_000).toISOString(),
    };

    this.api.discover({
      lat: pos.lat,
      lng: pos.lng,
      radiusM: 5000,
      timeWindow,
      profile: { interests, company: companyVal, hasPet: this.selectedPet() },
      hiddenIds: [],
      locale: this.currentLang(),
      deviceIdHash: this.profileStore.deviceIdHash() || undefined,
    }).subscribe(res => {
      this.exampleCards.set(res.cards.filter(c => c.type === 'place' && !c.isChain).slice(0, 3));
      this.eventCards.set(res.cards.filter(c => c.type === 'event').slice(0, 3));
    });
  }

}
