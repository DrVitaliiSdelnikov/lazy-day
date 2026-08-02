import { Component, inject, signal, computed, viewChild, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { ProfileStore } from '../../core/stores/profile.store';
import { apiProviders } from '../../core/providers';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { RouteMapComponent, MapPoint, MapLine } from '../../core/components/route-map.component';

interface RoutePoint {
  id: string; name: string; category: string; lat: number; lng: number;
  hook?: string; role: string; durationMin: number; arriveAt: string; photoUrl?: string;
}

interface RouteTransition {
  type: 'walk' | 'taxi'; distanceM: number; durationMin: number; careLine?: string;
  geometry?: [number, number][];
}

interface CareLine {
  rule: string; text: string; position: string;
}

@Component({
  selector: 'app-route',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent, RouteMapComponent],
  providers: [...apiProviders],
  template: `
    <div class="route">
      <!-- Back -->
      <header class="route__header">
        <button class="route__back" (click)="goBack()">
          <ld-icon name="arrow-left" [size]="18" />
        </button>
        <h1 class="route__title">{{ 'route.title' | translate }}</h1>
      </header>

      <!-- Mode switcher -->
      @if (step() === 'form' || step() === 'manual') {
        <div class="route__mode-switch">
          <button class="route__mode-btn" [class.route__mode-btn--active]="step() === 'manual'"
            (click)="step.set('manual'); loadTopPlaces()">{{ 'route.mode_manual' | translate }}</button>
          <button class="route__mode-btn" [class.route__mode-btn--active]="step() === 'form'"
            (click)="step.set('form')">{{ 'route.mode_generate' | translate }}</button>
        </div>
      }

      <!-- Step: Manual selection -->
      @if (step() === 'manual') {
        <section class="route__manual">
          <!-- Type filter -->
          <div class="route__filter-bar">
            @for (t of typeFilters; track t.value) {
              <button class="ld-chip"
                [class.ld-chip--active]="manualTypeFilter() === t.value"
                (click)="onFilterChipClick(t.value)">{{ t.labelKey | translate }}</button>
            }
          </div>

          <!-- Two-column layout (desktop) / sticky map (mobile) -->
          <div class="route__split">
            <!-- Map panel -->
            <div class="route__map-panel">
              <app-route-map [points]="manualMapPoints()" [lines]="manualMapLines()" [areas]="areas()"
                (markerTap)="togglePoint($event)" />
            </div>

            <!-- List panel -->
            <div class="route__list-panel">
              <!-- Areas accordion (shown in "Все" filter, i.e. no type filter) -->
              @if (!manualTypeFilter()) {
                @for (area of areas(); track area.id) {
                  <div class="route__area-card" [class.route__area-card--open]="selectedAreaId() === area.id">
                    <!-- Area header (tap to expand/collapse) -->
                    <div class="route__area-header" (click)="toggleArea(area)">
                      <div class="route__area-info">
                        <span class="route__area-name">{{ area.name }}</span>
                        <p class="route__area-short-desc">{{ area.description }}</p>
                        <span class="route__area-vibe">{{ translateTags(area.vibe) }}</span>
                      </div>
                      <span class="route__area-arrow" [class.route__area-arrow--open]="selectedAreaId() === area.id">›</span>
                    </div>

                    <!-- Expanded: full info + places -->
                    @if (selectedAreaId() === area.id) {
                      <div class="route__area-body">
                        <p class="route__area-desc">{{ area.description }}</p>

                        @if (areaExpanded()) {
                          @if (area.whatToExpect) {
                            <p class="route__area-field"><strong>{{ 'route.what_here' | translate }}:</strong> {{ area.whatToExpect }}</p>
                          }
                          @if (area.whenBest) {
                            <p class="route__area-field"><strong>{{ 'route.when_best' | translate }}:</strong> {{ area.whenBest }}</p>
                          }
                          @if (area.honestWarning) {
                            <p class="route__area-warn">{{ area.honestWarning }}</p>
                          }
                          @if (area.bestFor?.length) {
                            <div class="route__area-tags">
                              @for (tag of area.bestFor; track tag) {
                                <span class="route__area-tag">{{ ('tag.' + tag) | translate }}</span>
                              }
                            </div>
                          }
                        }
                        <button class="route__area-toggle" (click)="areaExpanded.set(!areaExpanded()); $event.stopPropagation()">
                          {{ areaExpanded() ? ('route.less' | translate) : ('route.more' | translate) }}
                        </button>

                        <!-- Places inside this area -->
                        @if (areaPlaces().length > 0) {
                          <div class="route__area-places">
                            @for (place of areaPlaces(); track place.id) {
                              <div class="route__place-row"
                                [class.route__place-row--selected]="isSelected(place.id)">
                                <div class="route__place-rest">
                                  <div class="route__place-icon">
                                    <ld-icon [name]="categoryIcon(place.category)" [size]="18" />
                                  </div>
                                  <div class="route__place-main">
                                    <span class="route__place-name">{{ place.name }}</span>
                                    @if (place.hook) {
                                      <p class="route__place-gist">{{ place.hook }}</p>
                                    }
                                  </div>
                                  <button class="route__place-add"
                                    [class.route__place-add--active]="isSelected(place.id)"
                                    (click)="togglePointById(place.id); $event.stopPropagation()">
                                    @if (isSelected(place.id)) {
                                      <span>{{ selectedIndex(place.id) + 1 }}</span>
                                    } @else {
                                      <span>+</span>
                                    }
                                  </button>
                                </div>
                              </div>
                            }
                          </div>
                        } @else {
                          <p class="route__area-loading">{{ 'route.loader_1' | translate }}</p>
                        }
                      </div>
                    }
                  </div>
                }
              }

              <!-- Places list (shown for category filters: scenic, food, etc.) -->
              @if (manualTypeFilter()) {
              @for (place of topPlaces(); track place.id) {
                <div class="route__place-row"
                  [class.route__place-row--selected]="isSelected(place.id)"
                  [class.route__place-row--expanded]="expandedPlaceId() === place.id"
                  (click)="toggleExpand(place.id)">
                  <!-- Rest: icon + name + hook + tags + add button -->
                  <div class="route__place-rest">
                    <div class="route__place-icon">
                      <ld-icon [name]="categoryIcon(place.category)" [size]="18" />
                    </div>
                    <div class="route__place-main">
                      <div class="route__place-header">
                        <span class="route__place-name">{{ place.name }}</span>
                        @if (place.walkTier === 'must_see') {
                          <span class="route__place-badge route__place-badge--must">must-see</span>
                        }
                      </div>
                      @if (place.hook) {
                        <p class="route__place-gist">{{ place.hook }}</p>
                      }
                      <div class="route__place-tags">
                        @for (tag of placeTags(place); track tag) {
                          <span class="route__place-tag">{{ tag }}</span>
                        }
                      </div>
                    </div>
                    <button class="route__place-add"
                      [class.route__place-add--active]="isSelected(place.id)"
                      (click)="togglePointById(place.id); $event.stopPropagation()">
                      @if (isSelected(place.id)) {
                        <span>{{ selectedIndex(place.id) + 1 }}</span>
                      } @else {
                        <span>+</span>
                      }
                    </button>
                  </div>
                  <!-- Expanded: photo + details -->
                  @if (expandedPlaceId() === place.id) {
                    <div class="route__place-detail">
                      <div class="route__place-photo-row">
                        @if (place.photoUrl) {
                          <img class="route__place-photo" [src]="place.photoUrl" alt="" loading="lazy"
                            (error)="place.photoUrl = undefined" />
                        } @else {
                          <div class="route__place-photo-placeholder">
                            <ld-icon [name]="categoryIcon(place.category)" [size]="20" />
                          </div>
                        }
                        <div class="route__place-detail-text">
                          <span class="route__place-cat">{{ place.category }}</span>
                          @if (place.rating) {
                            <span class="route__place-rating">★ {{ place.rating }}</span>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
              }
            </div>
          </div>

          <!-- Bottom bar: counter + done -->
          <div class="route__bottom-bar">
            <div class="route__manual-counter">
              {{ selectedPoints().length }} {{ 'route.places_selected' | translate }}
              @if (manualStats().totalMin > 0) {
                · ~{{ manualStats().timeStr }} · {{ manualStats().km }} {{ 'route.km' | translate }}
                @if (manualStats().taxiLegs > 0) { · 🚕 {{ manualStats().taxiLegs }} }
              }
            </div>
            @if (!showOptimizePrompt()) {
              <button class="ld-btn ld-btn--primary route__done-btn" [disabled]="selectedPoints().length === 0"
                (click)="onDone()">
                {{ 'route.done' | translate }} ({{ selectedPoints().length }})
              </button>
            }
            @if (showOptimizePrompt()) {
              <div class="route__optimize">
                @if (geo.position().source === 'gps') {
                  <p class="route__optimize-text">{{ 'route.optimize_question' | translate }}</p>
                  <div class="route__optimize-actions">
                    <button class="ld-btn ld-btn--primary" (click)="buildManualRoute(true)">{{ 'route.optimize_yes' | translate }}</button>
                    <button class="ld-btn ld-btn--ghost" (click)="buildManualRoute(false)">{{ 'route.optimize_no' | translate }}</button>
                  </div>
                } @else {
                  <p class="route__optimize-text">{{ 'route.no_gps_question' | translate }}</p>
                  <div class="route__optimize-actions">
                    <button class="ld-btn ld-btn--primary" (click)="buildManualRoute(true)">{{ 'route.enable_gps' | translate }}</button>
                    <button class="ld-btn ld-btn--ghost" (click)="buildManualRoute(false)">{{ 'route.start_first_point' | translate }}</button>
                  </div>
                }
              </div>
            }
          </div>
        </section>
      }

      <!-- Step: Form (generate mode) -->
      @if (step() === 'form') {
        <section class="route__form">
          <p class="route__form-label">{{ 'route.duration' | translate }}</p>
          <div class="route__chips">
            @for (d of durationOptions; track d.value) {
              <button class="ld-chip" [class.ld-chip--active]="selectedDuration() === d.value"
                (click)="selectedDuration.set(d.value)">{{ d.labelKey | translate }}</button>
            }
          </div>

          <p class="route__form-label">{{ 'route.mood' | translate }}</p>
          <div class="route__chips">
            @for (m of moodOptions; track m.value) {
              <button class="ld-chip" [class.ld-chip--active]="selectedMoods().includes(m.value)"
                [class.ld-chip--disabled]="isMoodDisabled()(m.value)"
                (click)="toggleMood(m.value)">
                <ld-icon [name]="m.icon" [size]="14" /> {{ m.labelKey | translate }}
              </button>
            }
          </div>

          @if (companionsVisible()) {
            <p class="route__form-label">{{ 'route.companions' | translate }}</p>
            <div class="route__chips">
              @for (c of companionOptions; track c.value) {
                <button class="ld-chip" [class.ld-chip--active]="selectedCompanions().includes(c.value)"
                  (click)="toggleCompanion(c.value)">
                  <ld-icon [name]="c.icon" [size]="14" /> {{ c.labelKey | translate }}
                </button>
              }
            </div>
          }

          <p class="route__form-label">{{ 'route.pace' | translate }}</p>
          <div class="route__chips">
            @for (p of paceOptions; track p.value) {
              <button class="ld-chip" [class.ld-chip--active]="selectedPace() === p.value"
                (click)="selectedPace.set(p.value)">{{ p.labelKey | translate }}</button>
            }
          </div>

          <button class="ld-btn ld-btn--primary route__submit" (click)="buildRoute()">
            {{ 'route.build' | translate }}
          </button>
        </section>
      }

      <!-- Step: Loading -->
      @if (step() === 'loading') {
        <section class="route__loading">
          <!-- Schematic map: sky + river + roads + animated pins + route line -->
          <div class="route__loader-scene">
            <svg class="route__loader-svg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
              <!-- Sky gradient -->
              <defs>
                <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" class="route__sky-top" />
                  <stop offset="100%" class="route__sky-bottom" />
                </linearGradient>
              </defs>
              <rect width="320" height="200" fill="url(#skyGrad)" />

              <!-- Roads (subtle) -->
              <line x1="0" y1="140" x2="320" y2="120" class="route__loader-road" />
              <line x1="60" y1="200" x2="180" y2="80" class="route__loader-road" />

              <!-- River curve -->
              <path d="M0 160 Q80 140 160 155 Q240 170 320 150" class="route__loader-river" />

              <!-- Route line (dashed, grows with pins) -->
              @if (loaderPinCount() >= 2) {
                <polyline [attr.points]="loaderLinePoints()" class="route__loader-line" />
              }

              <!-- Pins drop one by one -->
              @for (pin of loaderPins(); track pin.idx) {
                <g class="route__loader-pin" [style.animation-delay]="pin.idx * 520 + 'ms'">
                  <!-- Pin body -->
                  <circle [attr.cx]="pin.x" [attr.cy]="pin.y" r="12" class="route__loader-pin-bg" />
                  <text [attr.x]="pin.x" [attr.y]="pin.y + 4" text-anchor="middle"
                    class="route__loader-pin-num">{{ pin.idx + 1 }}</text>
                </g>
              }
            </svg>
          </div>

          <!-- Friend's voice phrase -->
          <p class="route__loader-text" [class.route__loader-text--fade]="loaderFading()">{{ loaderPhrase() | translate }}</p>
          <p class="route__loader-hint">{{ 'route.loader_hint' | translate }}</p>
        </section>
      }

      <!-- Step: Result -->
      @if (step() === 'result' && routeData()) {
        <section class="route__result">
          <!-- Header / napustvie -->
          <div class="route__napustvie">
            <p>{{ routeData()!.header }}</p>
          </div>

          <!-- Split: timeline + map -->
          <div class="route__result-split">
            <!-- Timeline (left on desktop) -->
            <div class="route__result-timeline">
          <div class="route__timeline">
            @for (point of routeData()!.points; track point.id; let i = $index) {
              <!-- Point -->
              <div class="route__point" [id]="'route-point-' + i" (click)="focusMapPoint(i)">
                <div class="route__point-time">{{ point.arriveAt }}</div>
                <div class="route__point-marker">{{ i + 1 }}</div>
                <div class="route__point-body">
                  <h3 class="route__point-name">{{ point.name }}</h3>
                  <span class="route__point-role">{{ roleLabel(point.role) }} · ~{{ point.durationMin }} {{ 'route.min' | translate }}</span>
                  @if (point.hook) {
                    <p class="route__point-hook">{{ point.hook }}</p>
                  }
                  @if (pointCare(point.role)) {
                    <p class="route__point-care">{{ pointCare(point.role) }}</p>
                  }
                  <div class="route__point-actions">
                    <button class="route__action-btn" (click)="loadAlternatives(i)">
                      <ld-icon name="arrow-left" [size]="12" /> {{ 'route.replace' | translate }}
                    </button>
                    <button class="route__action-btn route__action-btn--remove" (click)="removePoint(i)">
                      <ld-icon name="x" [size]="12" /> {{ 'route.remove' | translate }}
                    </button>
                  </div>
                  <!-- Alternatives inline -->
                  @if (alternativesForIndex() === i && alternatives().length > 0) {
                    <div class="route__alternatives">
                      <p class="route__alt-label">{{ 'route.pick_alternative' | translate }}</p>
                      @for (alt of alternatives(); track alt.id) {
                        <button class="route__alt-card" (click)="applyAlternative(i, alt)">
                          <span class="route__alt-name">{{ alt.name }}</span>
                          @if (alt.hook) { <span class="route__alt-hook">{{ alt.hook }}</span> }
                          @if (alt.transitionFromPrev) {
                            <span class="route__alt-cost">
                              {{ alt.transitionFromPrev.type === 'taxi' ? '🚕' : '🚶' }}
                              {{ alt.transitionFromPrev.durationMin }} {{ 'route.min' | translate }}
                            </span>
                          }
                        </button>
                      }
                      <button class="route__alt-cancel" (click)="alternativesForIndex.set(-1)">{{ 'route.cancel' | translate }}</button>
                    </div>
                  }
                  @if (alternativesForIndex() === i && alternatives().length === 0 && altLoading()) {
                    <div class="route__alternatives">
                      <span class="route__alt-label">{{ 'route.loader_1' | translate }}</span>
                    </div>
                  }
                </div>
              </div>
              <!-- Transition -->
              @if (i < routeData()!.transitions.length) {
                @if (routeData()!.transitions[i].type === 'walk') {
                  <div class="route__transition">
                    <ld-icon name="route" [size]="14" />
                    <span>🚶 {{ routeData()!.transitions[i].durationMin }} {{ 'route.min' | translate }}
                      @if (routeData()!.transitions[i].durationMin > 15) { · {{ 'route.no_rush' | translate }} }
                    </span>
                  </div>
                } @else {
                  <div class="route__transition route__transition--taxi">
                    <span class="route__transition-msg">{{ 'route.far_walk' | translate }}</span>
                    <div class="route__transition-btns">
                      <a class="route__transit-btn route__transit-btn--mobile" [href]="boltLink(i)" target="_blank" rel="noopener">
                        <ld-icon name="car" [size]="13" /> {{ 'route.taxi' | translate }}
                      </a>
                      <a class="route__transit-btn route__transit-btn--alt" [href]="transitLink(i)" target="_blank" rel="noopener">
                        <ld-icon name="route" [size]="13" /> {{ 'route.transit' | translate }}
                      </a>
                    </div>
                  </div>
                }
              }
            }
          </div>

          <!-- Footer care -->
          @for (care of footerCare(); track care.rule) {
            <p class="route__footer-care">{{ care.text }}</p>
          }

          <!-- Nearby places -->
          @if (nearbyPlaces().length > 0) {
            <div class="route__nearby">
              <p class="route__nearby-title">{{ 'route.nearby_title' | translate }}</p>
              @for (place of nearbyPlaces(); track place.id) {
                <div class="route__nearby-item"
                  (mouseenter)="focusNearbyOnMap(place)"
                  (mouseleave)="clearNearbyFocus()">
                  <div class="route__place-icon">
                    <ld-icon [name]="categoryIcon(place.category)" [size]="16" />
                  </div>
                  <div class="route__nearby-info">
                    <span class="route__place-name">{{ place.name }}</span>
                    @if (place.hook) { <span class="route__place-gist">{{ place.hook }}</span> }
                    <span class="route__nearby-dist">+{{ place.distanceFromRoute }} {{ 'route.meters' | translate }}</span>
                  </div>
                  <button class="route__place-add" (click)="addNearbyToRoute(place)">
                    <span>+</span>
                  </button>
                </div>
              }
            </div>
          }
            </div><!-- /route__result-timeline -->

            <!-- Map (right on desktop, top on mobile) -->
            <div class="route__result-map">
              <app-route-map [points]="mapPoints()" [lines]="mapLines()" (markerTap)="scrollToTimelinePoint($event)" #routeMap />
            </div>
          </div><!-- /route__result-split -->

          <!-- Actions -->
          <div class="route__actions">
            <button class="ld-btn ld-btn--ghost" (click)="editRoute()">{{ 'route.edit' | translate }}</button>
            <button class="ld-btn ld-btn--primary" (click)="rebuildRoute()">{{ 'route.rebuild' | translate }}</button>
          </div>
          <a class="route__maps-link" [href]="googleMapsUrl()" target="_blank" rel="noopener">
            <ld-icon name="map-pin" [size]="14" /> {{ 'route.open_maps' | translate }}
          </a>
        </section>
      }
    </div>
  `,
  styles: `
    .route { min-height: 100vh; background: var(--ld-bg); padding-bottom: 80px; }

    .route__header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px var(--ld-space-lg); position: sticky; top: 0;
      background: var(--ld-bg); z-index: 10;
    }
    .route__back { background: none; border: none; cursor: pointer; color: var(--ld-text); padding: 4px; }
    .route__title { font-size: 18px; font-weight: 700; margin: 0; }

    .route__mode-switch {
      display: flex; gap: 4px;
      background: var(--ld-surface-2); border-radius: 10px; margin: 0 var(--ld-space-lg) 8px;
      padding: 3px;
    }
    .route__mode-btn {
      flex: 1; padding: 8px; border: none; border-radius: 8px; font-size: 13px;
      font-weight: 600; cursor: pointer; font-family: inherit;
      background: transparent; color: var(--ld-text-3);
    }
    .route__mode-btn--active { background: var(--ld-surface); color: var(--ld-text); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    .route__manual { padding: 0; padding-bottom: 80px; }

    .route__filter-bar {
      display: flex; flex-wrap: wrap; gap: 4px;
      padding: 0 var(--ld-space-lg) 8px;
    }

    /* Split layout: mobile stacked, desktop side-by-side */
    .route__split {
      display: flex; flex-direction: column;
    }
    @media (min-width: 768px) {
      .route__split { flex-direction: row; gap: 12px; padding: 0 var(--ld-space-lg); }
    }

    /* Map panel */
    .route__map-panel {
      position: sticky; top: 56px; z-index: 5; background: var(--ld-bg);
      height: 180px; flex-shrink: 0;
    }
    .route__map-panel app-route-map { height: 100%; display: block; }
    @media (min-width: 768px) {
      .route__map-panel { position: static; flex: 0 0 45%; height: 400px; border-radius: 12px; overflow: hidden; }
    }

    /* List panel */
    .route__list-panel {
      padding: 8px var(--ld-space-lg);
      display: flex; flex-direction: column; gap: 4px;
    }
    @media (min-width: 768px) {
      .route__list-panel { flex: 1; max-height: 400px; overflow-y: auto; padding: 0; }
    }

    /* Section title */
    .route__section-title {
      font-size: 12px; font-weight: 700; color: var(--ld-text-3);
      text-transform: uppercase; letter-spacing: 0.5px;
      margin: 8px 0 4px; padding: 0;
    }

    /* Areas horizontal scroll */
    .route__areas-scroll {
      display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px;
      scrollbar-width: none;
    }
    .route__areas-scroll::-webkit-scrollbar { display: none; }

    .route__area-card {
      flex-shrink: 0; display: flex; flex-direction: column; gap: 2px;
      padding: 8px 12px; border: 1px solid var(--ld-border); border-radius: 10px;
      background: var(--ld-surface); cursor: pointer; text-align: left;
      font-family: inherit; min-width: 120px; transition: border-color 0.15s;
    }
    .route__area-card:hover { border-color: var(--ld-primary); }
    .route__area-card--active {
      border-color: var(--ld-primary); background: var(--ld-primary-soft);
    }
    .route__area-name { font-size: 13px; font-weight: 600; white-space: nowrap; }
    .route__area-vibe { font-size: 10px; color: var(--ld-text-3); white-space: nowrap; }

    .route__area-detail {
      padding: 8px 10px; background: var(--ld-primary-soft); border-radius: 8px;
      margin-bottom: 8px;
    }
    .route__area-desc { font-size: 12px; color: var(--ld-text); margin: 0 0 4px; line-height: 1.4; }
    .route__area-warn { font-size: 11px; color: var(--ld-text-2); margin: 0 0 6px; font-style: italic; }
    .route__area-clear {
      background: none; border: none; font-size: 12px; color: var(--ld-primary);
      cursor: pointer; padding: 0; font-family: inherit; text-decoration: underline;
    }

    /* Area accordion cards */
    .route__area-card {
      border: 1px solid var(--ld-border); border-radius: 10px;
      background: var(--ld-surface); overflow: hidden;
      transition: border-color 0.15s;
    }
    .route__area-card--open { border-color: var(--ld-primary); }
    .route__area-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; cursor: pointer;
    }
    .route__area-header:hover { background: var(--ld-primary-soft); }
    .route__area-info { display: flex; flex-direction: column; gap: 2px; }
    .route__area-name { font-size: 14px; font-weight: 600; color: var(--ld-text); }
    .route__area-short-desc {
      font-size: 12px; color: var(--ld-text-2); margin: 2px 0 4px; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .route__area-card--open .route__area-short-desc { display: none; }
    .route__area-vibe { font-size: 11px; color: var(--ld-text-3); }
    .route__area-arrow {
      font-size: 18px; color: var(--ld-text-3); transition: transform 0.2s;
      font-weight: 600;
    }
    .route__area-arrow--open { transform: rotate(90deg); color: var(--ld-primary); }
    .route__area-body {
      padding: 0 14px 12px; border-top: 1px solid var(--ld-border);
    }
    .route__area-desc {
      font-size: 12px; color: var(--ld-text); margin: 10px 0 4px; line-height: 1.5;
    }
    .route__area-expect {
      font-size: 12px; color: var(--ld-text-2); margin: 4px 0; line-height: 1.4;
    }
    .route__area-warn {
      font-size: 11px; color: var(--ld-warn, #D99A26); margin: 4px 0; font-style: italic;
    }
    .route__area-field {
      font-size: 12px; color: var(--ld-text); margin: 6px 0; line-height: 1.5;
    }
    .route__area-field strong { color: var(--ld-text-2); font-weight: 600; }
    .route__area-tags {
      display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0;
    }
    .route__area-tag {
      font-size: 10px; padding: 2px 6px; border-radius: 6px;
      background: var(--ld-surface); color: var(--ld-text-2); border: 1px solid var(--ld-border);
    }
    .route__area-toggle {
      background: none; border: none; font-size: 12px; color: var(--ld-primary);
      cursor: pointer; padding: 4px 0; font-family: inherit; text-decoration: underline;
    }
    .route__area-places { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
    .route__area-loading {
      font-size: 12px; color: var(--ld-text-3); font-style: italic; margin: 8px 0 0;
    }

    /* Place row */
    .route__place-row {
      border: 1px solid var(--ld-border); border-radius: 10px;
      background: var(--ld-surface); color: var(--ld-text); cursor: pointer;
      transition: border-color 0.15s;
    }
    .route__place-row--selected { border-color: var(--ld-primary); }
    .route__place-row--expanded { border-color: var(--ld-primary); background: var(--ld-primary-soft); }

    /* Rest state: icon + main + add button */
    .route__place-rest {
      display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px;
    }
    .route__place-icon {
      width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
      background: var(--ld-surface-2); display: flex; align-items: center;
      justify-content: center; color: var(--ld-primary);
    }
    .route__place-main { flex: 1; min-width: 0; }
    .route__place-header { display: flex; align-items: center; gap: 6px; }
    .route__place-name { font-size: 13px; font-weight: 600; min-width: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .route__place-badge {
      font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 6px;
      white-space: nowrap; flex-shrink: 0;
    }
    .route__place-badge--must { background: var(--ld-primary-soft); color: var(--ld-primary); }
    .route__place-gist {
      font-size: 12px; color: var(--ld-text-2); margin: 2px 0 0; line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .route__place-tags { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
    .route__place-tag {
      font-size: 10px; color: var(--ld-text-3); background: var(--ld-surface-2);
      padding: 1px 6px; border-radius: 6px;
    }
    .route__place-add {
      width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
      border: 1px solid var(--ld-border); background: var(--ld-surface);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; color: var(--ld-primary); cursor: pointer;
      font-family: inherit; font-weight: 600; margin-top: 3px;
    }
    .route__place-add--active {
      background: var(--ld-primary); color: #fff; border-color: var(--ld-primary);
      font-size: 12px;
    }

    /* Expanded detail */
    .route__place-detail {
      padding: 0 12px 10px 58px; display: flex; flex-direction: column; gap: 6px;
    }
    .route__place-photo-row {
      display: flex; gap: 10px; align-items: flex-start;
    }
    .route__place-photo {
      width: 54px; height: 54px; border-radius: 8px; object-fit: cover; flex-shrink: 0;
    }
    .route__place-photo-placeholder {
      width: 54px; height: 54px; border-radius: 8px; flex-shrink: 0;
      background: var(--ld-surface-2); display: flex; align-items: center;
      justify-content: center; color: var(--ld-text-3);
    }
    .route__place-detail-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .route__place-cat {
      font-size: 11px; color: var(--ld-text-3); text-transform: capitalize;
    }
    .route__place-rating {
      font-size: 11px; color: var(--ld-text-2);
    }

    /* Bottom bar */
    .route__bottom-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
      background: var(--ld-surface); border-top: 1px solid var(--ld-border);
      padding: 8px var(--ld-space-lg); display: flex; align-items: center; gap: 8px;
    }
    .route__manual-counter {
      flex: 1; font-size: 12px; color: var(--ld-text-2);
    }
    .route__done-btn { flex-shrink: 0; min-height: 38px; font-size: 14px; }

    .route__optimize {
      padding: 12px var(--ld-space-lg); background: var(--ld-primary-soft);
      border-radius: 12px; margin: 0 var(--ld-space-lg) 12px; max-width: 500px;
    }
    .route__optimize-text { font-size: 14px; margin: 0 0 10px; color: var(--ld-text); line-height: 1.4; }
    .route__optimize-actions { display: flex; gap: 8px; }
    .route__optimize-actions .ld-btn { flex: 1; }

    .route__form { padding: 0 var(--ld-space-lg); }
    .route__form-label { font-size: 13px; color: var(--ld-text-2); margin: 16px 0 8px; font-weight: 600; }
    .route__chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .route__submit { width: 100%; margin-top: 24px; min-height: 48px; font-size: 16px; }

    .route__loading { text-align: center; padding: 24px var(--ld-space-lg) 40px; }
    .route__loader-scene {
      width: 100%; max-width: 360px; margin: 0 auto 20px;
      border-radius: 16px; overflow: hidden;
      box-shadow: var(--ld-shadow-card);
    }
    .route__loader-svg { display: block; width: 100%; height: auto; }

    /* Sky gradient uses theme colors */
    .route__sky-top { stop-color: var(--ld-primary-soft); }
    .route__sky-bottom { stop-color: var(--ld-surface-2); }

    .route__loader-road {
      stroke: var(--ld-border); stroke-width: 2; stroke-dasharray: 6 4; opacity: 0.5;
    }
    .route__loader-river {
      fill: none; stroke: var(--ld-secondary, #6FA07C); stroke-width: 3;
      opacity: 0.4; stroke-linecap: round;
    }
    .route__loader-line {
      fill: none; stroke: var(--ld-primary); stroke-width: 2.5;
      stroke-dasharray: 6 4; stroke-linecap: round; opacity: 0.8;
    }

    /* Pin group — pinDrop animation */
    .route__loader-pin {
      opacity: 0; animation: pinDrop 0.4s cubic-bezier(.34,1.5,.5,1) forwards;
      transform-origin: center center;
    }
    .route__loader-pin-bg { fill: var(--ld-primary); }
    .route__loader-pin-num {
      fill: var(--ld-on-primary, #fff); font-size: 11px; font-weight: 700;
      font-family: 'Manrope', sans-serif;
    }

    @keyframes pinDrop {
      0%   { opacity: 0; transform: translateY(-16px) scale(0.5); }
      60%  { opacity: 1; transform: translateY(2px) scale(1.1); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .route__loader-text {
      font-size: 15px; color: var(--ld-text); font-style: italic;
      margin: 0 0 6px; min-height: 22px;
      transition: opacity 0.3s ease;
    }
    .route__loader-text--fade { opacity: 0; }
    .route__loader-hint {
      font-size: 12px; color: var(--ld-text-3); margin: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .route__loader-pin { animation: none !important; opacity: 1; }
      .route__loader-text { transition: none; }
    }

    .route__result { padding: 0 var(--ld-space-lg); }

    /* Result split: mobile stacked, desktop side-by-side */
    .route__result-split {
      display: flex; flex-direction: column-reverse;
    }
    @media (min-width: 900px) {
      .route__result-split { flex-direction: row; gap: 16px; }
    }

    .route__result-timeline { flex: 1; min-width: 0; }

    .route__result-map {
      height: 220px; border-radius: 12px; overflow: hidden; margin-bottom: 12px;
    }
    @media (min-width: 900px) {
      .route__result-map {
        flex: 0 0 45%; height: 400px; position: sticky; top: 56px;
        align-self: flex-start; margin-bottom: 0;
      }
    }
    .route__napustvie {
      background: var(--ld-primary-soft); border-radius: 12px; padding: 14px 16px;
      font-size: 14px; color: var(--ld-text); line-height: 1.5; margin-bottom: 20px;
    }

    .route__timeline { position: relative; padding-left: 40px; }
    .route__point { display: flex; gap: 12px; margin-bottom: 4px; position: relative; }
    /* Dashed line running through points (behind marker) */
    .route__point::before {
      content: ''; position: absolute;
      left: 13px; top: 0; bottom: 0;
      border-left: 2px dashed var(--ld-border);
    }
    /* Hide line above first point */
    .route__point:first-child::before { top: 14px; }
    /* Hide line below last point (when no transition follows) */
    .route__point:last-child::before { bottom: calc(100% - 14px); }
    .route__point-time {
      position: absolute; left: -40px; top: 2px;
      font-size: 12px; font-weight: 600; color: var(--ld-text-2); width: 36px; text-align: right;
    }
    .route__point-marker {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: var(--ld-primary); color: var(--ld-bg);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
      position: relative; z-index: 1;
    }
    .route__point-body { flex: 1; min-width: 0; }
    .route__point-name { font-size: 15px; font-weight: 600; margin: 0 0 2px; }
    .route__point-role { font-size: 11px; color: var(--ld-text-3); }
    .route__point-hook { font-size: 12px; color: var(--ld-text-2); font-style: italic; margin: 4px 0 0; }
    .route__point-care { font-size: 12px; color: var(--ld-primary); margin: 4px 0 0; }

    .route__transition {
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
      padding: 8px 0 8px 40px; font-size: 12px; color: var(--ld-text-3);
      border-left: 2px dashed var(--ld-border); margin-left: 13px;
    }
    .route__transition--taxi {
      flex-direction: column; align-items: flex-start; gap: 6px;
    }
    .route__transition-msg {
      font-size: 12px; color: var(--ld-text-2); font-style: italic;
    }
    .route__transition-btns {
      display: flex; gap: 6px;
    }
    .route__transit-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 10px; border-radius: 8px; font-size: 12px; font-weight: 600;
      text-decoration: none; font-family: inherit;
      background: var(--ld-text); color: var(--ld-bg);
    }
    .route__transit-btn--alt {
      background: var(--ld-surface); color: var(--ld-text);
      border: 1px solid var(--ld-border);
    }
    @media (min-width: 900px) {
      .route__transit-btn--mobile { display: none; }
    }

    .route__nearby {
      margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--ld-border);
    }
    .route__nearby-title {
      font-size: 14px; font-weight: 700; color: var(--ld-text); margin: 0 0 8px;
    }
    .route__nearby-item {
      display: flex; gap: 10px; align-items: flex-start; padding: 8px 0;
      border-bottom: 1px solid var(--ld-border);
    }
    .route__nearby-item:last-child { border-bottom: none; }
    .route__nearby-info { flex: 1; min-width: 0; }
    .route__nearby-dist {
      font-size: 10px; color: var(--ld-text-3); margin-top: 2px; display: block;
    }

    .route__footer-care {
      font-size: 13px; color: var(--ld-primary); font-style: italic;
      text-align: center; margin: 16px 0 0;
    }

    .route__point-actions {
      display: flex; gap: 8px; margin-top: 6px;
    }
    .route__action-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: none; border: 1px solid var(--ld-border); border-radius: 6px;
      font-size: 11px; color: var(--ld-text-3); cursor: pointer;
      padding: 3px 8px; font-family: inherit;
    }
    .route__action-btn:hover { border-color: var(--ld-primary); color: var(--ld-primary); }
    .route__action-btn--remove:hover { border-color: #e74c3c; color: #e74c3c; }

    .route__actions {
      display: flex; gap: 8px; margin-top: 24px;
    }
    .route__actions .ld-btn { flex: 1; }

    .route__alternatives {
      margin-top: 8px; padding: 8px; background: var(--ld-surface-2); border-radius: 10px;
    }
    .route__alt-label { font-size: 12px; color: var(--ld-text-3); font-style: italic; margin: 0 0 6px; }
    .route__alt-card {
      display: flex; flex-direction: column; gap: 2px; width: 100%;
      background: var(--ld-surface); border: 1px solid var(--ld-border); border-radius: 8px;
      padding: 8px 10px; margin-bottom: 6px; cursor: pointer; text-align: left;
      font-family: inherit; transition: border-color 0.15s;
    }
    .route__alt-card:hover { border-color: var(--ld-primary); }
    .route__alt-name { font-size: 13px; font-weight: 600; }
    .route__alt-hook { font-size: 11px; color: var(--ld-text-2); font-style: italic; }
    .route__alt-cost { font-size: 11px; color: var(--ld-text-3); }
    .route__alt-cancel {
      background: none; border: none; font-size: 12px; color: var(--ld-text-3);
      cursor: pointer; padding: 4px 0; font-family: inherit;
    }

    .route__maps-link {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 12px; padding: 10px;
      font-size: 13px; color: var(--ld-primary); text-decoration: none;
      border: 1px solid var(--ld-primary); border-radius: 10px;
    }
  `,
})
export class RouteComponent implements OnInit {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  readonly geo = inject(GeolocationService);
  private profile = inject(ProfileStore);
  private router = inject(Router);
  private translate = inject(TranslateService);

