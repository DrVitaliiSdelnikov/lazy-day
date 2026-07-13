import { Component, computed, effect, inject, isDevMode, OnInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProfileStore } from '../../core/stores/profile.store';
import { ThemeService } from '../../core/services/theme.service';
import { SavedStore } from '../../core/stores/saved.store';
import { ApiService } from '../../core/services/api.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { apiProviders } from '../../core/providers';
import { RecommendationCard, DiscoverMeta } from '../../core/models';
import { ResultCardComponent } from './result-card/result-card.component';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { DetailComponent } from '../detail/detail.component';
import { ContextBarComponent } from './context-bar/context-bar.component';
import { FilterSheetComponent, FilterState } from './filter-sheet/filter-sheet.component';
import { FeedLoaderComponent } from './feed-loader/feed-loader.component';
import { FeedTuneBlockComponent } from './feed-tune-block/feed-tune-block.component';
import { InteractionService } from '../../core/services/interaction.service';
import { DecideForMeComponent } from './decide-for-me/decide-for-me.component';

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
    FeedLoaderComponent,
    FeedTuneBlockComponent,
    DecideForMeComponent,
  ],
  providers: [...apiProviders],
  template: `
    <div class="discover">
      <!-- Desktop sidebar (≥1024) -->
      <aside class="discover__sidebar">
        <div class="sidebar__section">
          <p class="sidebar__label">{{ 'sidebar.location' | translate }}</p>
          <div class="sidebar__location" [class.sidebar__location--default]="geo.position().source === 'default'">
            <ld-icon name="map-pin" [size]="14" />
            <span>{{ geo.position().label || (geo.position().source === 'gps' ? ('sidebar.my_location' | translate) : ('sidebar.tbilisi_center' | translate)) }}</span>
            @if (geo.position().source === 'default') {
              <button class="ld-btn ld-btn--ghost" style="font-size:11px; color:var(--ld-primary); margin-left:auto"
                (click)="requestGps()">{{ 'sidebar.detect' | translate }}</button>
            }
          </div>
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">{{ 'sidebar.radius' | translate }} · {{ sidebarRadius() }} км</p>
          <input type="range" class="ld-slider"
            [value]="sidebarRadius()" (input)="onSidebarRadiusChange($event)" min="1" max="15" step="1" />
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">{{ 'sidebar.sections' | translate }}</p>
          <div class="sidebar__segments">
            @for (tf of typeFilters; track tf.value) {
              <button class="sidebar__seg"
                [class.sidebar__seg--active]="activeTypeFilter() === tf.value"
                (click)="setTypeFilter(tf.value)">
                {{ tf.labelKey | translate }}
                <span class="sidebar__seg-count">{{ countByType(tf.value) }}</span>
              </button>
            }
          </div>
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">{{ 'sidebar.company' | translate }}</p>
          <div class="sidebar__company">
            @for (opt of companyOptions; track opt.value) {
              <button class="sidebar__company-btn"
                [class.sidebar__company-btn--active]="profileStore.company() === opt.value"
                (click)="setCompany(opt.value)"
                [attr.aria-label]="opt.labelKey | translate">
                <ld-icon [name]="opt.icon" [size]="16" />
              </button>
            }
          </div>
        </div>
        <div class="sidebar__section">
          <div class="sidebar__pet-row">
            <span style="font-size: 12px; display: flex; align-items: center; gap: 5px">
              <ld-icon name="dog" [size]="16" /> {{ 'sidebar.with_pet' | translate }}
            </span>
            <button class="ld-toggle" [class.ld-toggle--on]="profileStore.hasPet()" aria-label="Pet toggle"
              (click)="togglePet()"></button>
          </div>
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">{{ 'sidebar.time' | translate }}</p>
          <div class="sidebar__segments">
            @for (t of timeOptions; track t.value) {
              <button class="sidebar__seg"
                [class.sidebar__seg--active]="sidebarTime() === t.value"
                (click)="setSidebarTime(t.value)">
                {{ t.labelKey | translate }}
              </button>
            }
          </div>
        </div>
        <button class="ld-btn ld-btn--ghost" style="color: var(--ld-primary); font-size: 12px; margin-top: 8px"
          (click)="resetSidebar()">{{ 'sidebar.reset_all' | translate }}</button>
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
              {{ p.labelKey | translate }}
              @if (activePreset() === p.key) {
                <ld-icon name="x" [size]="12" class="ld-chip__clear" />
              }
            </button>
          }
        </div>
        @if (hasActiveFilters()) {
          <button class="discover__clear-btn" (click)="clearAllFilters()">
            <ld-icon name="x" [size]="12" />
          </button>
        }
        <button class="discover__decide-btn" (click)="openDecide()"
          [disabled]="loading() || cards().length === 0">
          <ld-icon name="compass" [size]="15" />
        </button>
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
            {{ tf.labelKey | translate }}
          </button>
        }
      </div>

      <!-- Fallback banner: tomorrow mode -->
      @if (!loading() && feedMeta()?.fallback === 'tomorrow') {
        <div class="discover__fallback-banner">
          <span>{{ 'fallback.tomorrow_banner' | translate }}</span>
          <button class="ld-btn ld-btn--ghost discover__fallback-action" (click)="forceNow()">{{ 'fallback.force_now' | translate }}</button>
        </div>
      }

      <!-- Results count -->
      @if (!loading() && cards().length > 0) {
        <div class="discover__count">{{ cards().length }} {{ pluralizeResults(cards().length) }}</div>
      }

      <!-- Loading: feed loader animation -->
      @if (loading()) {
        <app-feed-loader />
      }

      <!-- Card list -->
      @if (!loading() && cards().length > 0) {
        <section class="discover__results">
          @for (card of cards(); track card.id; let i = $index) {
            @if (i === 5 && showTuneBlock()) {
              <app-feed-tune-block
                (applied)="onTuneApplied($event)"
                (dismissed)="onTuneDismissed()" />
            }
            <app-result-card
              [card]="card"
              [isSaved]="savedStore.isSaved(card.id)"
              (openDetail)="onOpenDetail(card)"
              (toggleSave)="onToggleSave(card)"
              (hideCard)="onHideCard(card)"
            />
          }
          @if (cards().length < 6 && showTuneBlock()) {
            <app-feed-tune-block
              (applied)="onTuneApplied($event)"
              (dismissed)="onTuneDismissed()" />
          }
        </section>
      }

      <!-- Show more -->
      @if (!loading() && hasMoreCards()) {
        <div class="discover__more">
          <button class="discover__more-btn" (click)="showMore()">
            {{ 'discover.show_more' | translate }} ({{ allCards().length - visibleCount() }})
          </button>
        </div>
      }

      <!-- Empty state: night -->
      @if (!loading() && loaded() && cards().length === 0 && forcedNow()) {
        <div class="discover__empty discover__empty--night">
          <ld-icon name="zzz" [size]="40" />
          <p>{{ 'fallback.city_sleeps' | translate }}</p>
          <button class="ld-btn ld-btn--primary" (click)="showTomorrow()">{{ 'fallback.show_tomorrow' | translate }}</button>
        </div>
      }

      <!-- Empty state: generic -->
      @if (!loading() && loaded() && cards().length === 0 && !forcedNow()) {
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
        <app-detail [type]="modalCard()!.type" [id]="modalCard()!.id" [isModal]="true" [preloadedCard]="modalCard()!" />
        <button class="discover__modal-close" (click)="closeModal()" aria-label="Close">
          <ld-icon name="x" [size]="14" />
        </button>
      </div>
    }

    <!-- Undo hide toast -->
    @if (undoableHide()) {
      <div class="discover__undo-toast">
        <span>{{ 'hide.hidden' | translate }}</span>
        <button class="discover__undo-btn" (click)="undoHide()">{{ 'hide.undo' | translate }}</button>
      </div>
    }

    <!-- Decide for me overlay -->
    @if (decideOpen() && decideCards().length > 0) {
      <app-decide-for-me [cards]="decideCards()" (close)="decideOpen.set(false)" />
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
        align-self: flex-start;
        position: sticky;
        top: 0;
        max-height: calc(100vh - 52px);
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

    @media (min-width: 1024px) {
      .discover { padding-bottom: 0; }
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
      border: 1px solid var(--ld-border);
      background: var(--ld-surface);
      color: var(--ld-text-2);
      font-size: 13px;
      white-space: nowrap;
      cursor: pointer;
      min-height: 32px;
      transition: all 120ms;

      &--active {
        border-color: var(--ld-primary);
        background: var(--ld-primary);
        color: #fff;
      }
    }

    .discover__filter-btn {
      background: none;
      border: 1px solid var(--ld-border);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 16px;
      color: var(--ld-text-2);
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
      background: var(--ld-primary);
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
      color: var(--ld-text-2);
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
      border: 1px solid var(--ld-border);
      background: none;
      font-size: 13px;
      color: var(--ld-text-2);
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
        padding: 0;
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
      border: 1px solid var(--ld-border);
      border-radius: var(--ld-radius-md, 12px);
      padding: 10px 24px;
      font-size: 14px;
      color: var(--ld-text-2);
      cursor: pointer;
      min-height: 44px;

      &:hover {
        background: rgba(0,0,0,0.03);
      }
    }

    .discover__results {
      display: grid;
      grid-template-columns: 1fr;
      gap: 15px;
      overflow: hidden;
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

    .discover__clear-btn {
      width: 32px;
      min-height: 32px;
      background: var(--ld-surface);
      border: 1px solid var(--ld-border);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--ld-text-3);
      padding: 0;
      flex-shrink: 0;
    }

    .discover__decide-btn {
      width: 40px;
      min-height: 36px;
      background: var(--ld-primary);
      color: var(--ld-bg);
      border: none;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      padding: 0;
      transition: opacity 150ms;

      &:disabled { opacity: 0.4; cursor: default; }
    }

    .discover__fallback-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0 var(--ld-space-lg) var(--ld-space-sm);
      padding: 12px 16px;
      background: var(--ld-surface-2);
      border-radius: 14px;
      font-size: 12px;
      color: var(--ld-text);
    }

    .discover__fallback-action {
      font-size: 12px;
      white-space: nowrap;
      color: var(--ld-primary);
    }

    .discover__undo-toast {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--ld-text);
      color: var(--ld-bg);
      padding: 12px 20px;
      border-radius: 14px;
      font-size: 13px;
      z-index: 600;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      animation: undo-in 200ms ease-out;
    }

    @media (min-width: 1024px) {
      .discover__undo-toast { bottom: 32px; }
    }

    .discover__undo-btn {
      background: none;
      border: none;
      color: var(--ld-primary);
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
    }

    @keyframes undo-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .discover__empty {
      text-align: center;
      padding: var(--ld-space-xl);
      color: var(--ld-text-2);
    }

    .discover__empty--night {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px var(--ld-space-lg);
      color: var(--ld-text-3);
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
  private translate = inject(TranslateService);
  private interactions = inject(InteractionService);

  sidebarRadius = signal(5);
  sidebarTime = signal('now');

  timeOptions = [
    { value: 'now', labelKey: 'context.now' },
    { value: 'evening', labelKey: 'context.evening' },
    { value: 'tomorrow', labelKey: 'context.tomorrow' },
    { value: 'weekend', labelKey: 'context.weekend' },
  ];

  companyOptions = [
    { value: 'solo', labelKey: 'company.solo', icon: 'user' },
    { value: 'couple', labelKey: 'company.couple', icon: 'hearts' },
    { value: 'friends', labelKey: 'company.friends', icon: 'users' },
    { value: 'family', labelKey: 'company.family', icon: 'balloon' },
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
    this.sidebarTime.set('now');
    this.loadFeed();
  }

  greeting(): string {
    if (this.feedMeta()?.fallback === 'tomorrow') return this.translate.instant('greeting.tomorrow');
    const hour = (new Date().getUTCHours() + 4) % 24; // Tbilisi
    if (hour >= 6 && hour < 12) return this.translate.instant('greeting.morning');
    if (hour >= 12 && hour < 18) return this.translate.instant('greeting.day');
    if (hour >= 18 && hour < 23) return this.translate.instant('greeting.evening');
    return this.translate.instant('greeting.night');
  }

  contextLine(): string {
    const dayKeys = ['day.sunday', 'day.monday', 'day.tuesday', 'day.wednesday', 'day.thursday', 'day.friday', 'day.saturday'];
    const now = new Date();
    const dayName = this.translate.instant(dayKeys[now.getDay()]);
    return `${dayName} · Тбилиси`;
  }

  private filterSheet = viewChild(FilterSheetComponent);
  private contextBar = viewChild(ContextBarComponent);

  readonly isDev = isDevMode();
  readonly modalCard = signal<RecommendationCard | null>(null);
  readonly debugCoords = signal('');

  readonly allCards = signal<RecommendationCard[]>([]);
  readonly activeTypeFilter = signal<'all' | 'place' | 'event'>('all');
  readonly visibleCount = signal(15);
  private navigatedToDetail = false;
  private cachedScrollY = 0;

  // Qualified session tracking (for ads)
  private openedCardIds = new Set<string>();
  private hasQualifiedAction = false;
  private qualifiedFired = false;
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
  readonly feedMeta = signal<DiscoverMeta | undefined>(undefined);
  readonly forcedNow = signal(false);
  readonly activePreset = signal<string | null>(null);
  readonly undoableHide = signal<{ card: RecommendationCard; index: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  readonly decideOpen = signal(false);
  readonly decideCards = computed(() => {
    const all = this.cards();
    const ideal = all.filter(c => !c.isChain && (c.explanations?.length ?? 0) > 0);
    if (ideal.length >= 2) return ideal.slice(0, 4);
    const nonChain = all.filter(c => !c.isChain);
    if (nonChain.length >= 2) return nonChain.slice(0, 4);
    return all.slice(0, 4); // at night, chain is better than nothing
  });
  readonly tuneBlockDismissed = signal(localStorage.getItem('ld_tune_interests') === 'done' || localStorage.getItem('ld_tune_interests') === 'dismissed');
  readonly showTuneBlock = computed(() =>
    !this.profileStore.hasInterests()
    && !this.tuneBlockDismissed()
    && !this.feedMeta()?.fallback
    && this.cards().length >= 1
  );
  private currentFilters = signal<FilterState | null>(null);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  presets = [
    { key: 'chill', labelKey: 'preset.chill', icon: 'trees' },
    { key: 'food', labelKey: 'preset.food', icon: 'tools-kitchen-2' },
    { key: 'culture', labelKey: 'preset.culture', icon: 'masks-theater' },
    { key: 'active', labelKey: 'preset.active', icon: 'run' },
    { key: 'family', labelKey: 'preset.family', icon: 'balloon' },
    { key: 'nightlife', labelKey: 'preset.nightlife', icon: 'moon' },
    { key: 'gym', labelKey: 'preset.gym', icon: 'barbell' },
  ];

  typeFilters = [
    { value: 'all' as const, labelKey: 'type_filter.all', icon: '' },
    { value: 'place' as const, labelKey: 'type_filter.place', icon: 'map-pin' },
    { value: 'event' as const, labelKey: 'type_filter.event', icon: 'ticket' },
  ];

  private readonly MOOD_PRESETS: Record<string, { interests: Record<string, number>; company?: string; radiusM?: number }> = {
    chill: { interests: { nature: 0.8, food: 0.5, spa: 0.5 }, radiusM: 5000 },
    active: { interests: { active: 1, sports: 0.5 }, radiusM: 10000 },
    family: { interests: { family: 1, nature: 0.5, entertainment: 0.5 }, company: 'family', radiusM: 8000 },
    culture: { interests: { culture: 1, food: 0.3 }, radiusM: 10000 },
    food: { interests: { food: 1 }, radiusM: 5000 },
    nightlife: { interests: { nightlife: 1, entertainment: 0.5 }, radiusM: 10000 },
    gym: { interests: { gym: 1, sports: 0.5 }, radiusM: 10000 },
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

  private geoVersion = 0;

  constructor() {
    // Re-fetch feed when GPS position updates (e.g. silent init resolves after first load)
    effect(() => {
      const v = this.geo.updated();
      if (v > 0 && v !== this.geoVersion && this.loaded()) {
        this.geoVersion = v;
        this.loadFeed();
      }
    });
  }

  ngOnInit() {
    if (!this.profileStore.onboardingCompleted()) {
      const welcomeDone = localStorage.getItem('ld_welcome_done');
      this.router.navigate([welcomeDone ? '/discover/onboarding' : '/discover/welcome']);
      return;
    }
    this.geoVersion = this.geo.updated();

    // #41: Restore from cache on back-navigation from detail
    const cache = this.loadFeedCache();
    if (cache && this.navigatedToDetail) {
      this.allCards.set(cache.cards);
      this.loaded.set(true);
      this.navigatedToDetail = false;
      requestAnimationFrame(() => window.scrollTo(0, cache.scrollY));
      return;
    }

    // #42: SWR — show cached feed instantly if context similar
    if (cache && !this.isContextChanged(cache)) {
      this.allCards.set(cache.cards);
      this.loaded.set(true);
      // Silent revalidate in background
      this.silentRevalidate();
      return;
    }

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

  onTuneApplied(interests: Record<string, number>) {
    this.profileStore.setInterests(interests);
    localStorage.setItem('ld_tune_interests', 'done');
    this.tuneBlockDismissed.set(true);
    this.loadFeed();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onTuneDismissed() {
    localStorage.setItem('ld_tune_interests', 'dismissed');
    this.tuneBlockDismissed.set(true);
  }

  readonly hasActiveFilters = computed(() =>
    this.activePreset() !== null || this.activeTypeFilter() !== 'all'
  );

  clearAllFilters() {
    this.activePreset.set(null);
    this.activeTypeFilter.set('all');
    this.loadFeed();
  }

  pluralizeResults(n: number): string {
    const locale = this.profileStore.locale();
    if (locale === 'en') return n === 1 ? 'result' : 'results';
    if (locale === 'ka') return 'შედეგი';
    // Russian pluralization: 1 результат, 2-4 результата, 5-20 результатов, 21 результат...
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'результат';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'результата';
    return 'результатов';
  }

  openDecide() {
    if (this.decideCards().length > 0) {
      this.decideOpen.set(true);
      this.interactions.track({ eventType: 'decide_open', targetType: 'feed', targetId: this.decideCards()[0]?.id });
    }
  }

  setSidebarTime(value: string) {
    this.sidebarTime.set(value);
    this.onContextChanged();
  }

  async requestGps() {
    await this.geo.requestPosition();
  }

  /** User taps "force now" on fallback banner */
  forceNow() {
    this.forcedNow.set(true);
    this.loadFeed();
  }

  /** User taps "show tomorrow" from night empty state */
  showTomorrow() {
    this.forcedNow.set(false);
    this.loadFeed();
  }

  loadFeed() {
    this.loading.set(true);
    const loaderStart = Date.now();

    const ctx = this.contextBar();
    const pos = this.geo.position();
    const defaultRadius = pos.source === 'default' ? 3000 : 5000;
    const isDesktop = window.innerWidth >= 1024;
    const radiusM = isDesktop ? this.sidebarRadius() * 1000 : (ctx ? ctx.getRadiusM() : defaultRadius);
    const timeWindow = isDesktop ? this.getTimeWindowForValue(this.sidebarTime()) : (ctx ? ctx.getTimeWindow() : this.defaultTimeWindow());
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
        forcedNow: this.forcedNow() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.feedMeta.set(res.meta);
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

          const finish = () => {
            this.allCards.set(filtered);
            this.visibleCount.set(15);
            this.loading.set(false);
            this.loaded.set(true);
            // Track impressions for visible cards
            filtered.slice(0, 15).forEach((c, i) =>
              this.interactions.trackImpression(c.type, c.id, i));
            // GA4: recommendation_generated or no_results
            if (filtered.length > 0) {
              (window as any).gtag?.('event', 'recommendation_generated', { result_count: filtered.length });
            } else {
              (window as any).gtag?.('event', 'no_results', {});
              this.interactions.track({ eventType: 'no_results', targetType: 'feed' });
            }
            // Cache for scroll restore + SWR
            this.cachedScrollY = 0;
            this.saveFeedCache();
          };

          // Min 400ms display for feed loader (anti-flash)
          const elapsed = Date.now() - loaderStart;
          if (elapsed < 400) {
            setTimeout(finish, 400 - elapsed);
          } else {
            finish();
          }
        },
        error: () => {
          this.loading.set(false);
          this.loaded.set(true);
        },
      });
  }

  onOpenDetail(card: RecommendationCard) {
    const pos = this.cards().findIndex(c => c.id === card.id);
    this.interactions.trackClick(card.type, card.id, pos);
    this.openedCardIds.add(card.id);
    this.checkQualifiedSession('card_click');
    if (window.innerWidth >= 1024) {
      this.modalCard.set(card);
      history.replaceState({ modal: true }, '', `/detail/${card.type}/${card.id}`);
    } else {
      // Save scroll + cards before navigating (for restore on back)
      this.cachedScrollY = window.scrollY;
      this.navigatedToDetail = true;
      this.saveFeedCache();
      this.router.navigate(['/detail', card.type, card.id]);
    }
  }

  closeModal() {
    this.modalCard.set(null);
    history.replaceState(null, '', '/discover');
  }

  onToggleSave(card: RecommendationCard) {
    this.savedStore.toggle(card);
    this.interactions.trackSave(card.type, card.id);
    this.hasQualifiedAction = true;
    this.checkQualifiedSession('save');
  }

  onHideCard(card: RecommendationCard) {
    this.interactions.trackHide(card.type, card.id);

    // Clear previous undo timer
    const prev = this.undoableHide();
    if (prev) clearTimeout(prev.timer);

    const index = this.allCards().findIndex(c => c.id === card.id);
    this.profileStore.addHidden(card.id);
    this.allCards.update((cards) => cards.filter((c) => c.id !== card.id));

    const timer = setTimeout(() => this.undoableHide.set(null), 6000);
    this.undoableHide.set({ card, index, timer });
  }

  undoHide() {
    const u = this.undoableHide();
    if (!u) return;
    clearTimeout(u.timer);
    this.profileStore.removeHidden(u.card.id);
    this.allCards.update(cards => {
      const copy = [...cards];
      const pos = Math.min(u.index, copy.length);
      copy.splice(pos, 0, u.card);
      return copy;
    });
    this.undoableHide.set(null);
  }

  private defaultTimeWindow() {
    const now = new Date();
    return { from: now.toISOString(), to: new Date(now.getTime() + 6 * 3600000).toISOString() };
  }

  private getTimeWindowForValue(value: string): { from: string; to: string } {
    const now = new Date();

    if (value === 'evening') {
      const from = new Date(now);
      if (now.getHours() < 18) from.setHours(18, 0, 0, 0);
      const to = new Date(from);
      to.setHours(23, 59, 59, 0);
      if (to < now) { from.setDate(from.getDate() + 1); from.setHours(18, 0, 0, 0); to.setDate(to.getDate() + 1); }
      return { from: from.toISOString(), to: to.toISOString() };
    }

    if (value === 'tomorrow') {
      const from = new Date(now);
      from.setDate(from.getDate() + 1);
      from.setHours(8, 0, 0, 0);
      const to = new Date(from);
      to.setHours(23, 59, 59, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }

    if (value === 'weekend') {
      const dayOfWeek = now.getDay();
      const from = new Date(now);
      if (dayOfWeek === 6) from.setHours(Math.max(from.getHours(), 8), 0, 0, 0);
      else if (dayOfWeek === 0) from.setHours(Math.max(from.getHours(), 8), 0, 0, 0);
      else { from.setDate(from.getDate() + (6 - dayOfWeek)); from.setHours(8, 0, 0, 0); }
      const to = new Date(from);
      if (from.getDay() === 6) to.setDate(to.getDate() + 1);
      to.setHours(23, 59, 59, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }

    // 'now' — next 6 hours
    return this.defaultTimeWindow();
  }

  // ── Qualified session (Google Ads conversion) ──

  private checkQualifiedSession(action: string) {
    if (this.qualifiedFired) return;
    if (this.openedCardIds.size >= 2 && this.hasQualifiedAction) {
      this.qualifiedFired = true;
      this.interactions.track({
        eventType: 'qualified_session',
        targetType: 'feed',
        context: { cards_opened: this.openedCardIds.size, intent_action: action },
      });
      (window as any).gtag?.('event', 'qualified_session', {
        cards_opened: this.openedCardIds.size,
        intent_action: action,
      });
      // Google Ads conversion
      (window as any).gtag?.('event', 'conversion', {
        send_to: 'AW-18318311908/Fg7TCIPXjs8cEOSD7Z5E',
        value: 1.0,
        currency: 'USD',
      });
    }
  }

  /** Called from detail component when route/share happens (via event bubbling or service) */
  markQualifiedAction() {
    this.hasQualifiedAction = true;
    this.checkQualifiedSession('route_or_share');
  }

  // ── Feed cache (#41 scroll restore + #42 SWR) ──

  private readonly FEED_CACHE_KEY = 'ld_feed_cache';

  private saveFeedCache() {
    const pos = this.geo.position();
    const cache = {
      cards: this.allCards(),
      scrollY: this.cachedScrollY,
      timestamp: Date.now(),
      lat: pos.lat,
      lng: pos.lng,
      preset: this.activePreset(),
    };
    try {
      sessionStorage.setItem(this.FEED_CACHE_KEY, JSON.stringify(cache));
    } catch { /* quota exceeded — ignore */ }
  }

  private loadFeedCache(): { cards: RecommendationCard[]; scrollY: number; timestamp: number; lat: number; lng: number; preset: string | null } | null {
    try {
      const raw = sessionStorage.getItem(this.FEED_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private isContextChanged(cache: { timestamp: number; lat: number; lng: number; preset: string | null }): boolean {
    const pos = this.geo.position();
    const elapsed = Date.now() - cache.timestamp;

    // >6 hours → stale
    if (elapsed > 6 * 3600000) return true;
    // Different preset
    if (cache.preset !== this.activePreset()) return true;
    // Moved >500m
    const dLat = Math.abs(pos.lat - cache.lat);
    const dLng = Math.abs(pos.lng - cache.lng);
    if (dLat > 0.0045 || dLng > 0.006) return true; // ~500m

    return false;
  }

  private silentRevalidate() {
    const ctx = this.contextBar();
    const pos = this.geo.position();
    const isDesktop = window.innerWidth >= 1024;
    const defaultRadius = pos.source === 'default' ? 3000 : 5000;
    const radiusM = isDesktop ? this.sidebarRadius() * 1000 : (ctx ? ctx.getRadiusM() : defaultRadius);
    const timeWindow = isDesktop ? this.getTimeWindowForValue(this.sidebarTime()) : (ctx ? ctx.getTimeWindow() : this.defaultTimeWindow());
    const preset = this.activePreset();
    const mood = preset ? this.MOOD_PRESETS[preset] : null;
    const interests = mood?.interests ?? this.profileStore.interests();
    const company = (mood?.company ?? this.profileStore.company() ?? undefined) as any;

    this.api
      .discover({
        lat: pos.lat, lng: pos.lng,
        radiusM: mood?.radiusM ?? radiusM,
        timeWindow,
        profile: { interests, company, hasPet: this.profileStore.hasPet() || undefined },
        hiddenIds: this.profileStore.hiddenIds(),
        locale: this.profileStore.locale(),
      })
      .subscribe({
        next: (res) => {
          const oldIds = this.allCards().map(c => c.id).join(',');
          const newIds = res.cards.map(c => c.id).join(',');
          if (oldIds !== newIds) {
            this.allCards.set(res.cards);
            this.feedMeta.set(res.meta);
          }
          this.saveFeedCache();
        },
      });
  }
}
