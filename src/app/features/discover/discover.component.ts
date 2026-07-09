import { Component, computed, inject, isDevMode, OnInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ProfileStore } from '../../core/stores/profile.store';
import { ThemeService } from '../../core/services/theme.service';
import { SavedStore } from '../../core/stores/saved.store';
import { ApiService } from '../../core/services/api.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { apiProviders } from '../../core/providers';
import { RecommendationCard } from '../../core/models';
import { ResultCardComponent } from './result-card/result-card.component';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { DetailComponent } from '../detail/detail.component';
import { ContextBarComponent } from './context-bar/context-bar.component';
import { FilterSheetComponent, FilterState } from './filter-sheet/filter-sheet.component';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [
    TranslatePipe,
    ResultCardComponent,
    ContextBarComponent,
    FilterSheetComponent,
    LdIconComponent,
    DetailComponent,
  ],
  providers: [...apiProviders],
  template: `
    <div class="discover">
      <!-- Desktop sidebar (≥1024) -->
      <aside class="discover__sidebar">
        <div class="sidebar__section">
          <p class="sidebar__label">Локация</p>
          <div class="sidebar__location">
            <ld-icon name="map-pin" [size]="14" />
            <span>{{ geo.position().lat.toFixed(3) }}, {{ geo.position().lng.toFixed(3) }}</span>
          </div>
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">Радиус · {{ sidebarRadius() }} км</p>
          <input type="range" class="ld-slider"
            [value]="sidebarRadius()" (input)="onSidebarRadiusChange($event)" min="1" max="15" step="1" />
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">Секции</p>
          <div class="sidebar__segments">
            @for (tf of typeFilters; track tf.value) {
              <button class="sidebar__seg"
                [class.sidebar__seg--active]="activeTypeFilter() === tf.value"
                (click)="setTypeFilter(tf.value)">
                {{ tf.label }}
                <span class="sidebar__seg-count">{{ countByType(tf.value) }}</span>
              </button>
            }
          </div>
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">Категории</p>
          <div class="sidebar__chips">
            @for (p of presets; track p.key) {
              <button class="ld-chip"
                [class.ld-chip--active]="activePreset() === p.key"
                (click)="applyPreset(p.key)">{{ p.label }}</button>
            }
          </div>
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">Компания</p>
          <div class="sidebar__company">
            @for (opt of companyOptions; track opt.value) {
              <button class="sidebar__company-btn"
                [class.sidebar__company-btn--active]="profileStore.company() === opt.value"
                (click)="setCompany(opt.value)"
                [attr.aria-label]="opt.label">
                <ld-icon [name]="opt.icon" [size]="16" />
              </button>
            }
          </div>
        </div>
        <div class="sidebar__section">
          <div class="sidebar__pet-row">
            <span style="font-size: 12px; display: flex; align-items: center; gap: 5px">
              <ld-icon name="dog" [size]="16" /> С питомцем
            </span>
            <button class="ld-toggle" [class.ld-toggle--on]="profileStore.hasPet()" aria-label="Pet toggle"
              (click)="togglePet()"></button>
          </div>
        </div>
        <button class="ld-btn ld-btn--ghost" style="color: var(--ld-primary); font-size: 12px; margin-top: 8px"
          (click)="resetSidebar()">Сбросить всё</button>
      </aside>

      <!-- Main content area -->
      <div class="discover__main">
      <!-- Greeting -->
      <header class="discover__header">
        <p class="discover__context">{{ contextLine() }}</p>
        <h1 class="discover__greeting ld-display">{{ greeting() }}</h1>
      </header>

      <!-- Context bar: mobile only -->
      <app-context-bar class="discover__context-bar" (changed)="onContextChanged()" />

      <!-- Quick presets + filter button -->
      <div class="discover__toolbar">
        <div class="discover__presets">
          @for (p of presets; track p.key) {
            <button class="ld-chip"
              [class.ld-chip--active]="activePreset() === p.key"
              (click)="applyPreset(p.key)">
              <ld-icon [name]="p.icon" [size]="14" />
              {{ p.label }}
            </button>
          }
        </div>
        <button class="discover__filter-btn" (click)="openFilters()" aria-label="Filters">
          &#9776;
          @if (activeFilterCount() > 0) {
            <span class="filter-badge">{{ activeFilterCount() }}</span>
          }
        </button>
      </div>

      <!-- Type filter: places / events / all -->
      <div class="discover__type-filter">
        @for (tf of typeFilters; track tf.value) {
          <button class="ld-chip"
            [class.ld-chip--active]="activeTypeFilter() === tf.value"
            (click)="setTypeFilter(tf.value)">
            @if (tf.icon) { <ld-icon [name]="tf.icon" [size]="13" /> }
            {{ tf.label }}
          </button>
        }
      </div>

      <!-- Results count -->
      @if (!loading() && cards().length > 0) {
        <div class="discover__count">{{ cards().length }} {{ 'discover.results' | translate }}</div>
      }

      <!-- Loading skeletons -->
      @if (loading()) {
        <div class="discover__skeletons">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="skeleton-card ld-card">
              <div class="ld-skeleton" style="height:18px;width:60%;margin-bottom:8px"></div>
              <div class="ld-skeleton" style="height:14px;width:80%;margin-bottom:6px"></div>
              <div class="ld-skeleton" style="height:14px;width:40%"></div>
            </div>
          }
        </div>
      }

      <!-- Card list -->
      @if (cards().length > 0) {
        <section class="discover__results">
          @for (card of cards(); track card.id) {
            <app-result-card
              [card]="card"
              [isSaved]="savedStore.isSaved(card.id)"
              (openDetail)="onOpenDetail(card)"
              (toggleSave)="onToggleSave(card)"
              (hideCard)="onHideCard(card)"
            />
          }
        </section>
      }

      <!-- Show more -->
      @if (hasMoreCards()) {
        <div class="discover__more">
          <button class="discover__more-btn" (click)="showMore()">
            {{ 'discover.show_more' | translate }} ({{ allCards().length - visibleCount() }})
          </button>
        </div>
      }

      <!-- Empty state -->
      @if (!loading() && loaded() && cards().length === 0) {
        <div class="discover__empty">
          <p>{{ 'discover.empty' | translate }}</p>
        </div>
      }

      </div><!-- /discover__main -->
    </div><!-- /discover -->

    <app-filter-sheet (filtersChanged)="onFiltersChanged($event)" />

    <!-- Desktop detail modal -->
    @if (modalCard()) {
      <div class="discover__modal-backdrop" (click)="closeModal()"></div>
      <div class="discover__modal">
        <app-detail [type]="modalCard()!.type" [id]="modalCard()!.id" />
        <button class="discover__modal-close" (click)="closeModal()" aria-label="Close">
          <ld-icon name="x" [size]="16" />
        </button>
      </div>
    }
  `,
  styles: `
    /* ─── Desktop layout ─── */
    @media (min-width: 1024px) {
      .discover {
        display: flex;
        min-height: 100%;
      }
      .discover__context-bar { display: none; }
      .discover__toolbar .discover__filter-btn { display: none; }
    }

    .discover__sidebar {
      display: none;
    }

    @media (min-width: 1024px) {
      .discover__sidebar {
        display: block;
        width: 260px;
        flex-shrink: 0;
        border-right: 1px solid var(--ld-border);
        padding: 16px;
        background: var(--ld-surface);
        position: sticky;
        top: 0;
        height: calc(100vh - 52px);
        overflow-y: auto;
      }
      .discover__main { flex: 1; min-width: 0; }
    }

    .sidebar__section {
      margin-bottom: 20px;
    }

    .sidebar__label {
      font-size: 11px;
      font-weight: 500;
      color: var(--ld-text-3);
      letter-spacing: 0.4px;
      margin: 0 0 6px;
    }

    .sidebar__location {
      display: flex;
      align-items: center;
      gap: 5px;
      background: var(--ld-bg);
      border: 1px solid var(--ld-border);
      border-radius: 10px;
      padding: 6px 8px;
      font-size: 12px;
      color: var(--ld-text);
    }

    .sidebar__segments {
      background: var(--ld-bg);
      border-radius: 10px;
      padding: 3px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sidebar__seg {
      display: flex;
      justify-content: space-between;
      padding: 5px 8px;
      font-size: 12px;
      color: var(--ld-text-2);
      background: none;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
    }

    .sidebar__seg--active {
      background: var(--ld-surface);
      color: var(--ld-on-primary-soft);
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .sidebar__seg-count {
      color: var(--ld-text-3);
      font-weight: 400;
    }

    .sidebar__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .sidebar__company {
      display: flex;
      gap: 4px;
    }

    .sidebar__company-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid var(--ld-border);
      background: var(--ld-surface);
      color: var(--ld-text-3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 150ms, color 150ms;
    }

    .sidebar__company-btn--active {
      background: var(--ld-primary-soft);
      color: var(--ld-on-primary-soft);
      border-color: transparent;
    }

    .sidebar__pet-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .discover {
      padding-bottom: 80px;
    }

    .discover__header {
      padding: 10px var(--ld-space-lg) 4px;
    }

    .discover__context {
      font-size: 11px;
      color: var(--ld-text-2);
      margin: 0;
    }

    .discover__greeting {
      font-size: 20px;
      line-height: 1.3;
      margin: 2px 0 0;
      color: var(--ld-text);
    }

    .theme-evening .discover__greeting {
      color: var(--ld-primary);
    }

    .discover__toolbar {
      display: flex;
      align-items: center;
      gap: var(--ld-space-sm);
      padding: var(--ld-space-sm) var(--ld-space-lg);
      margin-bottom: var(--ld-space-sm);
    }

    .discover__presets {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      flex: 1;

      &::-webkit-scrollbar { display: none; }
    }

    .preset-chip {
      padding: 6px 14px;
      border-radius: 16px;
      border: 1px solid var(--ld-divider);
      background: var(--ld-card-bg);
      color: var(--ld-text-secondary);
      font-size: 13px;
      white-space: nowrap;
      cursor: pointer;
      min-height: 32px;
      transition: all 120ms;

      &--active {
        border-color: var(--ld-accent);
        background: var(--ld-accent);
        color: #fff;
      }
    }

    .discover__filter-btn {
      background: none;
      border: 1px solid var(--ld-divider);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 16px;
      color: var(--ld-text-secondary);
      cursor: pointer;
      min-width: 40px;
      min-height: 36px;
      position: relative;
      flex-shrink: 0;
    }

    .filter-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--ld-accent);
      color: #fff;
      font-size: 10px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .discover__count {
      padding: 0 var(--ld-space-lg);
      margin-bottom: var(--ld-space-sm);
      font-size: 13px;
      color: var(--ld-text-secondary);
    }

    .discover__type-filter {
      display: flex;
      gap: 3px;
      padding: var(--ld-space-sm) var(--ld-space-lg);
      background: var(--ld-surface-2);
      border-radius: 12px;
      margin: 0 var(--ld-space-lg) var(--ld-space-sm);

      @media (min-width: 1024px) { display: none; }
    }

    .type-chip {
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--ld-divider);
      background: none;
      font-size: 13px;
      color: var(--ld-text-secondary);
      cursor: pointer;
      min-height: 36px;
    }

    .type-chip--active {
      background: var(--ld-text);
      color: var(--ld-card-bg, white);
      border-color: var(--ld-text);
    }

    /* ─── Desktop detail modal ─── */
    .discover__modal-backdrop {
      display: none;
    }

    .discover__modal {
      display: none;
    }

    @media (min-width: 1024px) {
      .discover__modal-backdrop {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(45, 38, 26, 0.4);
        z-index: 500;
      }

      .theme-evening .discover__modal-backdrop {
        background: rgba(35, 26, 42, 0.45);
      }

      .discover__modal {
        display: block;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        max-width: 90vw;
        max-height: 85vh;
        overflow-y: auto;
        background: var(--ld-bg);
        border-radius: var(--ld-radius-card);
        z-index: 501;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
      }

      .discover__modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 28px;
        height: 28px;
        background: var(--ld-surface);
        border: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--ld-text);
        z-index: 502;
      }
    }

    .discover__more {
      display: flex;
      justify-content: center;
      padding: var(--ld-space-md) var(--ld-space-lg) var(--ld-space-xl);
    }

    .discover__more-btn {
      background: none;
      border: 1px solid var(--ld-divider);
      border-radius: var(--ld-radius-md, 12px);
      padding: 10px 24px;
      font-size: 14px;
      color: var(--ld-text-secondary);
      cursor: pointer;
      min-height: 44px;

      &:hover {
        background: rgba(0,0,0,0.03);
      }
    }

    .discover__results {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
    }

    @media (min-width: 640px) {
      .discover__results {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--ld-space-sm);
        padding: 0 var(--ld-space-md);
      }
    }

    @media (min-width: 1024px) {
      .discover__results {
        grid-template-columns: repeat(3, 1fr);
        gap: var(--ld-space-md);
        padding: 0 var(--ld-space-lg);
      }
    }

    .discover__skeletons {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--ld-space-md);
      padding: 0 var(--ld-space-lg);
    }

    @media (min-width: 640px) {
      .discover__skeletons {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1024px) {
      .discover__skeletons {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .skeleton-card {
      padding: var(--ld-space-md) 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .discover__empty {
      text-align: center;
      padding: var(--ld-space-xl);
      color: var(--ld-text-secondary);
    }
  `,
})
export class DiscoverComponent implements OnInit {
  readonly profileStore = inject(ProfileStore);
  readonly savedStore = inject(SavedStore);
  private api = inject(ApiService);
  readonly geo = inject(GeolocationService);
  private router = inject(Router);
  private theme = inject(ThemeService);