  private routeMap = viewChild<RouteMapComponent>('routeMap');

  ngOnInit() {
    this.startLoader();
    const initStart = Date.now();
    let placesReady = false;
    let areasReady = false;

    const checkReady = () => {
      if (!placesReady || !areasReady) return;
      const elapsed = Date.now() - initStart;
      const delay = Math.max(4000 - elapsed, 0);
      setTimeout(() => {
        this.stopLoader();
        this.step.set('manual');
      }, delay);
    };

    const pos = this.geo.position();
    const locale = this.profile.locale();
    this.http.get<any[]>(`/v1/routes/top-places?lat=${pos.lat}&lng=${pos.lng}&locale=${locale}`).subscribe({
      next: (places) => { this.topPlaces.set(places); placesReady = true; checkReady(); },
      error: () => { placesReady = true; checkReady(); },
    });
    this.http.get<any[]>(`/v1/routes/areas?locale=${locale}`).subscribe({
      next: (areas) => { this.areas.set(areas); areasReady = true; checkReady(); },
      error: () => { areasReady = true; checkReady(); },
    });
  }

  step = signal<'form' | 'loading' | 'result' | 'manual'>('loading');
  showOptimizePrompt = signal(false);
  routeData = signal<any>(null);
  routeSource = signal<'manual' | 'generate'>('manual');
  alternatives = signal<any[]>([]);
  alternativesForIndex = signal(-1);
  altLoading = signal(false);
  nearbyPlaces = signal<any[]>([]);

