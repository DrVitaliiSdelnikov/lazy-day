import { Component, computed, effect, ElementRef, HostListener, inject, isDevMode, OnInit, AfterViewInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProfileStore } from '../../core/stores/profile.store';
import { ThemeService } from '../../core/services/theme.service';
import { SavedStore } from '../../core/stores/saved.store';
import { ApiService } from '../../core/services/api.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { apiProviders } from '../../core/providers';
import { RecommendationCard, DiscoverMeta, SuggestedFacet, CANONICAL_PRESETS, CANONICAL_RADIUS, PRESET_META } from '../../core/models';
import { ResultCardComponent } from './result-card/result-card.component';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { DetailComponent } from '../detail/detail.component';
import { ContextBarComponent } from './context-bar/context-bar.component';
import { FilterSheetComponent, FilterState } from './filter-sheet/filter-sheet.component';
import { FeedLoaderComponent } from './feed-loader/feed-loader.component';
import { FeedTuneBlockComponent } from './feed-tune-block/feed-tune-block.component';
import { InteractionService } from '../../core/services/interaction.service';
import { NetworkStatusService } from '../../core/services/network-status.service';
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
      <!-- Filters drawer overlay (desktop: right side, mobile: bottom sheet) -->
      @if (filtersDrawerOpen()) {
        <div class="drawer__backdrop" (click)="filtersDrawerOpen.set(false)"></div>
      }
      <aside class="drawer__panel" [class.drawer__panel--open]="filtersDrawerOpen()">
        <div class="drawer__header">
          <h4 class="drawer__title">{{ 'sidebar.filters' | translate }}</h4>
          <button class="drawer__close" (click)="filtersDrawerOpen.set(false)">
            <ld-icon name="x" [size]="16" />
          </button>
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">{{ 'sidebar.location' | translate }}</p>
          <div class="sidebar__location" [class.sidebar__location--default]="geo.position().source === 'default'">
            <ld-icon name="map-pin" [size]="14" />
            @if (geo.position().source === 'gps') {
              <span>{{ 'sidebar.my_location' | translate }}</span>
            } @else {
              <span style="white-space:nowrap">{{ geo.position().label }}</span>
              <button class="sidebar__geo-hint" (click)="requestGps()">{{ 'geo.enable' | translate }}</button>
            }
          </div>
        </div>
        <div class="sidebar__section">
          <p class="sidebar__label">{{ 'sidebar.radius' | translate }} · {{ sidebarRadius() }} {{ 'route.km' | translate }}</p>
          <input type="range" class="ld-slider" aria-label="Radius"
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
        <button class="ld-btn ld-btn--ghost" style="color: var(--ld-primary); font-size: 12px; margin-top: 16px; width: 100%"
          (click)="resetSidebar()">{{ 'sidebar.reset_all' | translate }}</button>
      </aside>

      <!-- Main content area -->
      <div class="discover__main">
      <!-- Greeting -->
      <header class="discover__header">
        <p class="discover__context">{{ contextLine() }}</p>
        <h1 class="discover__greeting ld-display">{{ greeting() }}</h1>
      </header>

      <!-- Context bar removed: drawer filters are the single source of truth -->

      <!-- Mode switcher: Browse places / Build route -->
      <div class="discover__mode">
        <button class="discover__mode-btn" [class.discover__mode-btn--active]="true">
          <ld-icon name="layout-grid" [size]="16" /> {{ 'discover.mode_browse' | translate }}
        </button>
        <button class="discover__mode-btn" (click)="openRoute()">
          <ld-icon name="route" [size]="16" /> {{ 'discover.mode_route' | translate }}
          <span class="discover__mode-sub">{{ 'discover.mode_route_sub' | translate }}</span>
        </button>
      </div>

      <!-- Mood categories: single-select, always visible -->
      <div class="discover__mood-section">
        <p class="discover__mood-label">{{ 'discover.mood_label' | translate }}</p>
        <div class="discover__mood-row">
          @if (moodsOverflowing()) {
            <button class="discover__mood-arrow" (click)="scrollMoods(-1)" aria-label="Scroll left">‹</button>
          }
          <div class="discover__moods" #moodsScroll>
            @for (p of presets; track p.key) {
              <button class="discover__mood-chip"
                [class.discover__mood-chip--active]="activePreset() === p.key"
                (click)="applyPreset(p.key)">
                <ld-icon [name]="p.icon" [size]="15" />
                <span>{{ p.labelKey | translate }}</span>
              </button>
            }
          </div>
          @if (moodsOverflowing()) {
            <button class="discover__mood-arrow" (click)="scrollMoods(1)" aria-label="Scroll right">›</button>
          }
          <div class="discover__mood-actions">
            @if (hasActiveFilters()) {
              <button class="discover__clear-text-btn" (click)="clearAllFilters()">
                {{ 'discover.clear_filters' | translate }}
              </button>
            }
            <button class="discover__filters-btn" (click)="filtersDrawerOpen.set(true)">
              <ld-icon name="adjustments-horizontal" [size]="14" />
              {{ 'sidebar.filters' | translate }}
              @if (activeFilterCount() > 0) {
                <span class="discover__filters-badge">{{ activeFilterCount() }}</span>
              }
            </button>
          </div>
        </div>
      </div>

      <!-- Refine row: "Уточнить" button + active facet chips + decide button -->
      <div class="discover__refine-row">
        @if (paletteChips().length > 0) {
          <button class="discover__refine-btn" [class.discover__refine-btn--open]="refineOpen()"
            (click)="refineOpen.set(!refineOpen())">
            {{ 'discover.refine' | translate }}
            @if (activeFacetCount() > 0) {
              <span class="discover__refine-badge">{{ activeFacetCount() }}</span>
            }
          </button>
        }
        @for (chip of activeFacetChips(); track chip.facet) {
          <button class="discover__active-facet" (click)="applyFacetFilter(chip.facet)">
            {{ facetLabel(chip.facet) }} <ld-icon name="x" [size]="10" />
          </button>
        }
        <span style="flex:1"></span>
        <button class="discover__decide-btn" (click)="openDecide()"
          [disabled]="loading() || cards().length === 0"
          [attr.aria-label]="'decide.button' | translate">
          <ld-icon name="compass" [size]="15" />
        </button>
      </div>

      <!-- Facets inline panel (under refine button, contextual to mood) -->
      @if (refineOpen() && paletteChips().length > 0) {
        <div class="discover__facets-panel">
          <p class="discover__facets-context">
            {{ 'discover.refine_for' | translate }} <strong>{{ activePresetLabel() }}</strong>
          </p>
          <div class="discover__facets-grid">
            @for (chip of paletteChips(); track chip.facet) {
              <button class="discover__facet-chip"
                [class.discover__facet-chip--active]="chip.active"
                (click)="applyFacetFilter(chip.facet)">
                {{ facetLabel(chip.facet) }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Fallback banner: tomorrow mode -->
      @if (!loading() && feedMeta()?.fallback === 'tomorrow') {
        <div class="discover__fallback-banner">
          <span>{{ 'fallback.tomorrow_banner' | translate }}</span>
          <button class="ld-btn ld-btn--ghost discover__fallback-action" (click)="forceNow()">{{ 'fallback.force_now' | translate }}</button>
        </div>
      }

      <!-- Offline/degraded banner -->
      @if (!network.isOnline()) {
        <div class="discover__offline-banner">
          <span>{{ network.isOffline() ? ('net.offline' | translate) : ('net.degraded' | translate) }}</span>
        </div>
      }

      <!-- Results count -->
      @if (!loading() && cards().length > 0) {
        <div class="discover__count">{{ totalLabel() }}</div>
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
              [id]="'card_' + card.id"
              [card]="card"
              [isSaved]="savedStore.isSaved(card.id)"
              [showGeoHint]="i === 0 && geo.position().source !== 'gps'"
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
            {{ 'discover.show_more' | translate }}
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

    <!-- Geo priming sheet -->
    @if (geoPrimingOpen()) {
      <div class="ld-sheet-backdrop ld-sheet-backdrop--visible" (click)="geoPrimingOpen.set(false)"></div>
      <div class="ld-sheet ld-sheet--open">
        <div class="ld-sheet__handle"></div>
        <h3 style="margin: 0 0 8px; font-size: 16px">{{ 'geo.priming_title' | translate }}</h3>
        <p style="font-size: 13px; color: var(--ld-text-2); margin: 0 0 16px; line-height: 1.5">{{ 'geo.priming_body' | translate }}</p>
        <button class="ld-btn ld-btn--primary" style="width: 100%; margin-bottom: 8px" (click)="onGeoAllow()">{{ 'geo.priming_allow' | translate }}</button>
        <button class="ld-btn ld-btn--ghost" style="width: 100%; color: var(--ld-text-3)" (click)="geoPrimingOpen.set(false)">{{ 'geo.priming_skip' | translate }}</button>
      </div>
    }

    <!-- Decide for me overlay -->
    @if (decideOpen() && cards().length > 0) {
      <app-decide-for-me [cards]="cards()" (close)="decideOpen.set(false)" />
    }
  `,
  styles: `
    /* ─── Layout ─── */
    /* context-bar removed — drawer filters are single source of truth */

    /* Drawer overlay */
    .drawer__backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.3);
      z-index: 100; animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .drawer__panel {
      position: fixed; z-index: 101; background: var(--ld-surface);
      overflow-y: auto; padding: 20px;
      transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    }
    /* Desktop: right side drawer */
    @media (min-width: 768px) {
      .drawer__panel {
        top: 0; right: 0; bottom: 0; width: 320px;
        border-left: 1px solid var(--ld-border);
        box-shadow: -8px 0 24px rgba(0,0,0,0.08);
        transform: translateX(100%);
      }
      .drawer__panel--open { transform: translateX(0); }
    }
    /* Mobile: bottom sheet */
    @media (max-width: 767px) {
      .drawer__panel {
        left: 0; right: 0; bottom: 0;
        max-height: 85vh; border-radius: 20px 20px 0 0;
        box-shadow: 0 -8px 24px rgba(0,0,0,0.12);
        transform: translateY(100%);
      }
      .drawer__panel--open { transform: translateY(0); }
    }
    .drawer__header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
    }
    .drawer__title { margin: 0; font-size: 16px; font-weight: 700; color: var(--ld-text); }
    .drawer__close {
      border: 0; background: 0; color: var(--ld-text-3); cursor: pointer;
      padding: 4px; display: flex;
    }
    /* drawer__apply removed — filters auto-apply on change */

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

    .sidebar__geo-hint {
      font-size: 11px;
      color: var(--ld-primary);
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      margin-left: auto;
      white-space: nowrap;
      animation: geo-pulse 4s ease-in-out infinite;
    }

    @keyframes geo-pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
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
    .discover__mood-row {
      display: flex; align-items: center; position: relative; justify-content: space-between;
    }
    .discover__mood-arrow {
      flex-shrink: 0; border: none; background: var(--ld-surface);
      border-radius: 50%; width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 700; color: var(--ld-text-3);
      cursor: pointer; box-shadow: var(--ld-shadow-card);
      transition: color 150ms, background 150ms; margin: 0 10px;
    }
    .discover__mood-arrow:hover { color: var(--ld-text); background: var(--ld-surface-2); }
    .discover__mood-actions {
      display: flex; align-items: center; gap: 6px;
      flex-shrink: 0; padding-left: 12px; z-index: 1;
      background: linear-gradient(to right, transparent, var(--ld-bg) 12px);
    }
    .discover__clear-text-btn {
      border: none; background: none; font-size: 12px;
      color: var(--ld-primary); cursor: pointer; font-family: inherit;
      font-weight: 600; white-space: nowrap; padding: 6px 0;
      transition: opacity 150ms;
    }
    .discover__clear-text-btn:hover { opacity: 0.7; }

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

    .discover__filters-btn {
      display: flex; align-items: center; gap: 6px;
      border: 1px solid var(--ld-border); background: var(--ld-surface);
      border-radius: 10px; padding: 8px 13px;
      font-size: 12px; font-weight: 600; color: var(--ld-text);
      cursor: pointer; font-family: inherit; white-space: nowrap;
      flex-shrink: 0;
    }
    .discover__filters-badge {
      background: var(--ld-primary); color: var(--ld-on-primary, #fff);
      border-radius: 7px; font-size: 10px; padding: 0 5px; font-weight: 700;
    }

    /* Mode switcher */
    .discover__mode {
      display: flex; gap: 6px;
      padding: 4px; margin: 0 var(--ld-space-lg) 12px;
      background: var(--ld-surface); border: 1px solid var(--ld-border);
      border-radius: 14px;
    }
    .discover__mode-btn {
      flex: 1; border: 0; border-radius: 11px; padding: 10px 8px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      background: transparent; color: var(--ld-text-2);
      font-family: inherit; transition: background 150ms, color 150ms;
    }
    .discover__mode-btn--active {
      background: var(--ld-primary); color: var(--ld-on-primary, #fff);
    }
    .discover__mode-sub {
      font-weight: 400; font-size: 10px; opacity: 0.8;
    }

    /* Mood categories */
    .discover__mood-section {
      padding: 0 var(--ld-space-lg); margin-bottom: 10px;
    }
    .discover__mood-label {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--ld-text-3); font-weight: 600; margin: 0 0 6px;
    }
    .discover__moods {
      display: flex; gap: 6px; overflow-x: auto;
      scrollbar-width: none; padding-bottom: 2px;
    }
    .discover__moods::-webkit-scrollbar { display: none; }
    .discover__mood-chip {
      display: flex; align-items: center; gap: 5px;
      padding: 8px 14px; border-radius: 20px;
      font-size: 13px; font-weight: 500; white-space: nowrap;
      cursor: pointer; font-family: inherit;
      border: 1px solid var(--ld-border); background: var(--ld-surface);
      color: var(--ld-text-2); transition: all 150ms;
    }
    .discover__mood-chip--active {
      background: var(--ld-primary); color: var(--ld-on-primary, #fff);
      border-color: var(--ld-primary);
    }

    /* Refine row */
    .discover__refine-row {
      display: flex; align-items: center; gap: 6px;
      padding: 0 var(--ld-space-lg); margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .discover__refine-btn {
      display: flex; align-items: center; gap: 5px;
      border: 1px solid var(--ld-border); background: var(--ld-surface);
      border-radius: 10px; padding: 7px 12px;
      font-size: 12px; font-weight: 600; color: var(--ld-text);
      cursor: pointer; font-family: inherit;
    }
    .discover__refine-btn--open {
      background: var(--ld-primary-soft); border-color: var(--ld-primary);
      color: var(--ld-on-primary-soft, var(--ld-primary));
    }
    .discover__refine-badge {
      background: var(--ld-primary); color: var(--ld-on-primary, #fff);
      border-radius: 7px; font-size: 10px; padding: 0 5px;
    }
    .discover__active-facet {
      display: flex; align-items: center; gap: 4px;
      border: 1px dashed var(--ld-primary); background: var(--ld-primary-soft);
      border-radius: 14px; padding: 5px 10px;
      font-size: 12px; color: var(--ld-on-primary-soft, var(--ld-primary));
      cursor: pointer; font-family: inherit;
    }

    /* Facets inline panel */
    .discover__facets-panel {
      margin: 0 var(--ld-space-lg) 10px;
      padding: 12px 14px; background: var(--ld-surface);
      border: 1px solid var(--ld-primary); border-radius: 12px;
    }
    .discover__facets-context {
      font-size: 11px; color: var(--ld-text-3); margin: 0 0 8px;
    }
    .discover__facets-context strong {
      color: var(--ld-on-primary-soft, var(--ld-primary)); font-weight: 700;
    }
    .discover__facets-grid {
      display: flex; gap: 6px; flex-wrap: wrap;
    }
    .discover__facet-chip {
      border: 1px solid var(--ld-border); background: var(--ld-surface-2);
      border-radius: 14px; padding: 5px 11px;
      font-size: 12px; color: var(--ld-text-2);
      cursor: pointer; font-family: inherit;
      transition: all 150ms;
    }
    .discover__facet-chip--active {
      background: var(--ld-primary-soft); border-color: var(--ld-primary);
      color: var(--ld-on-primary-soft, var(--ld-primary)); font-weight: 600;
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

    .discover__palette {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: var(--ld-space-sm) var(--ld-space-lg);
      align-items: center;
      position: relative;
      z-index: 1;
      transition: opacity 0.2s;
    }

    .discover__palette--loading {
      opacity: 0.6;
      pointer-events: none;
    }

    .discover__palette-label {
      font-size: 12px;
      color: var(--ld-text-3);
      font-style: italic;
      margin-right: 4px;
      flex-shrink: 0;
    }

    .discover__palette .ld-chip {
      background: var(--ld-surface);
      border: 1px dashed var(--ld-border);
      font-size: 12px;
      color: var(--ld-text-2);
      cursor: pointer;
      transition: opacity 0.24s, transform 0.24s, max-width 0.28s;

      &:hover {
        border-color: var(--ld-primary);
        color: var(--ld-primary);
      }

      &.ld-chip--active {
        background: var(--ld-primary-soft);
        color: var(--ld-on-primary-soft);
        border: 1px solid var(--ld-primary);
      }
    }

    .discover__palette-pins {
      display: inline-flex;
      gap: 2px;
      margin-left: 4px;
    }

    .discover__palette-pins .pin {
      display: inline-block;
      transform-origin: bottom center;
      color: var(--ld-primary);
      animation: pinHop 1.05s ease-in-out infinite;
    }

    .discover__palette-pins .pin:nth-child(2) { animation-delay: 0.14s; }
    .discover__palette-pins .pin:nth-child(3) { animation-delay: 0.28s; }

    @keyframes pinHop {
      0%, 70%, 100% { transform: translateY(0) scale(1); opacity: 0.55; }
      35% { transform: translateY(-7px) scale(1.12); opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .discover__palette-pins .pin { animation: none; opacity: 0.7; }
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
      animation: decide-pulse 3s ease-in-out infinite;

      &:disabled { opacity: 0.4; cursor: default; animation: none; }
    }

    @keyframes decide-pulse {
      0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ld-primary) 40%, transparent); }
      50% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--ld-primary) 0%, transparent); }
    }

    .discover__route-btn {
      width: 40px;
      min-height: 36px;
      background: var(--ld-surface);
      color: var(--ld-primary);
      border: 1px solid var(--ld-primary);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      padding: 0;
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

    .discover__offline-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px var(--ld-space-lg);
      margin: 0 var(--ld-space-lg) var(--ld-space-sm);
      background: var(--ld-surface-2);
      border-radius: 8px;
      font-size: 12px;
      color: var(--ld-text-3);
      font-style: italic;
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
export class DiscoverComponent implements OnInit, AfterViewInit {
  readonly profileStore = inject(ProfileStore);
  readonly savedStore = inject(SavedStore);
  private api = inject(ApiService);
  readonly geo = inject(GeolocationService);
  private router = inject(Router);
  private theme = inject(ThemeService);
  private translate = inject(TranslateService);
  private interactions = inject(InteractionService);
  readonly network = inject(NetworkStatusService);

  private _sessionFilters = this.loadSessionFilters();
  sidebarRadius = signal(this._sessionFilters.radius);
  sidebarTime = signal(this._sessionFilters.time);

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
    this.saveSessionFilters();
    this.onContextChanged();
  }

  /** Секции sidebar: >100 → "100+", ≤100 → exact. Uses lightweight count endpoint. */
  countByType(type: string): string {
    const c = this.sectionCounts();
    const n = type === 'all' ? c.total : type === 'place' ? c.places : c.events;
    return n > 100 ? '100+' : String(n);
  }

  resetSidebar() {
    this.activePreset.set(null);
    this.activeTypeFilter.set('all');
    this.activeFacetFilters.set([]);
    this.sidebarRadius.set(5);
    this.sidebarTime.set('now');
    sessionStorage.removeItem('ld_filters');
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
  readonly activeTypeFilter = signal<'all' | 'place' | 'event'>(this._sessionFilters.typeFilter);
  readonly visibleCount = signal(15);

  private pendingScrollCardId: string | null = null;

  // Qualified session tracking (for ads)
  private openedCardIds = new Set<string>();
  private hasQualifiedAction = false;
  private qualifiedFired = false;
  readonly cards = computed(() => this.allCards());
  readonly hasMoreCards = computed(() => {
    if (!this.hasMoreFromServer()) return false;
    // When filtered by type, only show "more" if current filter has room to grow
    const type = this.activeTypeFilter();
    if (type !== 'all') {
      const filtered = this.allCards().filter(c => c.type === type);
      // If we already loaded all of this type from what server sent, no more
      return filtered.length >= 15 && this.hasMoreFromServer();
    }
    return true;
  });
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly filtersDrawerOpen = signal(false);
  private moodsScroll = viewChild<ElementRef>('moodsScroll');
  readonly moodsOverflowing = signal(false);

  scrollMoods(direction: number) {
    const el = this.moodsScroll()?.nativeElement;
    if (el) el.scrollBy({ left: direction * 150, behavior: 'smooth' });
  }

  private checkMoodsOverflow() {
    const el = this.moodsScroll()?.nativeElement;
    if (el) {
      this.moodsOverflowing.set(el.scrollWidth > el.clientWidth);
    }
  }
  readonly refineOpen = signal(false);

  readonly activeFacetChips = computed(() => this.paletteChips().filter(c => c.active));
  readonly activeFacetCount = computed(() => this.activeFacetChips().length);

  activePresetLabel(): string {
    const key = this.activePreset();
    if (!key) return '';
    const p = this.presets.find(pr => pr.key === key);
    return p ? this.translate.instant(p.labelKey) : key;
  }
  readonly hasMoreFromServer = signal(true);
  readonly totalFromServer = signal(0);
  readonly sectionCounts = signal<{ places: number; events: number; total: number }>({ places: 0, events: 0, total: 0 });
  /** Fixed seed for session — dithering/epsilon produce same order within session */
  private readonly sessionSeed = Math.floor(Math.random() * 2147483647);
  readonly feedMeta = signal<DiscoverMeta | undefined>(undefined);
  readonly suggestedFacets = signal<SuggestedFacet[]>([]);
  readonly activeFacetFilters = signal<string[]>(this._sessionFilters.facetFilters);
  readonly paletteLoading = signal(false);
  readonly paletteChips = computed(() => {
    const active = this.activeFacetFilters();
    const suggested = this.suggestedFacets();
    const chips: { facet: string; count: number; active: boolean }[] = [];
    // Active facets first (always visible, with X to deselect)
    for (const f of active) {
      chips.push({ facet: f, count: 0, active: true });
    }
    // Then suggested (not already active)
    for (const sf of suggested) {
      if (!active.includes(sf.facet)) {
        chips.push({ facet: sf.facet, count: sf.count, active: false });
      }
    }
    return chips;
  });
  readonly forcedNow = signal(false);
  readonly activePreset = signal<string | null>(this._sessionFilters.preset);
  readonly undoableHide = signal<{ card: RecommendationCard; index: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  readonly decideOpen = signal(false);
  readonly geoPrimingOpen = signal(false);
  private geoPrimingShownThisSession = false;
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

  presets = PRESET_META;

  typeFilters = [
    { value: 'all' as const, labelKey: 'type_filter.all', icon: '' },
    { value: 'place' as const, labelKey: 'type_filter.place', icon: 'map-pin' },
    { value: 'event' as const, labelKey: 'type_filter.event', icon: 'ticket' },
  ];

  /** Mood presets built from canonical source. Company overrides per preset. */
  private readonly MOOD_PRESETS: Record<string, { interests: Record<string, number>; company?: string; radiusM?: number }> =
    Object.fromEntries(
      Object.entries(CANONICAL_PRESETS).map(([key, interests]) => [
        key,
        {
          interests,
          radiusM: CANONICAL_RADIUS[key] ?? 5000,
          ...(key === 'family' ? { company: 'family' } : {}),
        },
      ]),
    );

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

    // Scroll to last opened card after loader hides and cards are rendered
    effect(() => {
      const isLoaded = this.loaded();
      const isLoading = this.loading();
      if (isLoaded && !isLoading && this.pendingScrollCardId) {
        const cardId = this.pendingScrollCardId;
        this.pendingScrollCardId = null;
        requestAnimationFrame(() => {
          const el = document.getElementById(`card_${cardId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.checkMoodsOverflow(), 100);
  }

  @HostListener('window:resize')
  onResize() { this.checkMoodsOverflow(); }

  ngOnInit() {
    // F3.4: No gate — show feed immediately with popularity fallback.
    // Onboarding is optional (accessible from settings).
    // If no interests → loadFeed uses empty interests → backend returns popularity-sorted results.
    this.geoVersion = this.geo.updated();

    // #41: Back-navigation from detail — restore from cache, show loader, then scroll
    const selectedCardId = sessionStorage.getItem('ld_selected_card');
    const cache = this.loadFeedCache();
    if (selectedCardId && cache) {
      sessionStorage.removeItem('ld_selected_card');
      this.pendingScrollCardId = selectedCardId;
      this.loading.set(true);
      const restoreStart = Date.now();
      this.allCards.set(cache.cards);
      this.hasMoreFromServer.set(cache.hasMore ?? true);
      this.totalFromServer.set(cache.total ?? 0);
      // Show loader for at least 400ms (anti-flash), then reveal cards
      const elapsed = Date.now() - restoreStart;
      const delay = Math.max(400 - elapsed, 0);
      setTimeout(() => {
        this.loading.set(false);
        this.loaded.set(true);
      }, delay);
      return;
    }

    // #42: SWR — show cached feed instantly if context similar
    if (cache && !this.isContextChanged(cache)) {
      this.allCards.set(cache.cards);
      this.hasMoreFromServer.set(cache.hasMore ?? true);
      this.totalFromServer.set(cache.total ?? 0);
      this.loaded.set(true);
      this.silentRevalidate();
      return;
    }

    this.loadFeed();
  }

  applyPreset(key: string) {
    const value = this.activePreset() === key ? null : key;
    this.activePreset.set(value);
    this.saveSessionFilters();
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
    this.saveSessionFilters();
    this.loadFeed();
  }

  facetLabel(facet: string): string {
    const key = `facet.${facet}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : facet.replace(/_/g, ' ');
  }

  private _facetRollback: string[] | null = null;

  applyFacetFilter(facet: string) {
    const prev = this.activeFacetFilters();
    this._facetRollback = [...prev]; // save for rollback
    if (prev.includes(facet)) {
      this.activeFacetFilters.set(prev.filter(f => f !== facet));
    } else {
      this.activeFacetFilters.set([...prev, facet]);
    }
    this.saveSessionFilters();
    this.paletteLoading.set(true);
    // Register retry for auto-recovery
    this.network.setPendingRetry(() => this.loadFeed());
    this.loadFeed();
  }

  showMore() {
    const current = this.allCards();
    const pos = this.geo.position();
    const radiusM = this.sidebarRadius() * 1000;
    const timeWindow = this.getTimeWindowForValue(this.sidebarTime());
    const preset = this.activePreset();
    const mood = preset ? this.MOOD_PRESETS[preset] : null;
    const interests = mood?.interests ?? this.profileStore.interests();
    const company = (mood?.company ?? this.profileStore.company() ?? undefined) as any;

    this.api.discover({
      lat: pos.lat, lng: pos.lng,
      radiusM,
      timeWindow,
      profile: { interests, company, hasPet: this.profileStore.hasPet() || undefined },
      hiddenIds: this.profileStore.hiddenIds(),
      locale: this.profileStore.locale(),
      deviceIdHash: this.profileStore.deviceIdHash() || undefined,
      sessionSeed: this.sessionSeed,
      typeFilter: this.activeTypeFilter() !== 'all' ? this.activeTypeFilter() : undefined,
      offset: current.length,
      limit: 15,
    }).subscribe({
      next: (res) => {
        const existingIds = new Set(current.map((c: any) => c.id));
        const newCards = res.cards.filter((c: any) => !existingIds.has(c.id));
        this.allCards.set([...current, ...newCards]);
        this.totalFromServer.set((res as any).total ?? this.totalFromServer());
        // If no new unique cards came back, stop pagination
        this.hasMoreFromServer.set(newCards.length > 0 && res.hasMore);
      },
    });
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

  /** Перед списком: всегда точное число */
  totalLabel(): string {
    const total = this.totalFromServer();
    if (total > 0) return `${total} ${this.pluralizeResults(total)}`;
    return `${this.cards().length} ${this.pluralizeResults(this.cards().length)}`;
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

  onGeoChipTap() {
    if (this.geo.position().source === 'gps') return; // already enabled
    if (!this.geoPrimingShownThisSession) {
      this.geoPrimingOpen.set(true);
      this.geoPrimingShownThisSession = true;
    } else {
      // Already shown priming this session — go straight to native prompt
      this.geo.requestPosition().then(() => this.loadFeed());
    }
  }

  async onGeoAllow() {
    this.geoPrimingOpen.set(false);
    await this.geo.requestPosition();
    this.loadFeed();
  }

  openDecide() {
    if (this.cards().length > 0) {
      this.decideOpen.set(true);
      this.interactions.track({ eventType: 'decide_open', targetType: 'feed', targetId: this.cards()[0]?.id });
    }
  }

  openRoute() {
    this.router.navigate(['/route']);
  }

  setSidebarTime(value: string) {
    this.sidebarTime.set(value);
    this.saveSessionFilters();
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

    const pos = this.geo.position();
    const radiusM = this.sidebarRadius() * 1000;
    const timeWindow = this.getTimeWindowForValue(this.sidebarTime());
    const preset = this.activePreset();
    const f = this.currentFilters();

    let finalRadius = f?.walkMax20 ? 1600 : radiusM;

    // Mood preset overrides interests and company, NOT radius
    // User's chosen radius (sidebar/context bar) always wins
    const mood = preset ? this.MOOD_PRESETS[preset] : null;
    const interests = mood?.interests ?? this.profileStore.interests();
    const company = (mood?.company ?? this.profileStore.company() ?? undefined) as any;

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
        deviceIdHash: this.profileStore.deviceIdHash() || undefined,
        sessionSeed: this.sessionSeed,
        typeFilter: this.activeTypeFilter() !== 'all' ? this.activeTypeFilter() : undefined,
        facetFilters: this.activeFacetFilters().length > 0 ? this.activeFacetFilters() : undefined,
        offset: 0,
        limit: 15,
      })
      .subscribe({
        next: (res) => {
          this.hasMoreFromServer.set(res.hasMore);
          this.totalFromServer.set((res as any).total ?? 0);
          this.feedMeta.set(res.meta);

          // Lightweight count for section tabs (parallel, non-blocking)
          this.api.count({
            lat: pos.lat, lng: pos.lng, radiusM: finalRadius, timeWindow,
            profile: { interests, company },
            hiddenIds: this.profileStore.hiddenIds(),
            locale: this.profileStore.locale(),
          }).subscribe(c => this.sectionCounts.set(c));
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

          const suggestedFacets = res.suggestedFacets ?? [];
          const finish = () => {
            this.allCards.set(filtered);
            this.suggestedFacets.set(suggestedFacets);
            this.paletteLoading.set(false);
            this._facetRollback = null;
            this.network.setPendingRetry(null);
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
            // Cache for SWR
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
          this.paletteLoading.set(false);
          // Rollback facet selection on network error
          if (this._facetRollback) {
            this.activeFacetFilters.set(this._facetRollback);
            this._facetRollback = null;
            this.saveSessionFilters();
          }
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
      // Save selected card for scroll restore on back-navigation
      sessionStorage.setItem('ld_selected_card', card.id);
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

  private loadSessionFilters(): { preset: string | null; typeFilter: 'all' | 'place' | 'event'; radius: number; time: string; facetFilters: string[] } {
    try {
      const raw = sessionStorage.getItem('ld_filters');
      if (raw) {
        const f = JSON.parse(raw);
        return {
          preset: f.preset ?? null,
          typeFilter: f.typeFilter ?? 'all',
          radius: f.radius ?? 5,
          time: f.time ?? 'now',
          facetFilters: f.facetFilters ?? [],
        };
      }
    } catch { /* corrupted — ignore */ }
    return { preset: null, typeFilter: 'all', radius: 5, time: 'now', facetFilters: [] };
  }

  private saveSessionFilters() {
    const filters = {
      preset: this.activePreset(),
      typeFilter: this.activeTypeFilter(),
      radius: this.sidebarRadius(),
      time: this.sidebarTime(),
      facetFilters: this.activeFacetFilters(),
    };
    try {
      sessionStorage.setItem('ld_filters', JSON.stringify(filters));
    } catch { /* quota exceeded — ignore */ }
  }

  private saveFeedCache() {
    const pos = this.geo.position();
    const cache = {
      cards: this.allCards(),
      timestamp: Date.now(),
      lat: pos.lat,
      lng: pos.lng,
      preset: this.activePreset(),
      hasMore: this.hasMoreFromServer(),
      total: this.totalFromServer(),
    };
    try {
      sessionStorage.setItem(this.FEED_CACHE_KEY, JSON.stringify(cache));
    } catch { /* quota exceeded — ignore */ }
  }

  private loadFeedCache(): { cards: RecommendationCard[]; timestamp: number; lat: number; lng: number; preset: string | null; hasMore?: boolean; total?: number } | null {
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
    const pos = this.geo.position();
    const radiusM = this.sidebarRadius() * 1000;
    const timeWindow = this.getTimeWindowForValue(this.sidebarTime());
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
        deviceIdHash: this.profileStore.deviceIdHash() || undefined,
        sessionSeed: this.sessionSeed,
        typeFilter: this.activeTypeFilter() !== 'all' ? this.activeTypeFilter() : undefined,
        offset: 0,
        limit: 15,
      })
      .subscribe({
        next: (res) => {
          this.hasMoreFromServer.set(res.hasMore);
          this.totalFromServer.set((res as any).total ?? 0);
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
