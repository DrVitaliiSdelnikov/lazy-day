import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ProfileStore } from '../../../core/stores/profile.store';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { apiProviders } from '../../../core/providers';
import { CategoryNode, CompanyType } from '../../../core/models';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    ToggleButtonModule,
    SelectButtonModule,
    FormsModule,
  ],
  providers: [...apiProviders],
  template: `
    <div class="onboarding">
      <!-- Step 1: Interests -->
      @if (step() === 1) {
        <h2 class="onboarding__title">
          {{ 'onboarding.interests_title' | translate }}
        </h2>
        <p class="onboarding__subtitle">
          {{ 'onboarding.interests_subtitle' | translate }}
        </p>

        <div class="onboarding__chips">
          @for (cat of categories(); track cat.slug) {
            <button
              class="interest-chip"
              [class.interest-chip--selected]="selectedInterests().has(cat.slug)"
              (click)="toggleInterest(cat.slug)"
            >
              {{ cat.label }}
            </button>
          }
        </div>

        <button
          pButton
          [label]="'onboarding.next' | translate"
          [disabled]="selectedInterests().size === 0"
          (click)="step.set(2)"
          class="onboarding__btn"></button>
      }

      <!-- Step 2: Company -->
      @if (step() === 2) {
        <h2 class="onboarding__title">
          {{ 'onboarding.company_title' | translate }}
        </h2>

        <div class="onboarding__options">
          @for (opt of companyOptions; track opt.value) {
            <button
              class="company-option"
              [class.company-option--selected]="selectedCompany() === opt.value"
              (click)="selectedCompany.set(opt.value)"
            >
              <span class="company-option__icon">{{ opt.icon }}</span>
              <span>{{ opt.label }}</span>
            </button>
          }
          <button
            class="company-option"
            [class.company-option--selected]="selectedPet()"
            (click)="selectedPet.set(!selectedPet())"
          >
            <span class="company-option__icon">🐕</span>
            <span>С питомцем</span>
          </button>
        </div>

        <button
          pButton
          [label]="'onboarding.next' | translate"
          (click)="step.set(3)"
          class="onboarding__btn"></button>
      }

      <!-- Step 3: Location -->
      @if (step() === 3) {
        <h2 class="onboarding__title">
          {{ 'onboarding.location_title' | translate }}
        </h2>
        <p class="onboarding__subtitle">
          {{ 'onboarding.location_subtitle' | translate }}
        </p>

        <button
          pButton
          [label]="geoLoading() ? ('onboarding.locating' | translate) : ('onboarding.use_location' | translate)"
          [loading]="geoLoading()"
          severity="secondary"
          (click)="requestGeo()"
          class="onboarding__btn"></button>

        <p class="onboarding__or">{{ 'onboarding.or' | translate }}</p>

        <div class="onboarding__districts">
          @for (d of districts; track d.name) {
            <button
              class="district-chip"
              (click)="selectDistrict(d)"
            >
              {{ d.name }}
            </button>
          }
        </div>
      }

      <!-- Skip -->
      @if (step() < 3) {
        <button
          pButton
          [label]="'onboarding.skip' | translate"
          [text]="true"
          severity="secondary"
          (click)="skip()"
          class="onboarding__skip"></button>
      }
    </div>
  `,
  styles: `
    .onboarding {
      padding: var(--ld-space-xl);
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }

    .onboarding__title {
      font-size: 22px;
      font-weight: 600;
      line-height: 28px;
      margin-bottom: var(--ld-space-sm);
    }

    .onboarding__subtitle {
      font-size: 15px;
      color: var(--ld-text-secondary);
      margin-bottom: var(--ld-space-xl);
    }

    .onboarding__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ld-space-sm);
      margin-bottom: var(--ld-space-xl);
    }

    .interest-chip {
      padding: 8px 16px;
      border-radius: 20px;
      border: 1.5px solid var(--ld-divider);
      background: var(--ld-card-bg);
      color: var(--ld-text);
      font-size: 15px;
      cursor: pointer;
      min-height: 48px;
      transition: all 120ms;

      &--selected {
        border-color: var(--ld-accent);
        background: rgba(47, 111, 237, 0.08);
        color: var(--ld-accent);
        font-weight: 500;
      }
    }

    .onboarding__options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ld-space-md);
      margin-bottom: var(--ld-space-xl);
    }

    .company-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ld-space-sm);
      padding: var(--ld-space-lg);
      border-radius: var(--ld-radius-md);
      border: 1.5px solid var(--ld-divider);
      background: var(--ld-card-bg);
      color: var(--ld-text);
      font-size: 15px;
      cursor: pointer;
      min-height: 48px;

      &--selected {
        border-color: var(--ld-accent);
        background: rgba(47, 111, 237, 0.08);
      }
    }

    .company-option__icon {
      font-size: 28px;
    }

    .onboarding__btn {
      width: 100%;
      margin-bottom: var(--ld-space-md);
    }

    .onboarding__skip {
      width: 100%;
      margin-top: auto;
    }

    .onboarding__or {
      text-align: center;
      color: var(--ld-text-secondary);
      margin: var(--ld-space-md) 0;
    }

    .onboarding__districts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ld-space-sm);
    }

    .district-chip {
      padding: 8px 14px;
      border-radius: 16px;
      border: 1px solid var(--ld-divider);
      background: var(--ld-card-bg);
      color: var(--ld-text);
      font-size: 14px;
      cursor: pointer;
      min-height: 48px;
    }
  `,
})
export class OnboardingComponent implements OnInit {
  private api = inject(ApiService);
  private profileStore = inject(ProfileStore);
  private geo = inject(GeolocationService);
  private router = inject(Router);

  step = signal(1);
  categories = signal<CategoryNode[]>([]);
  selectedInterests = signal(new Set<string>());
  selectedCompany = signal<CompanyType | null>(null);
  selectedPet = signal(false);
  geoLoading = signal(false);

  companyOptions: { value: CompanyType; label: string; icon: string }[] = [
    { value: 'solo', label: 'Один', icon: '🧑' },
    { value: 'couple', label: 'Вдвоём', icon: '👫' },
    { value: 'family', label: 'С семьёй', icon: '👨‍👩‍👧' },
    { value: 'friends', label: 'С друзьями', icon: '👥' },
  ];

  districts = [
    { name: 'Старый город', lat: 41.6934, lng: 44.8015 },
    { name: 'Вера', lat: 41.7089, lng: 44.7853 },
    { name: 'Ваке', lat: 41.7137, lng: 44.7505 },
    { name: 'Сабуртало', lat: 41.7267, lng: 44.7505 },
    { name: 'Мтацминда', lat: 41.6978, lng: 44.7926 },
    { name: 'Дигоми', lat: 41.7658, lng: 44.7299 },
  ];

  ngOnInit() {
    this.api.getCategories().subscribe((cats) => this.categories.set(cats));
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

  selectDistrict(d: { name: string; lat: number; lng: number }) {
    this.geo.setFallback(d.lat, d.lng);
    this.finishOnboarding();
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
}
