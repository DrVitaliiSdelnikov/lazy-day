import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ProfileStore } from '../../../core/stores/profile.store';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { apiProviders } from '../../../core/providers';
import { CategoryNode, CompanyType } from '../../../core/models';
import { LdIconComponent } from '../../../core/components/ld-icon.component';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [TranslatePipe, FormsModule, LdIconComponent],
  providers: [...apiProviders],
  template: `
    <div class="ob">
      <!-- Progress + Skip -->
      <div class="ob__topbar">
        <div class="ob__progress">
          @for (s of [1,2,3]; track s) {
            <span class="ob__dot" [class.ob__dot--active]="step() === s"></span>
          }
        </div>
        <button class="ld-btn ld-btn--ghost ob__skip" (click)="skip()">{{ 'onboarding.skip' | translate }}</button>
      </div>

      <!-- Step 1: Interests -->
      @if (step() === 1) {
        <h1 class="ob__title ld-display">{{ 'onboarding.interests_title' | translate }}</h1>
        <p class="ob__subtitle">{{ 'onboarding.interests_subtitle' | translate }}</p>

        <div class="ob__grid">
          @for (cat of interestOptions; track cat.slug) {
            <button class="ob__interest"
              [class.ob__interest--selected]="selectedInterests().has(cat.slug)"
              (click)="toggleInterest(cat.slug)">
              <ld-icon [name]="cat.icon" [size]="18"
                [class]="selectedInterests().has(cat.slug) ? '' : 'ob__interest-icon-dim'" />
              {{ cat.labelKey | translate }}
              @if (selectedInterests().has(cat.slug)) {
                <ld-icon name="star-filled" [size]="14" class="ob__check" />
              }
            </button>
          }
        </div>

        <div class="ob__footer">
          @if (selectedInterests().size === 0) {
            <p class="ob__hint">{{ 'onboarding.pick_hint' | translate }}</p>
          }
          <button class="ld-btn ld-btn--primary ob__cta"
            [disabled]="selectedInterests().size === 0"
            (click)="step.set(2)">
            {{ nextLabel() }}
          </button>
        </div>
      }

      <!-- Step 2: Company + Pet -->
      @if (step() === 2) {
        <h1 class="ob__title ld-display">{{ 'onboarding.company_title' | translate }}</h1>
        <p class="ob__subtitle">{{ 'onboarding.company_subtitle' | translate }}</p>

        <div class="ob__company-grid">
          @for (opt of companyOptions; track opt.value) {
            <button class="ob__company"
              [class.ob__company--selected]="selectedCompany() === opt.value"
              (click)="selectedCompany.set(opt.value)">
              <ld-icon [name]="opt.icon" [size]="22" />
              <span>{{ opt.labelKey | translate }}</span>
            </button>
          }
        </div>

        <div class="ob__pet-row">
          <span class="ob__pet-text">
            <ld-icon name="dog" [size]="18" /> {{ 'onboarding.with_pet' | translate }}
          </span>
          <button class="ld-toggle" [class.ld-toggle--on]="selectedPet()"
            (click)="selectedPet.set(!selectedPet())" aria-label="Pet toggle"></button>
        </div>

        <div class="ob__footer">
          <button class="ld-btn ld-btn--primary ob__cta" (click)="step.set(3)">{{ 'onboarding.next' | translate }}</button>
        </div>
      }

      <!-- Step 3: Location -->
      @if (step() === 3) {
        <h1 class="ob__title ld-display">{{ 'onboarding.location_title' | translate }}</h1>
        <p class="ob__subtitle">{{ 'onboarding.location_subtitle' | translate }}</p>

        <button class="ld-btn ld-btn--primary ob__cta" style="margin-bottom: 12px"
          (click)="requestGeo()">
          {{ (geoLoading() ? 'onboarding.locating' : 'onboarding.use_location') | translate }}
        </button>

        <p class="ob__or">{{ 'onboarding.or' | translate }}</p>

        <div class="ob__coords-row">
          <input class="ld-input" placeholder="41.694, 45.009" #coordsInput />
          <button class="ld-btn ld-btn--secondary" style="min-width: 50px"
            (click)="applyCoords(coordsInput.value)">OK</button>
        </div>
        @if (coordsError()) {
          <p class="ob__error">{{ coordsError() }}</p>
        }
      }
    </div>
  `,
  styles: `
    .ob {
      min-height: 100vh;
      padding: 16px;
      background: var(--ld-bg);
      display: flex;
      flex-direction: column;
    }

    .ob__topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .ob__progress {
      display: flex;
      gap: 5px;
    }

    .ob__dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--ld-border);
    }

    .ob__dot--active {
      width: 20px;
      background: var(--ld-primary);
    }

    .ob__skip {
      font-size: 13px;
    }

    .ob__title {
      font-size: 20px;
      margin: 0 0 4px;
    }

    .ob__subtitle {
      font-size: 12px;
      color: var(--ld-text-2);
      margin: 0 0 16px;
    }

    .ob__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    @media (min-width: 1024px) {
      .ob {
        align-items: center;
        justify-content: center;
      }
      .ob__grid {
        grid-template-columns: repeat(4, 1fr);
        max-width: 560px;
      }
    }

    .ob__interest {
      background: var(--ld-surface);
      border: 1.5px solid var(--ld-border);
      border-radius: 16px;
      padding: 12px 10px;
      font-size: 13px;
      font-weight: 500;
      color: var(--ld-text);
      cursor: pointer;
      font-family: inherit;
      position: relative;
      text-align: left;
      display: flex;
      gap: 4px;
    }

    .ob__interest--selected {
      background: var(--ld-primary-soft);
      border-color: var(--ld-primary);
      color: var(--ld-on-primary-soft);
    }

    .ob__interest-icon-dim {
      color: var(--ld-text-2);
    }

    .ob__check {
      position: absolute;
      top: 8px;
      right: 8px;
      color: var(--ld-primary);
    }

    .ob__footer {
      padding: 12px 0 16px;
      background: var(--ld-bg);
    }

    @media (min-width: 1024px) {
      .ob__footer { max-width: 560px; width: 100%; }
    }

    .ob__hint {
      font-size: 11px;
      color: var(--ld-text-3);
      text-align: center;
      margin: 0 0 8px;
    }

    .ob__cta {
      width: 100%;
    }

    .ob__company-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }

    .ob__company {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 16px 12px;
      border-radius: 16px;
      border: 1.5px solid var(--ld-border);
      background: var(--ld-surface);
      color: var(--ld-text-2);
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
    }

    .ob__company--selected {
      background: var(--ld-primary-soft);
      border-color: var(--ld-primary);
      color: var(--ld-on-primary-soft);
    }

    .ob__pet-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
    }

    .ob__pet-text {
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ob__or {
      text-align: center;
      font-size: 13px;
      color: var(--ld-text-3);
      margin: 8px 0;
    }

    .ob__coords-row {
      display: flex;
      gap: 8px;
    }

    .ob__error {
      color: var(--ld-danger);
      font-size: 12px;
      margin: 6px 0 0;
    }
  `,
})
export class OnboardingComponent implements OnInit {
  private api = inject(ApiService);
  private profileStore = inject(ProfileStore);
  private geo = inject(GeolocationService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  step = signal(1);
  categories = signal<CategoryNode[]>([]);
  selectedInterests = signal(new Set<string>());
  selectedCompany = signal<CompanyType | null>(null);
  selectedPet = signal(false);
  geoLoading = signal(false);
  coordsError = signal<string | null>(null);

  interestOptions = [
    { slug: 'nature', labelKey: 'interest.nature', icon: 'trees' },
    { slug: 'food', labelKey: 'interest.food', icon: 'tools-kitchen-2' },
    { slug: 'culture', labelKey: 'interest.culture', icon: 'masks-theater' },
    { slug: 'active', labelKey: 'interest.active', icon: 'run' },
    { slug: 'entertainment', labelKey: 'interest.entertainment', icon: 'movie' },
    { slug: 'nightlife', labelKey: 'interest.nightlife', icon: 'moon' },
    { slug: 'family', labelKey: 'interest.family', icon: 'balloon' },
    { slug: 'spa', labelKey: 'interest.spa', icon: 'coffee' },
    { slug: 'gym', labelKey: 'interest.gym', icon: 'barbell' },
  ];

  companyOptions = [
    { value: 'solo' as CompanyType, labelKey: 'company.solo', icon: 'user' },
    { value: 'couple' as CompanyType, labelKey: 'company.couple_alt', icon: 'hearts' },
    { value: 'friends' as CompanyType, labelKey: 'company.friends_alt', icon: 'users' },
    { value: 'family' as CompanyType, labelKey: 'company.family_alt', icon: 'balloon' },
  ];

  nextLabel(): string {
    const count = this.selectedInterests().size;
    return this.translate.instant('onboarding.next_selected', { count });
  }

  ngOnInit() {
    this.api.getCategories().subscribe((cats) => this.categories.set(cats));
    localStorage.setItem('ld_welcome_done', 'true');
  }

  toggleInterest(slug: string) {
    const current = new Set(this.selectedInterests());
    if (current.has(slug)) {
      current.delete(slug);
    } else {
      current.add(slug);
    }
    this.selectedInterests.set(current);
  }

  async requestGeo() {
    this.geoLoading.set(true);
    await this.geo.requestPosition();
    this.geoLoading.set(false);
    this.finishOnboarding();
  }

  applyCoords(input: string) {
    const parsed = this.parseCoordinates(input);
    if (parsed) {
      this.geo.setFallback(parsed.lat, parsed.lng);
      this.coordsError.set(null);
      this.finishOnboarding();
    } else {
      this.coordsError.set(this.translate.instant('onboarding.coords_error'));
    }
  }

  skip() {
    this.finishOnboarding();
  }

  private finishOnboarding() {
    const interests: Record<string, number> = {};
    for (const slug of this.selectedInterests()) {
      interests[slug] = 1.0;
    }
    this.profileStore.setInterests(interests);
    if (this.selectedCompany()) {
      this.profileStore.setCompany(this.selectedCompany());
    }
    this.profileStore.setHasPet(this.selectedPet());
    this.profileStore.completeOnboarding();
    this.router.navigate(['/discover']);
  }

  private parseCoordinates(input: string): { lat: number; lng: number } | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const decimalMatch = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (decimalMatch) {
      const lat = parseFloat(decimalMatch[1]);
      const lng = parseFloat(decimalMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
    const dmsPattern = /(\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]\s*([NS])\s*(\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]\s*([EW])/i;
    const dmsMatch = trimmed.match(dmsPattern);
    if (dmsMatch) {
      let lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
      let lng = parseInt(dmsMatch[5]) + parseInt(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600;
      if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
      if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;
      return { lat, lng };
    }
    return null;
  }
}
