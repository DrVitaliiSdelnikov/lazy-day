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
                [class.ld-chip--active]="t.value === 'areas' ? (manualTypeFilter() === 'areas' || selectedAreaId()) : manualTypeFilter() === t.value"
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
              <!-- Area filter active: show info + clear -->
              @if (selectedAreaDetail()) {
                <div class="route__area-detail">
                  <p class="route__area-desc-title">{{ selectedAreaDetail()!.name }}</p>
                  <p class="route__area-desc">{{ selectedAreaDetail()!.description }}</p>
                  <div class="route__area-tags">
                    @for (tag of selectedAreaDetail()!.vibe ?? []; track tag) {
                      <span class="route__area-tag">{{ tag }}</span>
                    }
                  </div>
                  @if (areaExpanded()) {
                    @if (selectedAreaDetail()!.fullDescription) {
                      <p class="route__area-full">{{ selectedAreaDetail()!.fullDescription }}</p>
                    }
                    @if (selectedAreaDetail()!.whatToExpect) {
                      <p class="route__area-full"><strong>{{ 'route.what_here' | translate }}:</strong> {{ selectedAreaDetail()!.whatToExpect }}</p>
                    }
                    @if (selectedAreaDetail()!.whoFor) {
                      <p class="route__area-full"><strong>{{ 'route.who_for' | translate }}:</strong> {{ selectedAreaDetail()!.whoFor }}</p>
                    }
                    @if (selectedAreaDetail()!.practice) {
                      <p class="route__area-full">🚶 {{ selectedAreaDetail()!.practice }}</p>
                    }
                    @if (selectedAreaDetail()!.honestWarning) {
                      <p class="route__area-warn">⚠ {{ selectedAreaDetail()!.honestWarning }}</p>
                    }
                  }
                  <div class="route__area-actions">
                    <button class="route__area-clear" (click)="areaExpanded.set(!areaExpanded())">
                      {{ areaExpanded() ? ('route.less' | translate) : ('route.more' | translate) }}
                    </button>
                    <button class="route__area-clear" (click)="onFilterChipClick('areas')">{{ 'route.change_area' | translate }}</button>
                    <button class="route__area-clear" (click)="clearArea()">{{ 'route.show_all' | translate }}</button>
                  </div>
                </div>
              }

              <!-- Areas list (when "Районы" chip selected) -->
              @if (manualTypeFilter() === 'areas') {
                @for (area of areas(); track area.id) {
                  <div class="route__area-row" (click)="selectArea(area)">
                    <span class="route__area-name">{{ area.name }}</span>
                    <span class="route__area-vibe">{{ area.vibe?.join(' · ') }}</span>
                  </div>
                }
              }

              <!-- Places list (when any other filter) -->
              @if (manualTypeFilter() !== 'areas') {
              @for (place of topPlaces(); track place.id) {
                <div class="route__place-row"
                  [class.route__place-row--selected]="isSelected(place.id)"
                  [class.route__place-row--expanded]="expandedPlaceId() === place.id"
                  (click)="toggleExpand(place.id)">
                  <!-- Rest: always visible -->
                  <div class="route__place-rest">
                    <span class="route__place-name">{{ place.name }}</span>
                    @if (isSelected(place.id)) {
                      <span class="route__place-idx">{{ selectedIndex(place.id) + 1 }}</span>
                    }
                  </div>
                  <!-- Expanded: on tap -->
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
                          @if (place.hook) { <p class="route__place-hook">{{ place.hook }}</p> }
                          <span class="route__place-cat">{{ place.category }}</span>
                        </div>
                      </div>
                      <button class="ld-btn ld-btn--primary route__place-add-btn"
                        (click)="togglePointById(place.id); $event.stopPropagation()">
                        {{ isSelected(place.id) ? ('route.remove' | translate) : ('route.add_point' | translate) }}
                      </button>
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
                <p class="route__optimize-text">{{ 'route.optimize_question' | translate }}</p>
                <div class="route__optimize-actions">
                  <button class="ld-btn ld-btn--primary" (click)="buildManualRoute(true)">{{ 'route.optimize_yes' | translate }}</button>
                  <button class="ld-btn ld-btn--ghost" (click)="buildManualRoute(false)">{{ 'route.optimize_no' | translate }}</button>
                </div>
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
                (click)="toggleMood(m.value)">
                <ld-icon [name]="m.icon" [size]="14" /> {{ m.labelKey | translate }}
              </button>
            }
          </div>

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
          <div class="route__loader-pins">
            <span class="pin"><ld-icon name="map-pin" [size]="20" /></span>
            <span class="pin"><ld-icon name="map-pin" [size]="20" /></span>
            <span class="pin"><ld-icon name="map-pin" [size]="20" /></span>
          </div>
          <p class="route__loader-text">{{ loaderPhrase() }}</p>
        </section>
      }

      <!-- Step: Result -->
      @if (step() === 'result' && routeData()) {
        <section class="route__result">
          <!-- Header / napustvie -->
          <div class="route__napustvie">
            <p>{{ routeData()!.header }}</p>
          </div>

          <!-- Map -->
          <app-route-map [points]="mapPoints()" [lines]="mapLines()" (markerTap)="scrollToTimelinePoint($event)" #routeMap />

          <!-- Timeline -->
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
                <div class="route__transition" [class.route__transition--taxi]="routeData()!.transitions[i].type === 'taxi'">
                  <ld-icon [name]="routeData()!.transitions[i].type === 'taxi' ? 'car' : 'route'" [size]="14" />
                  <span>
                    {{ routeData()!.transitions[i].type === 'taxi' ? ('route.taxi' | translate) : ('route.walk' | translate) }}
                    · {{ routeData()!.transitions[i].durationMin }} {{ 'route.min' | translate }}
                  </span>
                  @if (routeData()!.transitions[i].careLine) {
                    <p class="route__transition-care">{{ routeData()!.transitions[i].careLine }}</p>
                  }
                </div>
              }
            }
          </div>

          <!-- Footer care -->
          @for (care of footerCare(); track care.rule) {
            <p class="route__footer-care">{{ care.text }}</p>
          }

          <!-- Actions -->
          <div class="route__actions">
            <button class="ld-btn ld-btn--ghost" (click)="step.set('form')">{{ 'route.edit' | translate }}</button>
            <button class="ld-btn ld-btn--primary" (click)="buildRoute()">{{ 'route.rebuild' | translate }}</button>
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

    /* Area rows (shown when "Районы" chip active) */
    .route__area-row {
      display: flex; flex-direction: column; gap: 2px;
      padding: 12px 14px; border: 1px solid var(--ld-border); border-radius: 10px;
      background: var(--ld-surface); cursor: pointer; transition: border-color 0.15s;
    }
    .route__area-row:hover { border-color: var(--ld-primary); }
    .route__area-name { font-size: 14px; font-weight: 600; color: var(--ld-text); }
    .route__area-vibe { font-size: 11px; color: var(--ld-text-3); }

    /* Area detail (shown when area selected as filter) */
    .route__area-detail {
      padding: 10px 12px; background: var(--ld-primary-soft); border-radius: 10px; margin-bottom: 6px;
    }
    .route__area-desc-title { font-size: 14px; font-weight: 700; margin: 0 0 4px; color: var(--ld-text); }
    .route__area-desc { font-size: 12px; color: var(--ld-text); margin: 0 0 4px; line-height: 1.4; }
    .route__area-warn { font-size: 11px; color: var(--ld-text-2); margin: 4px 0; font-style: italic; }
    .route__area-tags {
      display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0;
    }
    .route__area-tag {
      font-size: 10px; padding: 2px 6px; border-radius: 6px;
      background: var(--ld-surface); color: var(--ld-text-2); border: 1px solid var(--ld-border);
    }
    .route__area-full {
      font-size: 12px; color: var(--ld-text); margin: 4px 0; line-height: 1.5;
    }
    .route__area-actions {
      display: flex; gap: 12px; margin-top: 6px;
    }
    .route__area-clear {
      background: none; border: none; font-size: 12px; color: var(--ld-primary);
      cursor: pointer; padding: 0; font-family: inherit; text-decoration: underline;
    }

    /* Place row: rest state */
    .route__place-row {
      border: 1px solid var(--ld-border); border-radius: 10px;
      background: var(--ld-surface); color: var(--ld-text); cursor: pointer;
      transition: border-color 0.15s;
    }
    .route__place-row--selected { border-color: var(--ld-primary); }
    .route__place-row--expanded { border-color: var(--ld-primary); background: var(--ld-primary-soft); }

    .route__place-rest {
      display: flex; align-items: center; gap: 8px; padding: 12px 14px; min-height: 44px;
    }
    .route__place-tier { font-size: 14px; flex-shrink: 0; }
    .route__place-name { flex: 1; font-size: 13px; font-weight: 600; min-width: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .route__place-idx {
      width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
      background: var(--ld-primary); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
    }

    /* Place row: expanded detail */
    .route__place-detail {
      padding: 0 12px 10px; display: flex; flex-direction: column; gap: 6px;
    }
    .route__place-photo-row {
      display: flex; gap: 10px; align-items: flex-start;
    }
    .route__place-photo {
      width: 64px; height: 64px; border-radius: 8px; object-fit: cover; flex-shrink: 0;
    }
    .route__place-photo-placeholder {
      width: 64px; height: 64px; border-radius: 8px; flex-shrink: 0;
      background: var(--ld-surface-2); display: flex; align-items: center;
      justify-content: center; color: var(--ld-text-3);
    }
    .route__place-detail-text { flex: 1; min-width: 0; }
    .route__place-hook {
      font-size: 12px; color: var(--ld-text-2); font-style: italic; margin: 0 0 2px;
    }
    .route__place-cat {
      font-size: 10px; color: var(--ld-text-3); text-transform: capitalize;
    }
    .route__place-add-btn { min-height: 34px; font-size: 13px; }

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
      border-radius: 12px; margin: 0 var(--ld-space-lg) 12px;
    }
    .route__optimize-text { font-size: 14px; margin: 0 0 10px; color: var(--ld-text); line-height: 1.4; }
    .route__optimize-actions { display: flex; gap: 8px; }
    .route__optimize-actions .ld-btn { flex: 1; }

    .route__form { padding: 0 var(--ld-space-lg); }
    .route__form-label { font-size: 13px; color: var(--ld-text-2); margin: 16px 0 8px; font-weight: 600; }
    .route__chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .route__submit { width: 100%; margin-top: 24px; min-height: 48px; font-size: 16px; }

    .route__loading { text-align: center; padding: 80px var(--ld-space-lg); }
    .route__loader-pins { display: flex; justify-content: center; gap: 4px; margin-bottom: 16px; }
    .route__loader-pins .pin {
      display: inline-block; transform-origin: bottom center; color: var(--ld-primary);
      animation: pinHop 1.05s ease-in-out infinite;
    }
    .route__loader-pins .pin:nth-child(2) { animation-delay: 0.14s; }
    .route__loader-pins .pin:nth-child(3) { animation-delay: 0.28s; }
    @keyframes pinHop {
      0%, 70%, 100% { transform: translateY(0) scale(1); opacity: 0.55; }
      35% { transform: translateY(-7px) scale(1.12); opacity: 1; }
    }
    .route__loader-text { font-size: 14px; color: var(--ld-text-2); font-style: italic; }

    .route__result { padding: 0 var(--ld-space-lg); }
    .route__napustvie {
      background: var(--ld-primary-soft); border-radius: 12px; padding: 14px 16px;
      font-size: 14px; color: var(--ld-text); line-height: 1.5; margin-bottom: 20px;
    }

    .route__timeline { position: relative; padding-left: 40px; }
    .route__point { display: flex; gap: 12px; margin-bottom: 4px; position: relative; }
    .route__point-time {
      position: absolute; left: -40px; top: 2px;
      font-size: 12px; font-weight: 600; color: var(--ld-text-2); width: 36px; text-align: right;
    }
    .route__point-marker {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: var(--ld-primary); color: var(--ld-bg);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
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
    .route__transition--taxi { border-left-color: var(--ld-primary); }
    .route__transition-care {
      width: 100%; font-size: 12px; color: var(--ld-primary);
      font-style: italic; margin: 2px 0 0;
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
  private geo = inject(GeolocationService);
  private profile = inject(ProfileStore);
  private router = inject(Router);
  private translate = inject(TranslateService);

  private routeMap = viewChild<RouteMapComponent>('routeMap');

  ngOnInit() {
    this.loadTopPlaces();
    this.loadAreas();
  }

  step = signal<'form' | 'loading' | 'result' | 'manual'>('manual');
  showOptimizePrompt = signal(false);
  routeData = signal<any>(null);
  alternatives = signal<any[]>([]);
  alternativesForIndex = signal(-1);
  altLoading = signal(false);

  // Manual mode
  topPlaces = signal<any[]>([]);
  areas = signal<any[]>([]);
  selectedPointIds = signal<string[]>([]);
  manualTypeFilter = signal<string | null>(null);
  expandedPlaceId = signal<string | null>(null);
  selectedAreaId = signal<string | null>(null);
  areaExpanded = signal(false);

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
    { value: 'areas', labelKey: 'route.areas_title' },
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

  durationOptions = [
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
  ];

  paceOptions = [
    { value: 'relaxed', labelKey: 'route.pace_relaxed' },
    { value: 'intense', labelKey: 'route.pace_intense' },
  ];

  private loaderPhrases = ['route.loader_1', 'route.loader_2', 'route.loader_3'];
  private loaderIdx = 0;

  loaderPhrase = signal(this.loaderPhrases[0]);

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
    const current = this.selectedMoods();
    if (current.includes(mood)) {
      this.selectedMoods.set(current.filter(m => m !== mood));
    } else {
      this.selectedMoods.set([...current, mood]);
    }
  }

  buildRoute() {
    this.step.set('loading');
    this.loaderIdx = 0;
    this.loaderPhrase.set(this.loaderPhrases[0]);

    const interval = setInterval(() => {
      this.loaderIdx = (this.loaderIdx + 1) % this.loaderPhrases.length;
      this.loaderPhrase.set(this.loaderPhrases[this.loaderIdx]);
    }, 1200);

    const pos = this.geo.position();
    this.api.generateRoute({
      lat: pos.lat,
      lng: pos.lng,
      duration: this.selectedDuration(),
      moods: this.selectedMoods(),
      pace: this.selectedPace(),
      locale: this.profile.locale(),
    }).subscribe({
      next: (data) => {
        clearInterval(interval);
        this.routeData.set(data);
        this.step.set('result');
      },
      error: () => {
        clearInterval(interval);
        this.step.set('form');
      },
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

  selectArea(area: any) {
    this.selectedAreaId.set(area.id);
    this.areaExpanded.set(false);
    // Stay on 'areas' filter but show places below area detail
    // Filter places by area bbox
    const bbox = area.bbox;
    if (bbox) {
      this.topPlaces.set([]);
      const pos = this.geo.position();
      this.http.get<any[]>(`/v1/routes/top-places?lat=${pos.lat}&lng=${pos.lng}`).subscribe({
        next: (all) => {
          const filtered = all.filter((p: any) =>
            p.lat >= bbox.minLat && p.lat <= bbox.maxLat &&
            p.lng >= bbox.minLng && p.lng <= bbox.maxLng
          );
          this.topPlaces.set(filtered.length > 0 ? filtered : all);
          // Switch to places view with area detail visible
          this.manualTypeFilter.set(null);
        },
      });
      // Center map on area
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
    if (type === 'areas') {
      // Always show areas list when tapping "Районы"
      this.selectedAreaId.set(null);
      this.manualTypeFilter.set('areas');
      return;
    }
    // Any other filter → clear area selection
    this.selectedAreaId.set(null);
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
    const pos = this.geo.position();
    // If GPS available (not default), ask whether to optimize from current location
    if (pos.source === 'gps') {
      this.showOptimizePrompt.set(true);
    } else {
      // No GPS — build in selection order, start from first selected point
      this.buildManualRoute(false);
    }
  }

  buildManualRoute(optimizeFromGps: boolean) {
    this.showOptimizePrompt.set(false);
    if (this.selectedPoints().length === 0) return;
    this.step.set('loading');

    const pos = this.geo.position();
    const firstPoint = this.selectedPoints()[0];
    const startLat = optimizeFromGps ? pos.lat : firstPoint.lat;
    const startLng = optimizeFromGps ? pos.lng : firstPoint.lng;

    this.http.post<any>('/v1/routes/link', {
      pointIds: this.selectedPointIds(),
      startLat,
      startLng,
      locale: this.profile.locale(),
    }).subscribe({
      next: (data) => { this.routeData.set(data); this.step.set('result'); },
      error: () => this.step.set('manual'),
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
