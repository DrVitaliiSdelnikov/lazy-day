import { computed, Injectable, signal } from '@angular/core';
import { CompanyType, Locale } from '../models';

export type ThemeMode = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'ld_profile';

function generateDeviceId(): string {
  return crypto.randomUUID();
}

function loadFromStorage(): Partial<ProfileState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export type LocalLevel = 'tourist' | 'visitor' | 'local';

interface ProfileState {
  deviceId: string;
  interests: Record<string, number>;
  company: CompanyType | null;
  hasPet: boolean;
  budgetMax: number | null;
  locale: Locale;
  theme: ThemeMode;
  city: string;
  localLevel: LocalLevel;
  onboardingCompleted: boolean;
  hiddenIds: string[];
  savedIds: string[];
}

const defaults: ProfileState = {
  deviceId: generateDeviceId(),
  interests: {},
  company: null,
  hasPet: false,
  budgetMax: null,
  locale: 'ru',
  theme: 'auto',
  city: 'tbilisi',
  localLevel: 'local' as LocalLevel,
  onboardingCompleted: false,
  hiddenIds: [],
  savedIds: [],
};

@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private state = signal<ProfileState>({ ...defaults, ...loadFromStorage() });

  // Selectors
  readonly deviceId = computed(() => this.state().deviceId);
  readonly interests = computed(() => this.state().interests);
  readonly company = computed(() => this.state().company);
  readonly hasPet = computed(() => this.state().hasPet);
  readonly budgetMax = computed(() => this.state().budgetMax);
  readonly locale = computed(() => this.state().locale);
  readonly theme = computed(() => this.state().theme);
  readonly city = computed(() => this.state().city);
  readonly onboardingCompleted = computed(() => this.state().onboardingCompleted);
  readonly hiddenIds = computed(() => this.state().hiddenIds);
  readonly savedIds = computed(() => this.state().savedIds);
  readonly localLevel = computed(() => this.state().localLevel);
  readonly hasInterests = computed(() => Object.keys(this.state().interests).length > 0);

  setLocalLevel(level: LocalLevel) {
    this.patch({ localLevel: level });
  }

  setInterests(interests: Record<string, number>) {
    this.patch({ interests });
  }

  toggleInterest(tag: string) {
    const current = { ...this.state().interests };
    if (current[tag]) {
      delete current[tag];
    } else {
      current[tag] = 1.0;
    }
    this.patch({ interests: current });
  }

  updateInterestWeight(tag: string, delta: number) {
    const current = { ...this.state().interests };
    const oldWeight = current[tag] ?? 0.5;
    current[tag] = Math.max(0, Math.min(1, 0.8 * oldWeight + delta));
    this.patch({ interests: current });
  }

  setCompany(company: CompanyType | null) {
    this.patch({ company });
  }

  setHasPet(hasPet: boolean) {
    this.patch({ hasPet });
  }

  setBudgetMax(budgetMax: number | null) {
    this.patch({ budgetMax });
  }

  setLocale(locale: Locale) {
    this.patch({ locale });
  }

  setTheme(theme: ThemeMode) {
    this.patch({ theme });
  }

  completeOnboarding() {
    this.patch({ onboardingCompleted: true });
  }

  addHidden(id: string) {
    const hiddenIds = [...this.state().hiddenIds, id];
    this.patch({ hiddenIds });
  }

  removeHidden(id: string) {
    const hiddenIds = this.state().hiddenIds.filter((h) => h !== id);
    this.patch({ hiddenIds });
  }

  toggleSaved(id: string) {
    const savedIds = this.state().savedIds.includes(id)
      ? this.state().savedIds.filter((s) => s !== id)
      : [...this.state().savedIds, id];
    this.patch({ savedIds });
  }

  isSaved(id: string): boolean {
    return this.state().savedIds.includes(id);
  }

  resetProfile() {
    const fresh = { ...defaults, deviceId: this.state().deviceId };
    this.state.set(fresh);
    this.persist();
  }

  /** Get current state as plain object (for sync to server) */
  snapshot(): ProfileState {
    return { ...this.state() };
  }

  /** Merge profile from server (on ITP restore) */
  mergeFromServer(serverProfile: Record<string, unknown>) {
    const current = this.state();
    this.state.set({
      ...current,
      interests: serverProfile['interests'] as Record<string, number> ?? current.interests,
      company: serverProfile['company'] as any ?? current.company,
      hasPet: serverProfile['hasPet'] as boolean ?? current.hasPet,
      locale: serverProfile['locale'] as any ?? current.locale,
      theme: serverProfile['theme'] as any ?? current.theme,
      localLevel: serverProfile['localLevel'] as any ?? current.localLevel,
      budgetMax: serverProfile['budgetMax'] as number ?? current.budgetMax,
    });
    this.persist();
  }

  /** Set saved IDs (for restore from server) */
  setSavedIds(ids: string[]) {
    this.patch({ savedIds: ids });
  }

  /** Set hidden IDs (for restore from server) */
  setHiddenIds(ids: string[]) {
    this.patch({ hiddenIds: ids });
  }

  private patch(partial: Partial<ProfileState>) {
    this.state.update((s) => ({ ...s, ...partial }));
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
    } catch {
      // Storage full — silent fail
    }
  }
}
