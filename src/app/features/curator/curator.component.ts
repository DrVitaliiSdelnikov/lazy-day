import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GeolocationService } from '../../core/services/geolocation.service';
import { ProfileStore } from '../../core/stores/profile.store';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { RouteMapComponent, MapPoint } from '../../core/components/route-map.component';
import { ResultCardComponent } from '../discover/result-card/result-card.component';
import { SavedStore } from '../../core/stores/saved.store';
import { RecommendationCard } from '../../core/models';

interface CurationItem {
  id: string; type: 'place' | 'event'; day?: string;
  title: string; category: string; lat: number; lng: number;
  distanceM: number; walkMinutes: number;
  hook?: string; rating?: number; ratingCount?: number;
  openStatus?: string; petStatus?: string; whyLabel?: string;
  startsAt?: string; ticketUrl?: string; priceLabel?: string;
  careLine?: string; photoUrl?: string;
}

interface Gift {
  eventId: string; place: CurationItem; confidence: string; text: string;
}

interface CurationResponse {
  id: string;
  header: { title: string; care: string[] };
  items: CurationItem[];
  gifts: Gift[];
  meta: { dateType: string; dayPart: string; seed: number };
}

@Component({
  selector: 'app-curator',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent, RouteMapComponent, ResultCardComponent],
  template: `
    <div class="curator">
      <header class="curator__header">
        <button class="curator__back" (click)="goBack()">
          <ld-icon name="arrow-left" [size]="18" />
        </button>
        <h1 class="curator__title">{{ step() === 'result' ? '' : ('curator.title' | translate) }}</h1>
      </header>

      <!-- FORM -->
      @if (step() === 'form') {
        <section class="curator__form">
          <p class="curator__lead">{{ 'curator.title' | translate }}</p>
          <p class="curator__sub">{{ 'curator.sub' | translate }}</p>

          <!-- When -->
          <div class="curator__group">
            <p class="curator__label"><span class="curator__star">◆</span> {{ 'curator.when' | translate }}</p>
            <div class="curator__when-box">
              <div class="curator__chips">
                @for (d of dateOptions; track d.value) {
                  <button class="curator__chip" [class.curator__chip--active]="dateType() === d.value"
                    (click)="dateType.set(d.value)">{{ d.labelKey | translate }}</button>
                }
              </div>
            </div>
          </div>

          <!-- Moods -->
          <div class="curator__group">
            <p class="curator__label">{{ 'curator.mood' | translate }} <span class="curator__label-hint">· {{ 'curator.mood_hint' | translate }}</span></p>
            <div class="curator__chips">
              @for (m of moodOptions; track m.value) {
                <button class="curator__chip curator__chip--multi"
                  [class.curator__chip--multi-active]="selectedMoods().includes(m.value)"
                  (click)="toggleMood(m.value)">
                  <ld-icon [name]="m.icon" [size]="14" /> {{ m.labelKey | translate }}
                </button>
              }
            </div>
          </div>

          <!-- Day part -->
          <div class="curator__group">
            <p class="curator__label">{{ 'curator.day_part' | translate }}</p>
            <div class="curator__chips">
              @for (p of dayPartOptions; track p.value) {
                <button class="curator__chip" [class.curator__chip--active]="dayPart() === p.value"
                  (click)="dayPart.set(p.value)">{{ p.labelKey | translate }}</button>
              }
            </div>
          </div>

          <!-- More (expandable) -->
          <button class="curator__more-toggle" (click)="moreOpen.set(!moreOpen())">
            <ld-icon name="arrow-left" [size]="12" [style.transform]="moreOpen() ? 'rotate(-90deg)' : 'rotate(-90deg)'" />
            {{ 'curator.more' | translate }}
          </button>
          @if (moreOpen()) {
            <div class="curator__more">
              <div class="curator__group">
                <p class="curator__label">{{ 'curator.company' | translate }}</p>
                <div class="curator__chips">
                  @for (c of companyOptions; track c.value) {
                    <button class="curator__chip" [class.curator__chip--active]="company() === c.value"
                      (click)="company.set(company() === c.value ? null : c.value)">{{ c.labelKey | translate }}</button>
                  }
                </div>
              </div>
            </div>
          }

          <button class="curator__submit" (click)="generate()">
            {{ 'curator.generate' | translate }}
          </button>
          <p class="curator__hint">{{ 'curator.hint' | translate }}</p>
        </section>
      }

      <!-- LOADING -->
      @if (step() === 'loading') {
        <section class="curator__loading">
          <div class="curator__loader-scene">
            <ld-icon name="sparkles" [size]="32" />
          </div>
          <p class="curator__loader-text">{{ loaderPhrase() | translate }}</p>
        </section>
      }

      <!-- RESULT -->
      @if (step() === 'result' && curation()) {
        <section class="curator__result">
          <h2 class="curator__mood-title">{{ curation()!.header.title }}</h2>

          <!-- Care banner -->
          @if (curation()!.header.care.length > 0) {
            <div class="curator__care">
              <ld-icon name="heart" [size]="15" />
              <div>{{ curation()!.header.care.join(' ') }}</div>
            </div>
          }

          <!-- Map -->
          <div class="curator__map">
            <app-route-map [points]="mapPoints()" [lines]="[]" />
          </div>

          <!-- Items grouped by day (for weekend) or flat -->
          @if (hasSaturdayItems()) {
            <p class="curator__day-label">{{ 'curator.saturday' | translate }}</p>
          }
          @for (item of saturdayItems(); track item.id; let i = $index) {
            <div class="curator__item">
              <div class="curator__item-num">{{ i + 1 }}</div>
              <div class="curator__item-body">
                <app-result-card
                  [card]="itemToCard(item)"
                  [isSaved]="savedStore.isSaved(item.id)"
                  (openDetail)="openDetail(item)"
                  (toggleSave)="toggleSave(item)" />
                @if (item.careLine) {
                  <p class="curator__item-care"><ld-icon name="heart" [size]="11" /> {{ item.careLine }}</p>
                }
                <button class="curator__item-remove" (click)="removeItem(item)">
                  <ld-icon name="x" [size]="10" /> {{ 'curator.remove' | translate }}
                </button>
              </div>
            </div>
            <!-- Gift after event -->
            @if (giftForEvent(item.id); as gift) {
              <div class="curator__gift">
                <div class="curator__gift-text"><ld-icon name="gift" [size]="14" /> {{ gift.text }}</div>
                <div class="curator__gift-actions">
                  <button class="curator__gift-add" (click)="addGift(gift)">
                    <ld-icon name="map-pin" [size]="12" /> {{ 'curator.gift_add' | translate }}
                  </button>
                  <button class="curator__gift-skip">{{ 'curator.gift_skip' | translate }}</button>
                </div>
              </div>
            }
          }

          @if (hasSundayItems()) {
            <p class="curator__day-label">{{ 'curator.sunday' | translate }}</p>
            @for (item of sundayItems(); track item.id; let i = $index) {
              <div class="curator__item">
                <div class="curator__item-num">{{ saturdayItems().length + i + 1 }}</div>
                <div class="curator__item-body">
                  <app-result-card
                    [card]="itemToCard(item)"
                    [isSaved]="savedStore.isSaved(item.id)"
                    (openDetail)="openDetail(item)"
                    (toggleSave)="toggleSave(item)" />
                  @if (item.careLine) {
                    <p class="curator__item-care"><ld-icon name="heart" [size]="11" /> {{ item.careLine }}</p>
                  }
                </div>
              </div>
            }
          }

          <!-- Footer actions -->
          <div class="curator__footer">
            @if (placeCount() >= 3) {
              <button class="curator__footer-btn curator__footer-btn--primary" (click)="linkToRoute()">
                <ld-icon name="route" [size]="14" /> {{ 'curator.link_route' | translate }}
              </button>
            }
            <button class="curator__footer-btn" (click)="rebuild()">
              <ld-icon name="refresh" [size]="14" /> {{ 'curator.another' | translate }}
            </button>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .curator { min-height: 100vh; background: var(--ld-bg); padding-bottom: 80px; }
    .curator__header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px var(--ld-space-lg);
    }
    .curator__back { background: none; border: none; cursor: pointer; color: var(--ld-text); padding: 4px; }
    .curator__title { font-size: 16px; font-weight: 700; margin: 0; color: var(--ld-text); }

    /* Form */
    .curator__form { padding: 0 var(--ld-space-lg); }
    .curator__lead { font-size: 20px; font-weight: 800; margin: 0 0 3px; color: var(--ld-text); }
    .curator__sub { font-size: 12px; color: var(--ld-text-3); margin: 0 0 18px; }
    .curator__group { margin-bottom: 16px; }
    .curator__label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--ld-text-3); font-weight: 600; margin: 0 0 8px;
    }
    .curator__label-hint { text-transform: none; font-weight: 400; }
    .curator__star { color: var(--ld-primary); font-size: 13px; }
    .curator__when-box {
      border: 2px solid var(--ld-primary-soft); border-radius: 14px;
      padding: 12px; background: var(--ld-surface);
    }
    .curator__chips { display: flex; gap: 7px; flex-wrap: wrap; }
    .curator__chip {
      border: 1px solid var(--ld-border); background: var(--ld-surface);
      border-radius: 16px; padding: 8px 14px; font-size: 13px;
      color: var(--ld-text-2); cursor: pointer; font-family: inherit;
      display: flex; align-items: center; gap: 5px;
      transition: all 150ms;
    }
    .curator__chip--active {
      background: var(--ld-primary); border-color: var(--ld-primary);
      color: var(--ld-on-primary, #fff);
    }
    .curator__chip--multi-active {
      background: var(--ld-primary-soft); border-color: var(--ld-primary);
      color: var(--ld-on-primary-soft, var(--ld-primary));
    }
    .curator__more-toggle {
      font-size: 12px; color: var(--ld-primary); cursor: pointer;
      background: none; border: none; font-family: inherit; font-weight: 600;
      display: flex; align-items: center; gap: 5px; margin: 2px 0 14px;
    }
    .curator__more { margin-bottom: 8px; }
    .curator__submit {
      width: 100%; background: var(--ld-primary); color: var(--ld-on-primary, #fff);
      border: 0; border-radius: 13px; padding: 15px; font-size: 15px;
      font-weight: 700; cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .curator__submit:hover { opacity: 0.9; }
    .curator__hint { font-size: 11px; color: var(--ld-text-3); text-align: center; margin-top: 9px; }

    /* Loading */
    .curator__loading { text-align: center; padding: 80px var(--ld-space-lg); }
    .curator__loader-scene { color: var(--ld-primary); margin-bottom: 16px; }
    .curator__loader-text { font-size: 14px; color: var(--ld-text-2); font-style: italic; }

    /* Result */
    .curator__result { padding: 0 var(--ld-space-lg); }
    .curator__mood-title { font-size: 20px; font-weight: 800; margin: 0 0 10px; color: var(--ld-text); }
    .curator__care {
      background: var(--ld-primary-soft); border-radius: 12px;
      padding: 11px 13px; font-size: 12px; color: var(--ld-on-primary-soft, var(--ld-primary));
      line-height: 1.45; margin-bottom: 14px; display: flex; gap: 8px;
    }
    .curator__map { height: 150px; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
    .curator__day-label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--ld-text-3); font-weight: 700; margin: 14px 0 9px;
    }
    .curator__item { display: flex; gap: 8px; margin-bottom: 9px; }
    .curator__item-num {
      width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%;
      background: var(--ld-primary-soft); color: var(--ld-on-primary-soft, var(--ld-primary));
      font-size: 11px; font-weight: 700; display: flex; align-items: center;
      justify-content: center; margin-top: 12px;
    }
    .curator__item-body { flex: 1; min-width: 0; }
    .curator__item-care {
      font-size: 11px; color: var(--ld-text-2); background: var(--ld-surface-2);
      border-radius: 7px; padding: 5px 8px; margin: -4px 0 4px;
      display: flex; gap: 5px; align-items: center;
    }
    .curator__item-care ld-icon { color: var(--ld-primary); }
    .curator__item-remove {
      background: none; border: none; font-size: 11px; color: var(--ld-text-3);
      cursor: pointer; font-family: inherit; display: flex; align-items: center;
      gap: 3px; margin-top: 4px; padding: 0;
    }
    .curator__item-remove:hover { color: var(--ld-danger, #CC4B4B); }

    /* Gift */
    .curator__gift {
      margin: -4px 0 12px 30px; background: var(--ld-secondary-soft, #FBF3E2);
      border: 1px dashed var(--ld-secondary, #D8BE86); border-radius: 10px;
      padding: 9px 11px;
    }
    .curator__gift-text {
      font-size: 12px; color: var(--ld-text); display: flex; gap: 6px; line-height: 1.4;
    }
    .curator__gift-text ld-icon { color: var(--ld-secondary, #8A6D3B); flex-shrink: 0; margin-top: 2px; }
    .curator__gift-actions { display: flex; gap: 7px; margin-top: 8px; }
    .curator__gift-add {
      background: var(--ld-secondary, #8A6D3B); color: #fff; border: 0;
      border-radius: 7px; padding: 5px 11px; font-size: 11px; font-weight: 600;
      cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 4px;
    }
    .curator__gift-skip {
      background: none; border: none; color: var(--ld-text-3);
      font-size: 11px; cursor: pointer; font-family: inherit;
    }

    /* Footer */
    .curator__footer {
      display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px;
      padding-top: 14px; border-top: 1px solid var(--ld-border);
    }
    .curator__footer-btn {
      flex: 1; min-width: 130px; border: 1px solid var(--ld-border);
      background: var(--ld-surface); border-radius: 10px; padding: 11px;
      font-size: 12px; color: var(--ld-text); cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600;
    }
    .curator__footer-btn--primary {
      background: var(--ld-primary); border-color: var(--ld-primary);
      color: var(--ld-on-primary, #fff); flex-basis: 100%;
    }
  `,
})
export class CuratorComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private translate = inject(TranslateService);
  readonly geo = inject(GeolocationService);
  private profile = inject(ProfileStore);
  readonly savedStore = inject(SavedStore);

  private readonly apiBase = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    ? 'https://api.lazigo.app/v1' : '/v1';

  step = signal<'form' | 'loading' | 'result'>('form');
  curation = signal<CurationResponse | null>(null);

  // Form signals
  dateType = signal<string>('today');
  selectedMoods = signal<string[]>(['events', 'food']);
  dayPart = signal<string>('evening');
  company = signal<string | null>(null);
  moreOpen = signal(false);

  dateOptions = [
    { value: 'today', labelKey: 'curator.today' },
    { value: 'tomorrow', labelKey: 'curator.tomorrow' },
    { value: 'weekend', labelKey: 'curator.weekend' },
  ];

  moodOptions = [
    { value: 'events', labelKey: 'curator.mood_events', icon: 'music' },
    { value: 'culture', labelKey: 'curator.mood_culture', icon: 'masks-theater' },
    { value: 'food', labelKey: 'curator.mood_food', icon: 'tools-kitchen-2' },
    { value: 'scenic', labelKey: 'curator.mood_scenic', icon: 'sun' },
    { value: 'spa', labelKey: 'curator.mood_spa', icon: 'coffee' },
    { value: 'nightlife', labelKey: 'curator.mood_nightlife', icon: 'glass-cocktail' },
    { value: 'kids', labelKey: 'curator.mood_kids', icon: 'users' },
  ];

  dayPartOptions = [
    { value: 'day', labelKey: 'curator.day' },
    { value: 'evening', labelKey: 'curator.evening' },
    { value: 'all_day', labelKey: 'curator.all_day' },
  ];

  companyOptions = [
    { value: 'solo', labelKey: 'curator.solo' },
    { value: 'couple', labelKey: 'curator.couple' },
    { value: 'friends', labelKey: 'curator.friends' },
    { value: 'kids', labelKey: 'curator.with_kids' },
  ];

  // Loader
  private loaderPhrases = ['curator.loader_1', 'curator.loader_2', 'curator.loader_3'];
  private loaderIdx = 0;
  loaderPhrase = signal(this.loaderPhrases[0]);

  // Computed
  mapPoints = computed<MapPoint[]>(() => {
    const items = this.curation()?.items ?? [];
    return items.filter(i => i.lat && i.lng).map((item, idx) => ({
      id: item.id, name: item.title, lat: item.lat, lng: item.lng, index: idx,
    }));
  });

  saturdayItems = computed(() => {
    const items = this.curation()?.items ?? [];
    if (this.curation()?.meta.dateType === 'weekend') {
      return items.filter(i => i.day === 'saturday' || !i.day);
    }
    return items;
  });

  sundayItems = computed(() => {
    const items = this.curation()?.items ?? [];
    return items.filter(i => i.day === 'sunday');
  });

  hasSaturdayItems = computed(() =>
    this.curation()?.meta.dateType === 'weekend' && this.saturdayItems().length > 0
  );

  hasSundayItems = computed(() => this.sundayItems().length > 0);

  placeCount = computed(() =>
    (this.curation()?.items ?? []).filter(i => i.type === 'place').length
  );

  toggleMood(mood: string) {
    const current = this.selectedMoods();
    if (current.includes(mood)) {
      this.selectedMoods.set(current.filter(m => m !== mood));
    } else {
      this.selectedMoods.set([...current, mood]);
    }
  }

  generate() {
    this.step.set('loading');
    this.loaderIdx = 0;
    this.loaderPhrase.set(this.loaderPhrases[0]);

    const interval = setInterval(() => {
      this.loaderIdx = (this.loaderIdx + 1) % this.loaderPhrases.length;
      this.loaderPhrase.set(this.loaderPhrases[this.loaderIdx]);
    }, 1500);

    const pos = this.geo.position();
    this.http.post<CurationResponse>(`${this.apiBase}/curator/generate`, {
      lat: pos.lat, lng: pos.lng,
      dateType: this.dateType(),
      moods: this.selectedMoods(),
      dayPart: this.dayPart(),
      company: this.company() || undefined,
      locale: this.profile.locale(),
      deviceIdHash: this.profile.deviceIdHash() || undefined,
    }).subscribe({
      next: (data) => { clearInterval(interval); this.curation.set(data); this.step.set('result'); },
      error: () => { clearInterval(interval); this.step.set('form'); },
    });
  }

  rebuild() {
    this.generate();
  }

  linkToRoute() {
    const places = (this.curation()?.items ?? []).filter(i => i.type === 'place');
    if (places.length < 3) return;
    const pos = this.geo.position();
    this.http.post<any>(`${this.apiBase}/curator/link-to-route`, {
      placeIds: places.map(p => p.id),
      lat: pos.lat, lng: pos.lng,
      locale: this.profile.locale(),
    }).subscribe({
      next: (routeData) => {
        // Store route data for RouteComponent to pick up
        sessionStorage.setItem('ld_curator_route', JSON.stringify(routeData));
        this.router.navigate(['/route'], { queryParams: { from: 'curator' } });
      },
    });
  }

  removeItem(item: CurationItem) {
    const cur = this.curation();
    if (!cur) return;
    this.curation.set({
      ...cur,
      items: cur.items.filter(i => i.id !== item.id),
      gifts: cur.gifts.filter(g => g.eventId !== item.id),
    });
  }

  giftForEvent(eventId: string): Gift | null {
    return this.curation()?.gifts.find(g => g.eventId === eventId) ?? null;
  }

  addGift(gift: Gift) {
    const cur = this.curation();
    if (!cur) return;
    this.curation.set({
      ...cur,
      items: [...cur.items, gift.place],
      gifts: cur.gifts.filter(g => g !== gift),
    });
  }

  itemToCard(item: CurationItem): RecommendationCard {
    return {
      id: item.id, type: item.type, title: item.title,
      category: item.category, lat: item.lat, lng: item.lng,
      distanceM: item.distanceM, walkMinutes: item.walkMinutes,
      hook: item.hook, rating: item.rating, ratingCount: item.ratingCount,
      openStatus: item.openStatus, petStatus: item.petStatus,
      whyLabel: item.whyLabel, startsAt: item.startsAt,
      ticketUrl: item.ticketUrl, photoUrl: item.photoUrl,
      explanations: [],
      source: 'curator',
    } as RecommendationCard;
  }

  openDetail(item: CurationItem) {
    this.router.navigate(['/detail', item.type, item.id]);
  }

  toggleSave(item: CurationItem) {
    this.savedStore.toggle(this.itemToCard(item));
  }

  goBack() {
    if (this.step() === 'result') {
      this.step.set('form');
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/discover']);
    }
  }
}
