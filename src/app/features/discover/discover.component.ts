import { Component, computed, inject, isDevMode, OnInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ProfileStore } from '../../core/stores/profile.store';
import { SavedStore } from '../../core/stores/saved.store';
import { ApiService } from '../../core/services/api.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { apiProviders } from '../../core/providers';
import { RecommendationCard } from '../../core/models';
import { ResultCardComponent } from './result-card/result-card.component';
import { ContextBarComponent } from './context-bar/context-bar.component';
import { FilterSheetComponent, FilterState } from './filter-sheet/filter-sheet.component';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    SkeletonModule,
    TagModule,
    ResultCardComponent,
    ContextBarComponent,
    FilterSheetComponent,
  ],
  providers: [...apiProviders],
  template: `
    <div class="discover">
      <!-- Title -->
      <header class="discover__header">
        <h1 class="discover__title">{{ 'discover.title' | translate }}</h1>
      </header>

      <!-- Context bar: location, company, interests, time — all tappable -->
      <app-context-bar (changed)="onContextChanged()" />

      <!-- Quick presets + filter button -->
      <div class="discover__toolbar">
        <div class="discover__presets">
          @for (p of presets; track p.key) {
            <button class="preset-chip"
              [class.preset-chip--active]="activePreset() === p.key"
              (click)="applyPreset(p.key)">{{ p.label }}</button>
          }
        </div>
        <button class="discover__filter-btn" (click)="openFilters()">
          &#9776;
          @if (activeFilterCount() > 0) {
            <span class="filter-badge">{{ activeFilterCount() }}</span>
          }
        </button>
      </div>

      <!-- Results count -->
      @if (!loading() && cards().length > 0) {
        <div class="discover__count">{{ cards().length }} {{ 'discover.results' | translate }}</div>
      }

      <!-- Loading skeletons -->
      @if (loading()) {
        <div class="discover__skeletons">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="skeleton-card">
              <p-skeleton height="18px" width="60%" />
              <p-skeleton height="14px" width="80%" styleClass="mt-1" />
              <p-skeleton height="14px" width="40%" styleClass="mt-1" />
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
    </div>

    <app-filter-sheet (filtersChanged)="onFiltersChanged($event)" />
  `,
  styles: `
    .discover {
      padding-bottom: 80px;
    }

    .discover__header {
      padding: var(--ld-space-lg) var(--ld-space-lg) var(--ld-space-sm);
    }

    .discover__title {
      font-size: 22px;
      font-weight: 600;
      line-height: 28px;
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

  private filterSheet = viewChild(FilterSheetComponent);
  private contextBar = viewChild(ContextBarComponent);

  readonly isDev = isDevMode();
  readonly debugCoords = signal('');

  readonly allCards = signal<RecommendationCard[]>([]);
  readonly visibleCount = signal(15);
  readonly cards = computed(() => this.allCards().slice(0, this.visibleCount()));
  readonly hasMoreCards = computed(() => this.visibleCount() < this.allCards().length);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly activePreset = signal<string | null>(null);
  private currentFilters = signal<FilterState | null>(null);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  presets = [
    { key: 'chill', label: '😌 Спокойный вечер' },
    { key: 'active', label: '🏃 Активный день' },
    { key: 'family', label: '👨‍👩‍👧 С детьми' },
    { key: 'culture', label: '🎭 Культура' },
    { key: 'food', label: '🍽️ Поесть' },
    { key: 'nightlife', label: '🌙 Ночная жизнь' },
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
    this.router.navigate(['/detail', card.type, card.id]);
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
