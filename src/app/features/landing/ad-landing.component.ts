import { Component, inject, OnInit, signal } from '@angular/core';
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
          <div class="land__actions">
            <button class="ld-btn ld-btn--primary land__cta" (click)="goToFeed()">
              {{ 'landing.cta' | translate }}
            </button>
            <button class="land__setup-btn" (click)="goToOnboarding()">
              <ld-icon name="sliders" [size]="13" />
              {{ 'landing.setup_interests' | translate }}
            </button>
          </div>
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

      <!-- Event cards -->
      @if (eventCards().length > 0) {
        <section class="land__examples">
          <h2 class="land__section-title">{{ 'landing.events_title' | translate }}</h2>
          <div class="land__cards">
            @for (card of eventCards(); track card.id) {
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

        <!-- Company: icon + label -->
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

        <!-- Presets: icon + label, same as discover toolbar -->
        <div class="land__chips" style="margin-top: 10px">
          @for (p of presetChips; track p.key) {
            <button class="ld-chip"
              [class.ld-chip--active]="selectedPreset() === p.key"
              (click)="selectPreset(p.key)">
              <ld-icon [name]="p.icon" [size]="14" />
              {{ p.labelKey | translate }}
            </button>
          }
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

    .land__actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .land__cta {
      min-width: 200px;
      min-height: 48px;
      font-size: 16px;
    }

    .land__setup-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 200px;
      min-height: 48px;
      padding: 0 24px;
      background: none;
      border: 1.5px solid var(--ld-primary);
      border-radius: 14px;
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
      color: var(--ld-primary);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .land__setup-btn:hover {
      background: var(--ld-primary-soft);
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

  companyChips = [
    { value: 'solo',    labelKey: 'company.solo',    icon: 'user' },
    { value: 'couple',  labelKey: 'company.couple',  icon: 'hearts' },
    { value: 'friends', labelKey: 'company.friends', icon: 'users' },
    { value: 'family',  labelKey: 'company.family',  icon: 'balloon' },
  ];

  presetChips: Array<{ key: string; labelKey: string; icon: string; interests: Record<string, number> }> = [
    { key: 'chill',     labelKey: 'preset.chill',     icon: 'trees',           interests: { nature: 0.8, food: 0.5, spa: 0.5 } },
    { key: 'food',      labelKey: 'preset.food',       icon: 'tools-kitchen-2', interests: { food: 1 } },
    { key: 'culture',   labelKey: 'preset.culture',    icon: 'masks-theater',   interests: { culture: 1, food: 0.3 } },
    { key: 'active',    labelKey: 'preset.active',     icon: 'run',             interests: { active: 1, sports: 0.5 } },
    { key: 'family',    labelKey: 'preset.family',     icon: 'balloon',         interests: { family: 1, entertainment: 0.5 } },
    { key: 'nightlife', labelKey: 'preset.nightlife',  icon: 'moon',            interests: { nightlife: 1 } },
  ];

  currentLang     = signal(this.profileStore.locale());
  selectedCompany = signal<string | null>(null);
  selectedPreset  = signal<string | null>(null);
  selectedPet     = signal(false);
  exampleCards    = signal<RecommendationCard[]>([]);
  eventCards      = signal<RecommendationCard[]>([]);

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
    localStorage.setItem('ld_welcome_done', 'true');
    this.router.navigate(['/discover/onboarding']);
  }

  private applySelectionsToStore() {
    const presetKey = this.selectedPreset();
    const preset = this.presetChips.find(p => p.key === presetKey);
    if (preset) {
      this.profileStore.setInterests(preset.interests);
    }
    if (this.selectedCompany()) {
      this.profileStore.setCompany(this.selectedCompany() as any);
    }
    if (this.selectedPet()) {
      this.profileStore.setHasPet(true);
    }
    // Sync preset to sessionStorage so discover toolbar shows it active
    if (presetKey) {
      const filters = JSON.parse(sessionStorage.getItem('ld_filters') || '{}');
      filters.preset = presetKey;
      sessionStorage.setItem('ld_filters', JSON.stringify(filters));
    }
  }

  selectCompany(value: string) {
    this.selectedCompany.set(this.selectedCompany() === value ? null : value);
    this.loadExamples();
  }

  togglePet() {
    this.selectedPet.set(!this.selectedPet());
    this.loadExamples();
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
    }).subscribe(res => {
      this.exampleCards.set(res.cards.filter(c => c.type === 'place' && !c.isChain).slice(0, 6));
      this.eventCards.set(res.cards.filter(c => c.type === 'event').slice(0, 3));
    });
  }

}
