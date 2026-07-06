import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SliderModule } from 'primeng/slider';
import { FormsModule } from '@angular/forms';
import { ProfileStore, ThemeMode } from '../../core/stores/profile.store';
import { ApiService } from '../../core/services/api.service';
import { apiProviders } from '../../core/providers';
import { CategoryNode, CompanyType, Locale } from '../../core/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslatePipe, ButtonModule, SelectButtonModule, SliderModule, FormsModule],
  providers: [...apiProviders],
  template: `
    <div class="settings">
      <h1 class="settings__title">{{ 'settings.title' | translate }}</h1>

      <!-- Language -->
      <section class="settings__section">
        <h3 class="settings__label">{{ 'settings.language' | translate }}</h3>
        <p-selectbutton
          [options]="languages"
          [ngModel]="profileStore.locale()"
          (ngModelChange)="onLocaleChange($event)"
          optionLabel="label"
          optionValue="value"
        ></p-selectbutton>
      </section>

      <!-- Theme -->
      <section class="settings__section">
        <h3 class="settings__label">{{ 'settings.theme' | translate }}</h3>
        <p-selectbutton
          [options]="themes"
          [ngModel]="profileStore.theme()"
          (ngModelChange)="onThemeChange($event)"
          optionLabel="label"
          optionValue="value"
        ></p-selectbutton>
      </section>

      <!-- Interests (editable) -->
      <section class="settings__section">
        <div class="settings__section-header">
          <h3 class="settings__label">{{ 'settings.interests' | translate }}</h3>
          <button pButton [label]="editingInterests() ? ('settings.done' | translate) : ('settings.edit' | translate)"
            [text]="true" size="small" (click)="editingInterests.set(!editingInterests())"></button>
        </div>

        @if (editingInterests()) {
          <div class="settings__chips-grid">
            @for (cat of categories(); track cat.slug) {
              <button
                class="settings__chip-edit"
                [class.settings__chip-edit--active]="isInterestSelected(cat.slug)"
                (click)="toggleInterest(cat.slug)"
              >{{ cat.label }}</button>
            }
          </div>
        } @else {
          <div class="settings__interests">
            @for (entry of interestEntries(); track entry[0]) {
              <span class="settings__chip">{{ getCategoryLabel(entry[0]) }}</span>
            }
            @if (interestEntries().length === 0) {
              <p class="settings__muted">{{ 'settings.no_interests' | translate }}</p>
            }
          </div>
        }
      </section>

      <!-- Company -->
      <section class="settings__section">
        <h3 class="settings__label">{{ 'settings.company' | translate }}</h3>
        <p-selectbutton
          [options]="companyOptions"
          [ngModel]="profileStore.company()"
          (ngModelChange)="onCompanyChange($event)"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="true"
        ></p-selectbutton>
      </section>

      <!-- Budget -->
      <section class="settings__section">
        <h3 class="settings__label">
          {{ 'settings.budget' | translate }}
          @if (budgetValue() > 0) {
            : {{ budgetValue() }} GEL
          } @else {
            : {{ 'settings.any_budget' | translate }}
          }
        </h3>
        <p-slider
          [ngModel]="budgetValue()"
          (ngModelChange)="onBudgetChange($event)"
          [min]="0" [max]="500" [step]="10"
        ></p-slider>
      </section>

      <!-- City -->
      <section class="settings__section">
        <h3 class="settings__label">{{ 'settings.city' | translate }}</h3>
        <p>Tbilisi</p>
      </section>

      <!-- Reset -->
      <section class="settings__section">
        <button pButton [label]="'settings.reset' | translate"
          severity="danger" [outlined]="true" (click)="onReset()"></button>
      </section>
    </div>
  `,
  styles: `
    .settings {
      padding: var(--ld-space-lg);
      padding-bottom: 80px;
    }

    .settings__title {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: var(--ld-space-xl);
    }

    .settings__section {
      margin-bottom: var(--ld-space-xl);
    }

    .settings__section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--ld-space-sm);
    }

    .settings__label {
      font-size: 14px;
      font-weight: 500;
      color: var(--ld-text-secondary);
      margin-bottom: var(--ld-space-sm);
    }

    .settings__section-header .settings__label {
      margin-bottom: 0;
    }

    .settings__interests {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ld-space-xs);
    }

    .settings__chip {
      padding: 4px 12px;
      border-radius: 12px;
      background: rgba(47, 111, 237, 0.08);
      color: var(--ld-accent);
      font-size: 13px;
    }

    .settings__chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ld-space-sm);
    }

    .settings__chip-edit {
      padding: 8px 14px;
      border-radius: 20px;
      border: 1.5px solid var(--ld-divider);
      background: var(--ld-card-bg);
      color: var(--ld-text);
      font-size: 14px;
      cursor: pointer;
      min-height: 40px;
      transition: all 120ms;

      &--active {
        border-color: var(--ld-accent);
        background: rgba(47, 111, 237, 0.08);
        color: var(--ld-accent);
        font-weight: 500;
      }
    }

    .settings__muted {
      color: var(--ld-text-secondary);
      font-size: 14px;
    }
  `,
})
export class SettingsComponent implements OnInit {
  readonly profileStore = inject(ProfileStore);
  private translate = inject(TranslateService);
  private api = inject(ApiService);
  private router = inject(Router);

  categories = signal<CategoryNode[]>([]);
  editingInterests = signal(false);
  budgetValue = signal(0);

  languages = [
    { label: 'RU', value: 'ru' },
    { label: 'EN', value: 'en' },
  ];

  themes = [
    { label: 'Auto', value: 'auto' },
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ];

  companyOptions = [
    { label: '🧑 Один', value: 'solo' },
    { label: '👫 Вдвоём', value: 'couple' },
    { label: '👨‍👩‍👧 Семья', value: 'family' },
    { label: '👥 Друзья', value: 'friends' },
  ];

  ngOnInit() {
    this.api.getCategories().subscribe((cats) => this.categories.set(cats));
    this.budgetValue.set(this.profileStore.budgetMax() ?? 0);
  }

  interestEntries() {
    return Object.entries(this.profileStore.interests());
  }

  isInterestSelected(slug: string): boolean {
    return slug in this.profileStore.interests();
  }

  getCategoryLabel(slug: string): string {
    return this.categories().find((c) => c.slug === slug)?.label ?? slug;
  }

  toggleInterest(slug: string) {
    this.profileStore.toggleInterest(slug);
  }

  onLocaleChange(locale: Locale) {
    this.profileStore.setLocale(locale);
    this.translate.use(locale);
  }

  onThemeChange(theme: ThemeMode) {
    this.profileStore.setTheme(theme);
    this.applyTheme(theme);
  }

  onCompanyChange(company: CompanyType | null) {
    this.profileStore.setCompany(company);
  }

  onBudgetChange(value: number) {
    this.budgetValue.set(value);
    this.profileStore.setBudgetMax(value > 0 ? value : null);
  }

  onReset() {
    this.profileStore.resetProfile();
    this.budgetValue.set(0);
    this.applyTheme('auto');
    this.translate.use('ru');
  }

  private applyTheme(theme: ThemeMode) {
    const html = document.documentElement;
    html.classList.remove('dark-mode', 'light-mode');
    if (theme === 'dark') {
      html.classList.add('dark-mode');
    } else if (theme === 'light') {
      html.classList.add('light-mode');
    }
    // 'auto' — no class, CSS media query handles it
  }
}