  // Manual mode
  topPlaces = signal<any[]>([]);
  areas = signal<any[]>([]);
  selectedPointIds = signal<string[]>([]);
  manualTypeFilter = signal<string | null>(null);
  expandedPlaceId = signal<string | null>(null);
  selectedAreaId = signal<string | null>(null);
  areaExpanded = signal(false);

  areaPlaces = signal<any[]>([]);

  selectedAreaDetail = computed(() => {
    const id = this.selectedAreaId();
    return id ? this.areas().find(a => a.id === id) ?? null : null;
  });

  typeFilters = [
    { value: null, labelKey: 'route.filter_all' },
    { value: 'scenic', labelKey: 'route.mood_scenic' },
    { value: 'food', labelKey: 'route.mood_food' },
    { value: 'culture', labelKey: 'route.mood_culture' },
    { value: 'spa', labelKey: 'route.mood_spa' },
    { value: 'coffee', labelKey: 'route.mood_coffee' },
  ];

  selectedPoints = computed(() => {
    const ids = this.selectedPointIds();
    return this.topPlaces().filter(p => ids.includes(p.id));
  });

  manualMapPoints = computed<MapPoint[]>(() => {
    // Only selected points as numbered markers on map
    // Unselected shown in list only (map would be cluttered with 60 markers)
    const selected = this.selectedPoints();
    return selected.map((p, i) => ({
      id: p.id, name: p.name, lat: p.lat, lng: p.lng, index: i,
    }));
  });

