import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ProfileStore, ThemeMode } from '../../core/stores/profile.store';
import { ApiService } from '../../core/services/api.service';
import { apiProviders } from '../../core/providers';
import { CategoryNode, CompanyType, Locale } from '../../core/models';
import { LdIconComponent } from '../../core/components/ld-icon.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslatePipe, FormsModule, LdIconComponent],
  providers: [...apiProviders],
  template: `
    <div class="settings">
      <h1 class="settings__title">Профиль</h1>
      <p class="settings__trust">
        <ld-icon name="user" [size]="13" />
        Всё хранится на этом устройстве, без аккаунта
      </p>

      <!-- Interests -->
      <section class="settings__card">
        <div class="settings__card-header">
          <h3 class="settings__label">Мои интересы</h3>
          <button class="ld-btn ld-btn--ghost" (click)="editingInterests.set(!editingInterests())">
            {{ editingInterests() ? 'Готово' : 'Изменить' }}
          </button>
        </div>
        @if (editingInterests()) {
          <div class="settings__chips-grid">
            @for (cat of categories(); track cat.slug) {
              <button class="ld-chip"
                [class.ld-chip--active]="isInterestSelected(cat.slug)"
                (click)="toggleInterest(cat.slug)">{{ cat.label }}</button>
            }
          </div>
        } @else {
          <div class="settings__chips-row">
            @for (entry of interestEntries(); track entry[0]) {
              <span class="ld-badge ld-badge--primary">{{ getCategoryLabel(entry[0]) }}</span>
            }
            @if (interestEntries().length === 0) {
              <p class="settings__muted">Не выбрано</p>
            }
          </div>
        }
      </section>

      <!-- Company + Pet -->
      <section class="settings__card">
        <h3 class="settings__label">Обычно я</h3>
        <div class="settings__company">
          @for (opt of companyOptions; track opt.value) {
            <button class="settings__company-btn"
              [class.settings__company-btn--active]="profileStore.company() === opt.value"
              (click)="onCompanyChange($any(opt.value))"
              [attr.aria-label]="opt.label">
              <ld-icon [name]="opt.icon" [size]="18" />
              <span class="settings__company-label">{{ opt.label }}</span>
            </button>
          }
        </div>
        <div class="settings__pet-row">
          <span class="settings__pet-text">
            <ld-icon name="dog" [size]="16" /> Гуляю с питомцем
          </span>
          <button class="ld-toggle" [class.ld-toggle--on]="profileStore.hasPet()" aria-label="Pet toggle"
            (click)="profileStore.setHasPet(!profileStore.hasPet())"></button>
        </div>
      </section>

      <!-- Theme + Language -->
      <section class="settings__card">
        <h3 class="settings__label">Тема</h3>
        <div class="settings__segment">
          @for (t of themes; track t.value) {
            <button class="settings__seg"
              [class.settings__seg--active]="profileStore.theme() === t.value"
              (click)="onThemeChange($any(t.value))">{{ t.label }}</button>
          }
        </div>

        <h3 class="settings__label" style="margin-top: 16px">Язык</h3>
        <div class="settings__segment">
          @for (lang of languages; track lang.value) {
            <button class="settings__seg"
              [class.settings__seg--active]="profileStore.locale() === lang.value"
              (click)="onLocaleChange($any(lang.value))">{{ lang.label }}</button>
          }
        </div>
      </section>

      <!-- Links -->
      <section class="settings__card">
        <a routerLink="/privacy" class="settings__link">Конфиденциальность</a>
        <div class="settings__link settings__link--muted">О приложении · LaziGo v0.1</div>
      </section>

      <!-- Reset -->
      <section class="settings__card">
        <button class="ld-btn ld-btn--ghost" style="color: var(--ld-danger); width: 100%; justify-content: flex-start"
          (click)="onReset()">Сбросить профиль</button>
      </section>
    </div>
  `,
  styles: `
    .settings {
      padding: var(--ld-space-lg);
      padding-bottom: 80px;
      max-width: 640px;
      margin: 0 auto;
    }

    .settings__title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .settings__trust {
      font-size: 11px;
      color: var(--ld-text-2);
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: var(--ld-space-lg);
    }

    .settings__card {
      background: var(--ld-surface);
      border: 1px solid var(--ld-border);
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 12px;
    }

    .settings__card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .settings__label {
      font-size: 13px;
      font-weight: 600;
      color: var(--ld-text);
      margin: 0 0 8px;
    }

    .settings__chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .settings__chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .settings__muted {
      font-size: 13px;
      color: var(--ld-text-3);
    }

    .settings__company {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }

    .settings__company-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid var(--ld-border);
      background: var(--ld-surface);
      color: var(--ld-text-3);
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      min-width: 60px;
      transition: background 150ms, color 150ms;
    }

    .settings__company-btn--active {
      background: var(--ld-primary-soft);
      color: var(--ld-on-primary-soft);
      border-color: transparent;
    }

    .settings__company-label {
      font-size: 11px;
    }

    .settings__pet-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .settings__pet-text {
      font-size: 13px;
      color: var(--ld-text);
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .settings__segment {
      display: flex;
      gap: 3px;
      background: var(--ld-surface-2);
      border-radius: 10px;
      padding: 3px;
    }

    .settings__seg {
      flex: 1;
      padding: 6px 8px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      border-radius: 8px;
      background: none;
      color: var(--ld-text-2);
      cursor: pointer;
      font-family: inherit;
      text-align: center;
    }

    .settings__seg--active {
      background: var(--ld-surface);
      color: var(--ld-on-primary-soft);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .settings__link {
      display: block;
      font-size: 14px;
      color: var(--ld-primary);
      text-decoration: none;
      padding: 6px 0;
    }

    .settings__link--muted {
      color: var(--ld-text-3);
      font-size: 12px;
    }

    @media (min-width: 1024px) {
      .settings {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        align-content: start;
      }
      .settings__title, .settings__trust { grid-column: 1 / -1; }
    }
  `,
})
export class SettingsComponent implements OnInit {
  readonly profileStore = inject(ProfileStore);
  private api = inject(ApiService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  categories = signal<CategoryNode[]>([]);
  editingInterests = signal(false);
  budgetValue = signal(0);

  languages = [
    { value: 'ru', label: 'Рус' },
    { value: 'en', label: 'Eng' },
    { value: 'ka', label: 'ქარ' },
  ];

  themes = [
    { value: 'auto', label: 'Авто' },
    { value: 'light', label: '☀' },
    { value: 'dark', label: '🌙' },
  ];

  companyOptions = [
    { value: 'solo', label: 'Один', icon: 'user' },
    { value: 'couple', label: 'Пара', icon: 'hearts' },
    { value: 'friends', label: 'Друзья', icon: 'users' },
    { value: 'family', label: 'Семья', icon: 'balloon' },
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

  toggleInterest(slug: string) {
    this.profileStore.toggleInterest(slug);
  }

  getCategoryLabel(slug: string): string {
    return this.categories().find((c) => c.slug === slug)?.label ?? slug;
  }

  onLocaleChange(locale: Locale) {
    this.profileStore.setLocale(locale);
    this.translate.use(locale);
  }

  onThemeChange(theme: ThemeMode) {
    this.profileStore.setTheme(theme);
  }

  onCompanyChange(company: CompanyType | null) {
    this.profileStore.setCompany(company);
  }

  onReset() {
    this.profileStore.resetProfile();
    this.router.navigate(['/discover/onboarding']);
  }
}