  sidebarRadius = signal(5);

  companyOptions = [
    { value: 'solo', label: 'Один', icon: 'user' },
    { value: 'couple', label: 'Пара', icon: 'hearts' },
    { value: 'friends', label: 'Друзья', icon: 'users' },
    { value: 'family', label: 'Семья', icon: 'balloon' },
  ];

  setCompany(value: string) {
    const current = this.profileStore.company();
    this.profileStore.setCompany(current === value ? null : value as any);
    this.onContextChanged();
  }

  togglePet() {
    this.profileStore.setHasPet(!this.profileStore.hasPet());
    this.onContextChanged();
  }

  onSidebarRadiusChange(event: any) {
    this.sidebarRadius.set(Number(event.target.value));
    this.onContextChanged();
  }

  countByType(type: string): number {
    if (type === 'all') return this.allCards().length;
    return this.allCards().filter(c => c.type === type).length;
  }

  resetSidebar() {
    this.activePreset.set(null);
    this.activeTypeFilter.set('all');
    this.sidebarRadius.set(5);
    this.loadFeed();
  }

  greeting(): string {
    const hour = (new Date().getUTCHours() + 4) % 24; // Tbilisi
    if (hour >= 6 && hour < 12) return 'Доброе утро. Куда лениво сходить?';
    if (hour >= 12 && hour < 18) return 'Лениво? Сейчас найдём.';
    if (hour >= 18 && hour < 23) return 'Куда выйдем вечером?';
    return 'Не спится? Есть варианты.';
  }

