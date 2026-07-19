import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ProfileStore } from '../../core/stores/profile.store';
import { apiProviders } from '../../core/providers';
import { RecommendationCard } from '../../core/models';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { InteractionService } from '../../core/services/interaction.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { SavedStore } from '../../core/stores/saved.store';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent],
  providers: [...apiProviders],
  template: `
    @if (card(); as c) {
    <div class="detail">
      <!-- Color header -->
      <div class="detail__header" [class.detail__header--event]="c.type === 'event'">
        <div class="detail__header-nav">
          @if (!isModal()) {
            <button class="detail__icon-btn" (click)="goBack()" [attr.aria-label]="'nav.discover' | translate">
              <ld-icon name="arrow-left" [size]="16" />
            </button>
            <div class="detail__header-actions">
              <button class="detail__icon-btn" (click)="shareCard(c)" [attr.aria-label]="'detail.share' | translate">
                <ld-icon name="share-2" [size]="15" />
              </button>
              <button class="detail__icon-btn" [class.detail__icon-btn--heart]="isSaved()"
                (click)="onToggleSave()" [attr.aria-label]="(isSaved() ? 'detail.unsave' : 'detail.save') | translate">
                <ld-icon [name]="isSaved() ? 'heart-filled' : 'heart'" [size]="16" />
              </button>
            </div>
          }
        </div>
        <div class="detail__header-icon">
          <ld-icon [name]="categoryIcon(c)" [size]="38" />
        </div>
      </div>

      <!-- Content -->
      <div class="detail__body">
        <!-- Type label (small, muted) -->
        @if (c.type === 'event') {
          <p class="detail__type-label">{{ eventTypeLabel(c) }}</p>
        }

        <!-- Title -->
        <h1 class="detail__title">{{ c.title }}</h1>

        <!-- Meta: category + rating (places) -->
        <p class="detail__meta">
          {{ c.categoryLabel || c.category }}
          @if (c.rating) {
            · <ld-icon name="star-filled" [size]="12" class="detail__star" /> {{ c.rating }}
            @if (c.ratingCount) { ({{ formatRatingCount(c.ratingCount) }}) }
          }
        </p>

        <!-- Info rows -->
        <div class="detail__info">
          <!-- Date/time for events -->
          @if (c.type === 'event' && c.startsAt) {
            <div class="detail__info-row">
              <ld-icon name="clock" [size]="14" class="detail__info-icon detail__info-icon--event" />
              <span>{{ formatEventDateTime(c.startsAt) }}</span>
              @if (minutesUntil(c.startsAt); as mins) {
                @if (mins > 0 && mins <= 180) {
                  <span class="detail__countdown">{{ 'detail.in_time' | translate }} {{ formatCountdown(mins) }}</span>
                }
              }
            </div>
          }

          <!-- Location row (clickable → map) -->
          @if (hasDistance(c.distanceM)) {
            <button class="detail__info-row detail__info-row--tap" (click)="openOnMap(c)">
              <ld-icon name="map-pin" [size]="14" class="detail__info-icon" />
              <span>{{ c.venueName || c.address || '' }}{{ c.venueName || c.address ? ' · ' : '' }}{{ formatDistance(c.distanceM) }} · {{ c.walkMinutes }} {{ 'detail.min' | translate }}</span>
            </button>
          } @else if (c.venueName || c.address) {
            <button class="detail__info-row detail__info-row--tap" (click)="openOnMap(c)">
              <ld-icon name="map-pin" [size]="14" class="detail__info-icon" />
              <span>{{ c.venueName || c.address }}</span>
            </button>
          }

          <!-- Hours / status for places -->
          @if (c.type !== 'event') {
            <div class="detail__info-row">
              <ld-icon [name]="c.openStatus ? 'clock' : 'clock-off'" [size]="14" class="detail__info-icon" />
              @if (c.openStatus) {
                <span [class.detail__status--open]="isOpen(c.openStatus)" [class.detail__status--closed]="!isOpen(c.openStatus)">{{ c.openStatus }}</span>
              } @else {
                <span class="detail__status--muted">{{ 'card.hours_unknown' | translate }}</span>
              }
            </div>
          }
        </div>

        <!-- Actions row -->
        <div class="detail__actions">
          <button class="ld-btn ld-btn--primary detail__action-main" (click)="openRoute(c)"
            [disabled]="!hasGps()">
            <ld-icon name="route" [size]="14" /> {{ 'detail.route' | translate }}
          </button>
          @if (showTaxi(c)) {
            <button class="detail__taxi-btn" (click)="openYandexTaxi(c)" aria-label="YandexGo">
              YandexGo
            </button>
          }
          <button class="detail__icon-action" (click)="shareCard(c)" [attr.aria-label]="'detail.share' | translate">
            <ld-icon name="share-2" [size]="15" />
          </button>
          <button class="detail__icon-action detail__icon-action--danger" (click)="onHide()" [attr.aria-label]="'detail.hide' | translate">
            <ld-icon name="eye-off" [size]="15" />
          </button>
        </div>
        @if (!hasGps()) {
          <p class="detail__geo-hint">
            <ld-icon name="map-pin" [size]="12" /> {{ 'location.enable_gps' | translate }}
          </p>
        }
      </div>

      <!-- Event: sticky ticket CTA -->
      @if (c.type === 'event' && (c.ticketUrl || c.externalUrl)) {
        <div class="detail__sticky-cta">
          <a class="ld-btn ld-btn--primary detail__ticket-btn" [href]="c.ticketUrl || c.externalUrl" target="_blank" rel="noopener">
            <ld-icon name="ticket" [size]="15" />
            @if (c.priceLabel) {
              {{ 'detail.tickets_from' | translate }} {{ c.priceLabel }}
            } @else {
              {{ 'detail.tickets' | translate }}
            }
          </a>
        </div>
      }
    </div>

    @if (shareToast()) {
      <div class="detail__share-toast">{{ 'share.copied' | translate }}</div>
    }
    }
  `,
  styles: `
    .detail { position: relative; }

    .detail__header {
      background: var(--ld-primary-soft);
      padding: 8px 14px 18px;
    }

    .detail__header--event {
      background: var(--ld-event-soft);
    }

    .detail__header-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }

    .detail__header-actions {
      display: flex;
      gap: 6px;
    }

    .detail__icon-btn {
      width: 34px;
      height: 34px;
      background: var(--ld-surface);
      border: none;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--ld-text);
    }

    .detail__icon-btn--heart {
      color: var(--ld-heart);
    }

    .detail__header-icon {
      text-align: center;
      color: var(--ld-primary);
    }

    .detail__header--event .detail__header-icon {
      color: var(--ld-event);
    }

    .detail__body {
      padding: 14px 16px 100px;
    }

    .detail__title {
      font-size: 19px;
      font-weight: 700;
      margin: 0 0 3px;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .detail__type-label {
      font-size: 12px;
      color: var(--ld-text-3);
      margin: 0 0 2px;
    }

    .detail__meta {
      font-size: 12px;
      color: var(--ld-text-2);
      margin: 0 0 14px;
      display: flex;
      align-items: center;
      gap: 3px;
      flex-wrap: wrap;
    }

    .detail__star { color: var(--ld-warn); }

    .detail__info {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .detail__info-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--ld-text);
      background: none;
      border: none;
      padding: 0;
      text-align: left;
      font-family: inherit;
    }

    .detail__info-row--tap {
      cursor: pointer;
      color: var(--ld-primary);
    }

    .detail__info-icon {
      color: var(--ld-text-3);
      flex-shrink: 0;
    }

    .detail__info-icon--event {
      color: var(--ld-event);
    }

    .detail__countdown {
      margin-left: auto;
      font-size: 12px;
      font-weight: 600;
      color: var(--ld-on-primary-soft);
      background: var(--ld-primary-soft);
      padding: 2px 8px;
      border-radius: var(--ld-radius-chip, 8px);
    }

    .detail__status--open { color: var(--ld-open); font-weight: 500; }
    .detail__status--closed { color: var(--ld-text-2); }
    .detail__status--muted { color: var(--ld-text-3); }

    .detail__actions {
      display: flex;
      gap: 6px;
      margin-top: 12px;
    }

    .detail__action-main {
      flex: 1;
    }

    .detail__geo-hint {
      font-size: 11px;
      color: var(--ld-text-3);
      margin: 8px 0 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .detail__taxi-btn {
      height: 48px;
      padding: 0 12px;
      background: var(--ld-surface);
      border: 1px solid var(--ld-border);
      border-radius: 12px;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      color: var(--ld-text-2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @media (min-width: 1024px) {
      .detail__taxi-btn { display: none; }
    }

    .detail__taxi-label {
      white-space: nowrap;
    }

    .detail__icon-action {
      width: 44px;
      height: 48px;
      background: var(--ld-surface);
      border: 1px solid var(--ld-border);
      border-radius: var(--ld-radius-btn);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--ld-text-2);
    }

    .detail__icon-action--danger { color: var(--ld-danger); }

    .detail__sticky-cta {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 12px 14px;
      background: var(--ld-surface);
      border-top: 1px solid var(--ld-border);
      z-index: 100;
    }

    .detail__ticket-btn {
      width: 100%;
    }

    /* Desktop: hide sticky, adjust padding */
    @media (min-width: 1024px) {
      .detail__body { padding-bottom: 24px; }
      .detail__sticky-cta { position: static; border: none; padding: 0 16px 16px; }
    }

    .detail__share-toast {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ld-text);
      color: var(--ld-bg);
      padding: 10px 20px;
      border-radius: 12px;
      font-size: 13px;
      z-index: 600;
      animation: share-toast-in 200ms ease-out;
    }

    @media (min-width: 1024px) {
      .detail__share-toast { bottom: 32px; }
    }

    @keyframes share-toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `,
})
export class DetailComponent implements OnInit {
  type = input.required<string>();
  id = input.required<string>();
  isModal = input(false);
  preloadedCard = input<RecommendationCard | null>(null);