  manualMapLines = computed<MapLine[]>(() => {
    const pts = this.selectedPoints();
    if (pts.length < 2) return [];
    const lines: MapLine[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const distM = this.haversine(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
      const walkMin = Math.round((distM / 80) * 1.3);
      lines.push({
        from: [pts[i].lng, pts[i].lat],
        to: [pts[i + 1].lng, pts[i + 1].lat],
        type: distM > 920 ? 'taxi' : 'walk',
        durationMin: distM > 920 ? Math.max(5, Math.round(distM / 500)) : walkMin,
      });
    }
    return lines;
  });

  manualStats = computed(() => {
    const lines = this.manualMapLines();
    const pts = this.selectedPoints();
    const totalMin = pts.reduce((s, p) => s + (p.durationMin || 30), 0) +
      lines.reduce((s, l) => s + (l.durationMin || 0), 0);
    const walkM = lines.filter(l => l.type === 'walk').reduce((s, l) => s + ((l.durationMin ?? 0) * 80 / 1.3), 0);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return {
      totalMin,
      timeStr: hours > 0 ? `${hours} ч ${mins > 0 ? mins + ' мин' : ''}` : `${mins} мин`,
      km: (walkM / 1000).toFixed(1),
      taxiLegs: lines.filter(l => l.type === 'taxi').length,
    };
  });

  selectedDuration = signal('2-3h');
  selectedMoods = signal<string[]>(['scenic', 'food']);
  selectedPace = signal('relaxed');
  selectedCompanions = signal<string[]>([]);

  durationOptions = [
    { value: '1h', labelKey: 'route.dur_hour' },
    { value: '2-3h', labelKey: 'route.dur_short' },
    { value: 'half-day', labelKey: 'route.dur_half' },
    { value: 'full-day', labelKey: 'route.dur_full' },
  ];

  moodOptions = [
    { value: 'scenic', labelKey: 'route.mood_scenic', icon: 'sun' },
    { value: 'food', labelKey: 'route.mood_food', icon: 'tools-kitchen-2' },
    { value: 'culture', labelKey: 'route.mood_culture', icon: 'masks-theater' },
    { value: 'nature', labelKey: 'route.mood_nature', icon: 'trees' },
    { value: 'coffee', labelKey: 'route.mood_coffee', icon: 'coffee' },
    { value: 'nightlife', labelKey: 'route.mood_nightlife', icon: 'glass-cocktail' },
  ];

  companionOptions = [
    { value: 'kids', labelKey: 'route.companion_kids', icon: 'users' },
    { value: 'dog', labelKey: 'route.companion_dog', icon: 'dog' },
  ];

  paceOptions = [
    { value: 'relaxed', labelKey: 'route.pace_relaxed' },
    { value: 'intense', labelKey: 'route.pace_intense' },
  ];

  // Compatibility: nightlife excludes companions; dog excludes culture
  isNightlife = computed(() => this.selectedMoods().includes('nightlife'));
  companionsVisible = computed(() => !this.isNightlife());
  isMoodDisabled = computed(() => {
    const companions = this.selectedCompanions();
    return (mood: string) => {
      if (mood === 'nightlife' && companions.length > 0) return true;
      if (mood === 'culture' && companions.includes('dog')) return true;
      return false;
    };
  });

  private loaderPhrases = [
    'route.loader_1', 'route.loader_2', 'route.loader_3', 'route.loader_4',
  ];
  private loaderIdx = 0;
  private loaderStartTime = 0;
  private loaderPhraseInterval: ReturnType<typeof setInterval> | null = null;
  private loaderPinInterval: ReturnType<typeof setInterval> | null = null;
  private loaderMinTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingResult: { data: any; source: 'generate' | 'link' } | null = null;

  loaderPhrase = signal(this.loaderPhrases[0]);
  loaderFading = signal(false);
  loaderPinCount = signal(0);

  // Schematic pin positions on the SVG (decorative, not real coords)
  private readonly pinPositions = [
    { x: 70, y: 135 }, { x: 145, y: 95 }, { x: 220, y: 120 }, { x: 275, y: 85 },
  ];

  loaderPins = computed(() => {
    const count = this.loaderPinCount();
    return this.pinPositions.slice(0, count).map((p, i) => ({ ...p, idx: i }));
  });

  loaderLinePoints = computed(() => {
    const pins = this.loaderPins();
    return pins.map(p => `${p.x},${p.y}`).join(' ');
  });

  mapPoints = computed<MapPoint[]>(() => {
    const data = this.routeData();
    if (!data?.points) return [];
    return data.points.map((p: RoutePoint, i: number) => ({
      id: p.id, name: p.name, lat: p.lat, lng: p.lng, index: i,
    }));
  });

  mapLines = computed<MapLine[]>(() => {
    const data = this.routeData();
    if (!data?.points || !data?.transitions) return [];
    const lines: MapLine[] = [];
    for (let i = 0; i < data.transitions.length; i++) {
      const from = data.points[i];
      const to = data.points[i + 1];
      if (from && to) {
        lines.push({
          from: [from.lng, from.lat],
          to: [to.lng, to.lat],
          type: data.transitions[i].type,
          durationMin: data.transitions[i].durationMin,
          geometry: data.transitions[i].geometry,
        });
      }
    }
    return lines;
  });

  footerCare = computed(() => {
    const data = this.routeData();
    return data?.careLines?.filter((c: CareLine) => c.position === 'footer') ?? [];
  });

  toggleMood(mood: string) {
    if (this.isMoodDisabled()(mood)) return;
    const current = this.selectedMoods();
    if (current.includes(mood)) {
      this.selectedMoods.set(current.filter(m => m !== mood));
    } else {
      this.selectedMoods.set([...current, mood]);
      // Nightlife selected → clear companions
      if (mood === 'nightlife') {
        this.selectedCompanions.set([]);
      }
    }
  }

  toggleCompanion(companion: string) {
    const current = this.selectedCompanions();
    if (current.includes(companion)) {
      this.selectedCompanions.set(current.filter(c => c !== companion));
    } else {
      this.selectedCompanions.set([...current, companion]);
      // Companion selected → remove nightlife from moods
      this.selectedMoods.update(moods => moods.filter(m => m !== 'nightlife'));
      // Dog selected → remove culture
      if (companion === 'dog') {
        this.selectedMoods.update(moods => moods.filter(m => m !== 'culture'));
      }
    }
  }

  private startLoader() {
    this.step.set('loading');
    this.loaderStartTime = Date.now();
    this.loaderIdx = 0;
    this.loaderPinCount.set(0);
    this.loaderFading.set(false);
    this.pendingResult = null;
    this.loaderPhrase.set(this.loaderPhrases[0]);

    // Pins drop one by one every 520ms
    let pinIdx = 0;
    this.loaderPinInterval = setInterval(() => {
      pinIdx++;
      if (pinIdx <= this.pinPositions.length) {
        this.loaderPinCount.set(pinIdx);
      } else {
        // Cycle: reset and replay
        pinIdx = 0;
        this.loaderPinCount.set(0);
      }
    }, 520);

    // Phrases cycle every 1s with fade (4 phrases in ~4s)
    this.loaderPhraseInterval = setInterval(() => {
      this.loaderFading.set(true);
      setTimeout(() => {
        this.loaderIdx = (this.loaderIdx + 1) % this.loaderPhrases.length;
        this.loaderPhrase.set(this.loaderPhrases[this.loaderIdx]);
        this.loaderFading.set(false);
      }, 200);
    }, 1000);
  }

  private stopLoader() {
    if (this.loaderPhraseInterval) { clearInterval(this.loaderPhraseInterval); this.loaderPhraseInterval = null; }
    if (this.loaderPinInterval) { clearInterval(this.loaderPinInterval); this.loaderPinInterval = null; }
    if (this.loaderMinTimer) { clearTimeout(this.loaderMinTimer); this.loaderMinTimer = null; }
  }

  private showResult(data: any, fallbackStep: 'form' | 'manual') {
    const elapsed = Date.now() - this.loaderStartTime;
    const MIN_DISPLAY = 2000;
    const SKIP_THRESHOLD = 400;

    // Very fast (<400ms) — skip loader entirely
    if (elapsed < SKIP_THRESHOLD && this.step() === 'loading') {
      this.stopLoader();
      this.routeData.set(data);
      this.step.set('result');
      this.loadNearby(data);
      return;
    }

    // If min display time not reached — wait
    if (elapsed < MIN_DISPLAY) {
      this.pendingResult = { data, source: fallbackStep === 'form' ? 'generate' : 'link' };
      this.loaderMinTimer = setTimeout(() => {
        this.stopLoader();
        if (this.pendingResult) {
          this.routeData.set(this.pendingResult.data);
          this.step.set('result');
          this.loadNearby(this.pendingResult.data);
          this.pendingResult = null;
        }
      }, MIN_DISPLAY - elapsed);
      return;
    }

    this.stopLoader();
    this.routeData.set(data);
    this.step.set('result');
    this.loadNearby(data);
  }

  rebuildRoute() {
    if (this.routeSource() === 'manual') {
      // Sync points from current result (includes nearby additions), then re-link
      const data = this.routeData();
      if (data?.points?.length) {
        this.selectedPointIds.set(data.points.map((p: any) => p.id));
      }
      this.buildManualRoute(false);
    } else {
      this.buildRoute();
    }
  }

  editRoute() {
    if (this.routeSource() === 'manual') {
      // Sync selectedPointIds from current routeData (includes nearby additions)
      const data = this.routeData();
      if (data?.points?.length) {
        this.selectedPointIds.set(data.points.map((p: any) => p.id));
      }
      this.step.set('manual');
    } else {
      this.step.set('form');
    }
  }

  buildRoute() {
    this.routeSource.set('generate');
    this.startLoader();

    const pos = this.geo.position();
    this.api.generateRoute({
      lat: pos.lat,
      lng: pos.lng,
      duration: this.selectedDuration(),
      moods: this.selectedMoods(),
      pace: this.selectedPace(),
      companions: this.selectedCompanions(),
      locale: this.profile.locale(),
    }).subscribe({
      next: (data) => this.showResult(data, 'form'),
      error: () => { this.stopLoader(); this.step.set('form'); },
    });
  }

  roleLabel(role: string): string {
    const key = `route.role_${role}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : role;
  }

  pointCare(role: string): string | null {
    const data = this.routeData();
    if (!data) return null;
    const care = data.careLines?.find((c: CareLine) => c.position === 'point' && c.rule === 'C5' && role === 'food_break');
    return care?.text ?? null;
  }

  removePoint(index: number) {
    const data = this.routeData();
    if (!data || data.points.length <= 2) return; // keep at least 2 points
    const points = [...data.points];
    const transitions = [...data.transitions];
    points.splice(index, 1);
    // Remove transition: if removing middle point, merge transitions
    if (index < transitions.length) transitions.splice(index, 1);
    else if (transitions.length > 0) transitions.splice(transitions.length - 1, 1);
    // Recalculate totals
    const totalMin = points.reduce((s: number, p: RoutePoint) => s + p.durationMin, 0) +
      transitions.reduce((s: number, t: RouteTransition) => s + t.durationMin, 0);
    this.routeData.set({
      ...data,
      points,
      transitions,
      totalMinutes: totalMin,
    });
  }

  loadAlternatives(index: number) {
    const data = this.routeData();
    if (!data) return;
    const point = data.points[index];
    const prev = index > 0 ? data.points[index - 1] : null;
    const next = index < data.points.length - 1 ? data.points[index + 1] : null;

    this.alternativesForIndex.set(index);
    this.alternatives.set([]);
    this.altLoading.set(true);

    this.api.getRouteAlternatives({
      lat: point.lat, lng: point.lng, role: point.role,
      excludeIds: data.points.map((p: RoutePoint) => p.id),
      prevLat: prev?.lat, prevLng: prev?.lng,
      nextLat: next?.lat, nextLng: next?.lng,
      moods: this.selectedMoods(),
    }).subscribe({
      next: (alts: any[]) => {
        this.alternatives.set(alts);
        this.altLoading.set(false);
      },
      error: () => {
        this.altLoading.set(false);
      },
    });
  }

  applyAlternative(index: number, alt: any) {
    const data = this.routeData();
    if (!data) return;
    const points = [...data.points];
    points[index] = {
      ...points[index],
      id: alt.id, name: alt.name, category: alt.category,
      lat: alt.lat, lng: alt.lng, hook: alt.hook, photoUrl: alt.photoUrl,
    };
    // Recalculate transitions around replaced point
    const transitions = [...data.transitions];
    if (alt.transitionFromPrev && index > 0) {
      transitions[index - 1] = { ...transitions[index - 1], ...alt.transitionFromPrev, distanceM: 0 };
    }
    if (alt.transitionToNext && index < transitions.length) {
      transitions[index] = { ...transitions[index], ...alt.transitionToNext, distanceM: 0 };
    }
    this.routeData.set({ ...data, points, transitions });
    this.alternativesForIndex.set(-1);
    this.alternatives.set([]);
  }

  focusNearbyOnMap(place: any) {
    this.routeMap()?.showNearbyDot(place.lat, place.lng);
  }

  clearNearbyFocus() {
    this.routeMap()?.hideNearbyDot();
  }

  addNearbyToRoute(place: any) {
    const data = this.routeData();
    if (!data?.points?.length) return;

    // Find closest route point to this nearby place
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < data.points.length; i++) {
      const d = this.haversine(place.lat, place.lng, data.points[i].lat, data.points[i].lng);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    }

    // Insert after closest point
    const insertIdx = closestIdx + 1;
    const newPoint: RoutePoint = {
      id: place.id,
      name: place.name,
      category: place.category,
      lat: place.lat,
      lng: place.lng,
      hook: place.hook,
      role: 'passage',
      durationMin: 20,
      arriveAt: '',
      photoUrl: place.photoUrl,
    };

    const points = [...data.points];
    points.splice(insertIdx, 0, newPoint);

    // Recompute transitions for affected segments
    const transitions = [...data.transitions];
    // Remove old transition at insertIdx-1 (if exists)
    if (insertIdx - 1 >= 0 && insertIdx - 1 < transitions.length) {
      transitions.splice(insertIdx - 1, 1);
    }
    // Add two new transitions: before → new, new → after
    const prev = points[insertIdx - 1];
    const next = points[insertIdx + 1];
    const distPrev = this.haversine(prev.lat, prev.lng, newPoint.lat, newPoint.lng);
    const distNext = next ? this.haversine(newPoint.lat, newPoint.lng, next.lat, next.lng) : 0;

    const mkTransition = (distM: number): RouteTransition => {
      const walkMin = Math.round((distM / 80) * 1.3);
      return distM > 920
        ? { type: 'taxi', distanceM: Math.round(distM), durationMin: Math.max(5, Math.round(distM / 500)) }
        : { type: 'walk', distanceM: Math.round(distM), durationMin: walkMin };
    };

    transitions.splice(insertIdx - 1, 0, mkTransition(distPrev));
    if (next) transitions.splice(insertIdx, 0, mkTransition(distNext));

    this.routeData.set({ ...data, points, transitions });

    // Remove from nearby list
    this.nearbyPlaces.set(this.nearbyPlaces().filter(p => p.id !== place.id));
  }

  private loadNearby(data: any) {
    if (!data?.points?.length) return;
    this.http.post<any[]>('/v1/routes/nearby', {
      points: data.points.map((p: any) => ({ lat: p.lat, lng: p.lng })),
      excludeIds: data.points.map((p: any) => p.id),
      locale: this.profile.locale(),
    }).subscribe({
      next: (places) => this.nearbyPlaces.set(places),
      error: () => {},
    });
  }

  boltLink(transitionIndex: number): string {
    const data = this.routeData();
    if (!data?.points) return '#';
    const from = data.points[transitionIndex];
    const to = data.points[transitionIndex + 1];
    if (!from || !to) return '#';
    return `https://m.bolt.eu/en/ride/?pickup_lat=${from.lat}&pickup_lng=${from.lng}&dropoff_lat=${to.lat}&dropoff_lng=${to.lng}`;
  }

  transitLink(transitionIndex: number): string {
    const data = this.routeData();
    if (!data?.points) return '#';
    const from = data.points[transitionIndex];
    const to = data.points[transitionIndex + 1];
    if (!from || !to) return '#';
    return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=transit`;
  }

  googleMapsUrl(): string {
    const data = this.routeData();
    if (!data?.points?.length) return '#';
    const pts = data.points;
    const origin = `${pts[0].lat},${pts[0].lng}`;
    const dest = `${pts[pts.length - 1].lat},${pts[pts.length - 1].lng}`;
    const waypoints = pts.slice(1, -1).map((p: RoutePoint) => `${p.lat},${p.lng}`).join('|');
    const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=walking`;
    return waypoints ? `${base}&waypoints=${waypoints}` : base;
  }

  scrollToTimelinePoint(index: number) {
    const el = document.getElementById(`route-point-${index}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  focusMapPoint(index: number) {
    this.routeMap()?.scrollToPoint(index);
  }

  // Areas
  private loadAreas() {
    const locale = this.profile.locale();
    this.http.get<any[]>(`/v1/routes/areas?locale=${locale}`).subscribe({
      next: (areas) => this.areas.set(areas),
    });
  }

  toggleArea(area: any) {
    // Collapse if already open
    if (this.selectedAreaId() === area.id) {
      this.selectedAreaId.set(null);
      this.areaPlaces.set([]);
      return;
    }

    this.selectedAreaId.set(area.id);
    this.areaPlaces.set([]);

    // Load places inside this area's bbox
    const bbox = area.bbox;
    if (bbox) {
      const pos = this.geo.position();
      const locale = this.profile.locale();
      this.http.get<any[]>(`/v1/routes/top-places?lat=${pos.lat}&lng=${pos.lng}&locale=${locale}`).subscribe({
        next: (all) => {
          const filtered = all.filter((p: any) =>
            p.lat >= bbox.minLat && p.lat <= bbox.maxLat &&
            p.lng >= bbox.minLng && p.lng <= bbox.maxLng
          );
          this.areaPlaces.set(filtered);
        },
      });
      this.routeMap()?.flyToArea(bbox);
    }
  }

  clearArea() {
    this.selectedAreaId.set(null);
    this.manualTypeFilter.set(null);
    this.topPlaces.set([]);
    this.loadTopPlaces();
  }

  // Manual mode methods
  loadTopPlaces() {
    if (this.topPlaces().length > 0) return;
    this.fetchTopPlaces(this.manualTypeFilter());
  }

  onFilterChipClick(type: string | null) {
    this.selectedAreaId.set(null);
    this.areaPlaces.set([]);
    this.manualTypeFilter.set(type);
    this.topPlaces.set([]);
    this.fetchTopPlaces(type);
  }

  private fetchTopPlaces(type: string | null) {
    const pos = this.geo.position();
    const locale = this.profile.locale();
    const params = `lat=${pos.lat}&lng=${pos.lng}&locale=${locale}${type ? '&type=' + type : ''}`;
    this.http.get<any[]>(`/v1/routes/top-places?${params}`).subscribe({
      next: (places) => this.topPlaces.set(places),
      error: () => {},
    });
  }

  togglePoint(mapIndex: number) {
    // Markers on map are selected points only — tap removes
    const selected = this.selectedPoints();
    if (selected[mapIndex]) this.togglePointById(selected[mapIndex].id);
  }

  togglePointById(id: string) {
    const current = this.selectedPointIds();
    if (current.includes(id)) {
      this.selectedPointIds.set(current.filter(x => x !== id));
    } else {
      this.selectedPointIds.set([...current, id]);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedPointIds().includes(id);
  }

  selectedIndex(id: string): number {
    return this.selectedPointIds().indexOf(id);
  }

  toggleExpand(id: string) {
    this.expandedPlaceId.set(this.expandedPlaceId() === id ? null : id);
  }

  placeTags(place: any): string[] {
    const tags: string[] = [];
    const catLabels: Record<string, string> = {
      viewpoint: 'с видом', park: 'зелень', restaurant: 'еда', cafe: 'кофе',
      bar: 'бар', museum: 'музей', gallery: 'искусство', theater: 'театр',
      bath: 'бани', bakery: 'выпечка', garden: 'сад', church: 'храм',
    };
    if (catLabels[place.category]) tags.push(catLabels[place.category]);
    const momentLabels: Record<string, string> = {
      anchor: 'якорь', photo_spot: 'фото', rest_stop: 'отдых',
      food_break: 'перекус', passage: 'по пути',
    };
    if (place.routeMoment && momentLabels[place.routeMoment]) tags.push(momentLabels[place.routeMoment]);
    if (place.durationMin && place.durationMin <= 20) tags.push('быстро');
    return tags.slice(0, 3);
  }

  translateTags(tags: string[] | undefined): string {
    if (!tags?.length) return '';
    return tags.map(t => this.translate.instant('tag.' + t)).join(' · ');
  }

  categoryIcon(category: string): string {
    const map: Record<string, string> = {
      restaurant: 'tools-kitchen-2', cafe: 'coffee', bakery: 'coffee',
      bar: 'glass-cocktail', club: 'music', viewpoint: 'sun',
      park: 'trees', museum: 'masks-theater', gallery: 'masks-theater',
      theater: 'masks-theater', bath: 'coffee', garden: 'trees',
    };
    return map[category] ?? 'map-pin';
  }

  onDone() {
    if (this.selectedPoints().length === 0) return;
    // Always show optimize prompt
    this.showOptimizePrompt.set(true);
  }

  async buildManualRoute(optimizeFromGps: boolean) {
    this.showOptimizePrompt.set(false);
    if (this.selectedPoints().length === 0) return;

    // If user wants GPS optimization but GPS not yet acquired — request it first
    if (optimizeFromGps && this.geo.position().source !== 'gps') {
      await this.geo.requestPosition();
    }

    this.routeSource.set('manual');
    this.startLoader();
    const pos = this.geo.position();
    const firstPoint = this.selectedPoints()[0];
    const startLat = optimizeFromGps && pos.source === 'gps' ? pos.lat : firstPoint.lat;
    const startLng = optimizeFromGps && pos.source === 'gps' ? pos.lng : firstPoint.lng;

    this.http.post<any>('/v1/routes/link', {
      pointIds: this.selectedPointIds(),
      startLat,
      startLng,
      locale: this.profile.locale(),
    }).subscribe({
      next: (data) => this.showResult(data, 'manual'),
      error: () => { this.stopLoader(); this.step.set('manual'); },
    });
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  goBack() {
    this.router.navigate(['/discover']);
  }
}