  contextLine(): string {
    const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const now = new Date();
    return `${days[now.getDay()]} · Тбилиси`;
  }

  private filterSheet = viewChild(FilterSheetComponent);
  private contextBar = viewChild(ContextBarComponent);

  readonly isDev = isDevMode();
  readonly modalCard = signal<RecommendationCard | null>(null);
  readonly debugCoords = signal('');

  readonly allCards = signal<RecommendationCard[]>([]);
  readonly activeTypeFilter = signal<'all' | 'place' | 'event'>('all');
  readonly visibleCount = signal(15);
  readonly cards = computed(() => {
    const type = this.activeTypeFilter();
    const filtered = type === 'all'
      ? this.allCards()
      : this.allCards().filter((c) => c.type === type);
    return filtered.slice(0, this.visibleCount());
  });
  readonly hasMoreCards = computed(() => {
    const type = this.activeTypeFilter();
    const total = type === 'all'
      ? this.allCards().length
      : this.allCards().filter((c) => c.type === type).length;
    return this.visibleCount() < total;
  });
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly activePreset = signal<string | null>(null);
  private currentFilters = signal<FilterState | null>(null);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  presets = [
    { key: 'chill', label: 'Прогулка', icon: 'trees' },
    { key: 'food', label: 'Поесть', icon: 'tools-kitchen-2' },
    { key: 'culture', label: 'Культура', icon: 'masks-theater' },
    { key: 'active', label: 'Активно', icon: 'run' },
    { key: 'family', label: 'С детьми', icon: 'balloon' },
    { key: 'nightlife', label: 'Ночная жизнь', icon: 'moon' },
  ];