  private api = inject(ApiService);
  private profileStore = inject(ProfileStore);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private interactions = inject(InteractionService);
  readonly geo = inject(GeolocationService);
  private savedStore = inject(SavedStore);
  readonly hasGps = computed(() => this.geo.position().source === 'gps');

  card = signal<RecommendationCard | null>(null);
  isSaved = signal(false);
  shareToast = signal(false);

  ngOnInit() {
    const preloaded = this.preloadedCard();
    if (preloaded) {
      this.card.set(preloaded);
      this.isSaved.set(this.profileStore.isSaved(preloaded.id));
      return;
    }
    const pos = this.geo.position();
    this.api.getCard(this.type(), this.id(), pos.lat, pos.lng).subscribe((c) => {
      this.card.set(c);
      this.isSaved.set(this.savedStore.isSaved(c.id));
    });
  }

  categoryIcon(c: RecommendationCard): string {
    const map: Record<string, string> = {
      park: 'trees', viewpoint: 'compass', museum: 'masks-theater',
      gallery: 'masks-theater', theater: 'masks-theater', cinema: 'movie',
      restaurant: 'tools-kitchen-2', cafe: 'coffee', bar: 'glass-cocktail',
      club: 'music', gym: 'run', spa: 'coffee', bath: 'coffee',
      music: 'music', exhibition: 'masks-theater', festival: 'balloon',
      entertainment: 'star', workshop: 'star', market: 'star', sports: 'run',
    };
    return map[c.category] ?? 'compass';
  }

