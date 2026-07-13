import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ProfileStore, ThemeMode } from '../../core/stores/profile.store';
import { ApiService } from '../../core/services/api.service';
import { apiProviders } from '../../core/providers';
import { CategoryNode, CompanyType, Locale } from '../../core/models';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { ThemeService, ThemeName } from '../../core/services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslatePipe, FormsModule, LdIconComponent],
  providers: [...apiProviders],
  template: `
    <div class="settings">
      <h1 class="settings__title">{{ 'settings.title' | translate }}</h1>
      <p class="settings__trust">
        <ld-icon name="user" [size]="13" />
        {{ 'settings.trust' | translate }}
      </p>

      <!-- Interests -->
      <section class="settings__card">
        <div class="settings__card-header">
          <h3 class="settings__label">{{ 'settings.interests' | translate }}</h3>
          <button class="ld-btn ld-btn--ghost" (click)="editingInterests.set(!editingInterests())">
            {{ (editingInterests() ? 'settings.done' : 'settings.edit') | translate }}
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
              <p class="settings__muted">{{ 'settings.no_interests' | translate }}</p>
            }
          </div>
        }
      </section>

      <!-- Company + Pet -->
      <section class="settings__card">
        <h3 class="settings__label">{{ 'settings.company' | translate }}</h3>
        <div class="settings__company">
          @for (opt of companyOptions; track opt.value) {
            <button class="settings__company-btn"
              [class.settings__company-btn--active]="profileStore.company() === opt.value"
              (click)="onCompanyChange($any(opt.value))"
              [attr.aria-label]="opt.labelKey | translate">
              <ld-icon [name]="opt.icon" [size]="18" />
              <span class="settings__company-label">{{ opt.labelKey | translate }}</span>
            </button>
          }
        </div>
        <div class="settings__pet-row">
          <span class="settings__pet-text">
            <ld-icon name="dog" [size]="16" /> {{ 'settings.with_pet' | translate }}
          </span>
          <button class="ld-toggle" [class.ld-toggle--on]="profileStore.hasPet()" aria-label="Pet toggle"
            (click)="profileStore.setHasPet(!profileStore.hasPet())"></button>
        </div>
      </section>

      <!-- Theme + Language -->
      <section class="settings__card">
        <h3 class="settings__label">{{ 'settings.theme' | translate }}</h3>
        <div class="settings__segment">
          @for (t of themes; track t.value) {
            <button class="settings__seg"
              [class.settings__seg--active]="profileStore.theme() === t.value"
              (click)="onThemeChange($any(t.value))">
              <ld-icon [name]="t.icon" [size]="16" />
            </button>
          }
        </div>

        <h3 class="settings__label" style="margin-top: 16px">{{ 'settings.language' | translate }}</h3>
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
        <button class="settings__link" (click)="openFeedback()">{{ 'settings.feedback' | translate }}</button>
        <a routerLink="/privacy" class="settings__link">{{ 'settings.privacy' | translate }}</a>
        <div class="settings__link settings__link--muted">{{ 'settings.about' | translate }}</div>
      </section>

      <!-- Feedback sheet -->
      @if (feedbackOpen()) {
        <div class="ld-sheet-backdrop ld-sheet-backdrop--visible" (click)="feedbackOpen.set(false)"></div>
        <div class="ld-sheet ld-sheet--open">
          <div class="ld-sheet__handle"></div>
          <h3 style="margin: 0 0 12px; font-size: 16px">{{ 'feedback.title' | translate }}</h3>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px">
            @for (cat of feedbackCategories; track cat.key) {
              <button class="ld-chip" [class.ld-chip--active]="feedbackCategory() === cat.key"
                (click)="feedbackCategory.set(cat.key)">{{ cat.labelKey | translate }}</button>
            }
          </div>
          <label class="settings__field-label">{{ 'feedback.message_label' | translate }} <span style="color:var(--ld-primary)">*</span></label>
          <textarea class="ld-input" rows="4" [placeholder]="'feedback.placeholder' | translate"
            (input)="feedbackText.set($any($event.target).value)" style="width:100%;resize:vertical;margin-bottom:8px"></textarea>
          <label class="settings__field-label">{{ 'feedback.contact_label' | translate }}</label>
          <input class="ld-input" [placeholder]="'feedback.contact_placeholder' | translate"
            (input)="feedbackContact.set($any($event.target).value)" style="width:100%;margin-bottom:12px" />
          <button class="ld-btn ld-btn--primary" style="width:100%" [disabled]="!canSubmitFeedback()"
            (click)="submitFeedback()">{{ 'feedback.submit' | translate }}</button>
        </div>
      }

      <!-- Reset -->
      <section class="settings__card">
        <button class="ld-btn ld-btn--ghost" style="color: var(--ld-danger); width: 100%; justify-content: flex-start"
          (click)="onReset()">{{ 'settings.reset' | translate }}</button>
        <button class="ld-btn ld-btn--ghost" style="color: var(--ld-danger); width: 100%; justify-content: flex-start; margin-top: 8px; font-size: 12px"
          (click)="onDeleteData()">{{ 'settings.delete_data' | translate }}</button>
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

    .settings__field-label {
      display: block;
      font-size: 12px;
      color: var(--ld-text-2);
      margin: 0 0 4px;
    }

    .settings__link {
      display: block;
      font-size: 14px;
      color: var(--ld-primary);
      text-decoration: none;
      padding: 6px 0;
      background: none;
      border: none;
      font-family: inherit;
      text-align: left;
      cursor: pointer;
      width: 100%;
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
  private themeService = inject(ThemeService);

  categories = signal<CategoryNode[]>([]);
  editingInterests = signal(false);
  budgetValue = signal(0);

  // Feedback
  feedbackOpen = signal(false);
  feedbackCategory = signal('idea');
  feedbackText = signal('');
  feedbackContact = signal('');
  feedbackCategories = [
    { key: 'bug', labelKey: 'feedback.cat_bug' },
    { key: 'idea', labelKey: 'feedback.cat_idea' },
    { key: 'missing', labelKey: 'feedback.cat_missing' },
    { key: 'other', labelKey: 'feedback.cat_other' },
  ];
  canSubmitFeedback = computed(() => this.feedbackText().length >= 10 && !!this.feedbackCategory());

  languages = [
    { value: 'ru', label: 'Рус' },
    { value: 'en', label: 'Eng' },
    { value: 'ka', label: 'ქარ' },
  ];

  themes = [
    { value: 'auto', label: '', icon: 'refresh' },
    { value: 'light', label: '', icon: 'sun' },
    { value: 'dark', label: '', icon: 'moon' },
  ];

  companyOptions = [
    { value: 'solo', labelKey: 'company.solo', icon: 'user' },
    { value: 'couple', labelKey: 'company.couple', icon: 'hearts' },
    { value: 'friends', labelKey: 'company.friends', icon: 'users' },
    { value: 'family', labelKey: 'company.family', icon: 'balloon' },
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
    const map: Record<ThemeMode, ThemeName> = { auto: 'auto', light: 'day', dark: 'dark' };
    this.themeService.setPreference(map[theme]);
  }

  onCompanyChange(company: CompanyType | null) {
    this.profileStore.setCompany(company);
  }

  onReset() {
    this.profileStore.resetProfile();
    this.router.navigate(['/discover/onboarding']);
  }

  onDeleteData() {
    if (!confirm(this.translate.instant('settings.delete_confirm'))) return;
    const apiBase = (window.location.hostname !== 'localhost')
      ? 'https://api.lazigo.app/v1' : '/v1';
    fetch(`${apiBase}/auth/me`, {
      method: 'DELETE',
      credentials: 'include',
    }).then(() => {
      this.profileStore.resetProfile();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }).catch(() => {
      // Offline or no server user — just clear local
      this.profileStore.resetProfile();
      localStorage.clear();
      window.location.href = '/';
    });
  }

  openFeedback() {
    this.feedbackOpen.set(true);
  }

  submitFeedback() {
    this.api.submitFeedback({
      category: this.feedbackCategory(),
      text: this.feedbackText(),
      contact: this.feedbackContact() || undefined,
      meta: { locale: this.profileStore.locale(), theme: this.profileStore.theme(), url: location.href },
    }).subscribe(() => {
      this.feedbackOpen.set(false);
      this.feedbackText.set('');
      this.feedbackContact.set('');
    });
  }
}