  typeFilters = [
    { value: 'all' as const, label: 'Всё', icon: '' },
    { value: 'place' as const, label: 'Места', icon: 'map-pin' },
    { value: 'event' as const, label: 'События', icon: 'ticket' },
  ];

  private readonly MOOD_PRESETS: Record<string, { interests: Record<string, number>; company?: string; radiusM?: number }> = {
    chill: { interests: { nature: 0.8, food: 0.5, spa: 0.5 }, radiusM: 5000 },
    active: { interests: { active: 1, sports: 0.5 }, radiusM: 10000 },
    family: { interests: { family: 1, nature: 0.5, entertainment: 0.5 }, company: 'family', radiusM: 8000 },
    culture: { interests: { culture: 1, food: 0.3 }, radiusM: 10000 },
    food: { interests: { food: 1 }, radiusM: 5000 },
    nightlife: { interests: { nightlife: 1, entertainment: 0.5 }, radiusM: 10000 },
  };

  readonly activeFilterCount = computed(() => {
    const f = this.currentFilters();
    if (!f) return 0;
    let count = 0;
    if (f.openNow) count++;
    if (f.freeOnly) count++;
    if (f.walkMax20) count++;
    if (f.outdoor) count++;
    if (f.forTwo) count++;
    if (f.budgetMax) count++;
    return count;
  });