  eventTypeLabel(c: RecommendationCard): string {
    const key = `detail.event_type.${c.category}`;
    const translated = this.translate.instant(key);
    // If key not found, fall back to generic event label
    return translated === key ? this.translate.instant('detail.event_badge') : translated;
  }

  whyIcon(type: string): string {
    const map: Record<string, string> = {
      matches_interest: 'trees', pet_friendly: 'dog', company_fit: 'users',
      open_now: 'clock', walk_time: 'clock', highly_rated: 'star',
    };
    return map[type] ?? 'compass';
  }

  badgeClass(type: string): string {
    switch (type) {
      case 'open_now': return 'ld-badge--open';
      case 'pet_friendly':
      case 'company_fit': return 'ld-badge--secondary';
      case 'matches_interest': return 'ld-badge--primary';
      default: return 'ld-badge--primary';
    }
  }

  hasDistance(m: number): boolean {
    return m != null && m > 0;
  }

  formatDistance(m: number): string {
    if (m == null || m <= 0) return '';
    if (m < 1000) return `${Math.round(m)} м`;
    return `${(m / 1000).toFixed(1)} км`;
  }

  showTaxi(c: RecommendationCard): boolean {
    return this.hasDistance(c.distanceM) && c.distanceM > 500;
  }

  onHide() {
    const c = this.card();
    if (!c) return;
    this.profileStore.addHidden(c.id);
    this.interactions.track({ eventType: 'hide', targetType: c.type, targetId: c.id });
    this.goBack();
  }

  formatRatingCount(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return `${count}`;
  }

  isOpen(status: string): boolean {
    return status === 'Открыто' || status === 'Open' || status === 'ღიაა';
  }

  formatEventDateTime(iso: string): string {
    const d = new Date(iso);
    const day = d.getDate();
    const month = d.toLocaleDateString('ru', { month: 'long' });
    const time = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    const weekday = d.toLocaleDateString('ru', { weekday: 'short' });
    return `${weekday}, ${day} ${month}, ${time}`;
  }

  minutesUntil(iso: string): number {
    return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  }

  formatCountdown(mins: number): string {
    const minLabel = this.translate.instant('detail.min');
    if (mins < 60) return `${mins} ${minLabel}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  estimateDuration(startIso: string, endIso: string): string {
    const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
    const minLabel = this.translate.instant('detail.min');
    if (mins < 60) return `${mins} ${minLabel}`;
    const h = Math.round(mins / 60);
    return `${h} ${h === 1 ? 'час' : h < 5 ? 'часа' : 'часов'}`;
  }

  async shareCard(c: RecommendationCard) {
    this.interactions.trackShare(c.type, c.id);
    // OG endpoint returns dynamic preview for messengers, redirects humans to PWA
    const url = `https://api.lazigo.app/v1/og/${c.type}/${c.id}`;
    const text = `${c.title} — ${c.categoryLabel || c.category}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'LaziGo', text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        this.shareToast.set(true);
        setTimeout(() => this.shareToast.set(false), 2500);
      }
    } catch {
      // User cancelled share dialog — ignore
    }
  }

  openRoute(c: RecommendationCard) {
    this.interactions.trackRoute(c.type, c.id);
    let url = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
    if (c.googlePlaceId) url += `&destination_place_id=${c.googlePlaceId}`;
    if (c.distanceM && c.distanceM < 2500) url += '&travelmode=walking';
    window.open(url, '_blank');
  }

  openOnMap(c: RecommendationCard) {
    let url = `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
    if (c.googlePlaceId) url += `&query_place_id=${c.googlePlaceId}`;
    window.open(url, '_blank');
  }

  openYandexTaxi(c: RecommendationCard) {
    this.interactions.trackTaxi(c.type, c.id, 'yandex');
    window.location.href = `yandextaxi://route?end-lat=${c.lat}&end-lon=${c.lng}`;
  }

  openBolt(c: RecommendationCard) {
    this.interactions.trackTaxi(c.type, c.id, 'bolt');
    window.location.href = `bolt://ride/?destination_lat=${c.lat}&destination_lng=${c.lng}&destination_name=${encodeURIComponent(c.title)}`;
  }

  onToggleSave() {
    const c = this.card();
    if (!c) return;
    this.savedStore.toggle(c);
    this.isSaved.set(this.savedStore.isSaved(c.id));
    this.interactions.trackSave(c.type, c.id);
  }

  goBack() {
    history.back();
  }
}