  ngOnInit() {
    if (!this.profileStore.onboardingCompleted()) {
      this.router.navigate(['/discover/onboarding']);
      return;
    }
    // Auto-load feed on entry
    this.loadFeed();
  }

  applyPreset(key: string) {
    this.activePreset.set(this.activePreset() === key ? null : key);
    this.loadFeed();
  }

  openFilters() {
    this.filterSheet()?.open();
  }

  onFiltersChanged(filters: FilterState) {
    this.currentFilters.set(filters);
    this.loadFeed();
  }

  setTypeFilter(type: 'all' | 'place' | 'event') {
    this.activeTypeFilter.set(type);
    this.visibleCount.set(15);
  }

  showMore() {
    this.visibleCount.update((n) => n + 15);
  }

  onDebugCoordsSet(value: string) {
    const parts = value.trim().split(/[,\s]+/).map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      this.geo.setFallback(parts[0], parts[1]);
      this.debugCoords.set(value.trim());
      this.loadFeed();
    }
  }

  onContextChanged() {
    // Debounce: user might tap multiple chips quickly
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.loadFeed(), 300);
  }

  loadFeed() {
    this.loading.set(true);

    const ctx = this.contextBar();
    const pos = this.geo.position();
    const radiusM = ctx ? ctx.getRadiusM() : 5000;
    const timeWindow = ctx ? ctx.getTimeWindow() : this.defaultTimeWindow();
    const preset = this.activePreset();
    const f = this.currentFilters();

    let finalRadius = f?.walkMax20 ? 1600 : radiusM;

    // Mood preset overrides interests, company, radius
    const mood = preset ? this.MOOD_PRESETS[preset] : null;
    const interests = mood?.interests ?? this.profileStore.interests();
    const company = (mood?.company ?? this.profileStore.company() ?? undefined) as any;
    if (mood?.radiusM) finalRadius = mood.radiusM;

    this.api
      .discover({
        lat: pos.lat,
        lng: pos.lng,
        radiusM: finalRadius,
        timeWindow,
        profile: {
          interests,
          company,
          hasPet: this.profileStore.hasPet() || undefined,
          budgetMax: f?.budgetMax ?? this.profileStore.budgetMax() ?? undefined,
        },
        hiddenIds: this.profileStore.hiddenIds(),
        locale: this.profileStore.locale(),
      })
      .subscribe({
        next: (res) => {
          let filtered = res.cards;

          // Client-side quick filters
          if (f?.freeOnly || preset === 'free') {
            filtered = filtered.filter((c) =>
              c.priceLabel?.toLowerCase().includes('бесплатно') ||
              c.priceLabel?.includes('0 GEL')
            );
          }
          if (f?.openNow) {
            filtered = filtered.filter((c) =>
              c.openStatus?.toLowerCase().includes('открыто') || c.type === 'event'
            );
          }

          this.allCards.set(filtered);
          this.visibleCount.set(15);
          this.loading.set(false);
          this.loaded.set(true);
        },
        error: () => {
          this.loading.set(false);
          this.loaded.set(true);
        },
      });
  }

  onOpenDetail(card: RecommendationCard) {
    if (window.innerWidth >= 1024) {
      // Desktop: open modal overlay
      this.modalCard.set(card);
      history.pushState(null, '', `/detail/${card.type}/${card.id}`);
    } else {
      // Mobile: navigate to full page
      this.router.navigate(['/detail', card.type, card.id]);
    }
  }

  closeModal() {
    this.modalCard.set(null);
    history.pushState(null, '', '/discover');
  }

  onToggleSave(card: RecommendationCard) {
    this.savedStore.toggle(card);
  }

  onHideCard(card: RecommendationCard) {
    this.profileStore.addHidden(card.id);
    this.allCards.update((cards) => cards.filter((c) => c.id !== card.id));
  }

  private defaultTimeWindow() {
    const now = new Date();
    return { from: now.toISOString(), to: new Date(now.getTime() + 6 * 3600000).toISOString() };
  }
}
