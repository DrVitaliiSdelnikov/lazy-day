import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ProfileStore } from '../../core/stores/profile.store';
import { apiProviders } from '../../core/providers';
import { RecommendationCard } from '../../core/models';
import { LdIconComponent } from '../../core/components/ld-icon.component';
import { InteractionService } from '../../core/services/interaction.service';

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
        @if (c.type === 'event') {
          <span class="ld-badge ld-badge--event" style="margin-bottom: 8px">{{ 'detail.event_badge' | translate }} · {{ eventTypeLabel(c) }}</span>
        }

        <h1 class="detail__title">{{ c.title }}</h1>
        <p class="detail__meta">
          {{ c.categoryLabel || c.category }} · {{ formatDistance(c.distanceM) }}
          @if (c.walkMinutes) { · {{ c.walkMinutes }} {{ 'detail.min' | translate }} }
          @if (c.rating) {
            · <ld-icon name="star-filled" [size]="12" class="detail__star" /> {{ c.rating }}
            @if (c.ratingCount) { ({{ formatRatingCount(c.ratingCount) }}) }
          }
        </p>

        <!-- Event: date block -->
        @if (c.type === 'event' && c.startsAt) {
          <div class="detail__card">
            <div class="detail__date-row">
              <div>
                <p class="detail__date-title">{{ formatEventDateTime(c.startsAt) }}</p>
                @if (c.endsAt) {
                  <p class="detail__date-sub">{{ 'detail.duration' | translate }}{{ estimateDuration(c.startsAt, c.endsAt) }}</p>
                }
              </div>
              @if (minutesUntil(c.startsAt); as mins) {
                @if (mins > 0 && mins <= 180) {
                  <span class="ld-badge" style="background: var(--ld-glow-soft, var(--ld-primary-soft)); color: var(--ld-on-glow-soft, var(--ld-on-primary-soft))">
                    {{ 'detail.in_time' | translate }} {{ formatCountdown(mins) }}
                  </span>
                }
              }
            </div>
          </div>
        }

        <!-- Badges -->
        <div class="detail__badges">
          @if (c.openStatus) {
            <span class="ld-badge" [class.ld-badge--open]="isOpen(c.openStatus)" [class.ld-badge--closed]="!isOpen(c.openStatus)">
              {{ c.openStatus }}
            </span>
          }
          @for (tag of c.explanations?.slice(0, 3); track tag.type) {
            <span class="ld-badge" [class]="badgeClass(tag.type)">{{ tag.label }}</span>
          }
        </div>

        <!-- Why this -->
        @if (c.explanations?.length) {
          <div class="detail__card">
            <p class="detail__card-title">{{ 'detail.why_recommended' | translate }}</p>
            @for (tag of c.explanations; track tag.type) {
              <p class="detail__why-line">
                <ld-icon [name]="whyIcon(tag.type)" [size]="13" [class]="'detail__why-icon detail__why-icon--' + tag.type" />
                {{ tag.label }}
              </p>
            }
          </div>
        }

        <!-- Address -->
        <div class="detail__card">
          <div class="detail__address-row">
            <p class="detail__address">
              <ld-icon name="map-pin" [size]="13" class="detail__addr-icon" />
              {{ c.address || c.venueName || ('detail.show_on_map' | translate) }}
            </p>
            <button class="ld-btn ld-btn--ghost detail__map-link" (click)="openOnMap(c)">{{ 'detail.on_map' | translate }}</button>
          </div>
        </div>

        <!-- Event: price -->
        @if (c.priceLabel) {
          <div class="detail__card detail__price-row">
            <span style="color: var(--ld-text-2); font-size: 12px">{{ 'detail.tickets' | translate }}</span>
            <span style="font-weight: 700; font-size: 12px">{{ c.priceLabel }}</span>
          </div>
        }

        <!-- Actions -->
        <div class="detail__actions">
          <button class="ld-btn ld-btn--primary detail__action-main" (click)="openRoute(c)">
            <ld-icon name="route" [size]="14" /> {{ 'detail.route' | translate }}
          </button>
          <button class="detail__taxi-btn" (click)="openYandexTaxi(c)" aria-label="Yandex Go">
            <span class="detail__taxi-label">Такси</span>
          </button>
          <button class="detail__icon-action" (click)="shareCard(c)" [attr.aria-label]="'detail.share' | translate">
            <ld-icon name="share-2" [size]="15" />
          </button>
          <button class="detail__icon-action detail__icon-action--danger" [attr.aria-label]="'detail.hide' | translate">
            <ld-icon name="eye-off" [size]="15" />
          </button>
        </div>
      </div>

      <!-- Event: sticky ticket CTA -->
      @if (c.type === 'event' && (c.ticketUrl || c.externalUrl)) {
        <div class="detail__sticky-cta">
          <a class="ld-btn ld-btn--primary detail__ticket-btn" [href]="c.ticketUrl || c.externalUrl" target="_blank" rel="noopener">
            <ld-icon name="ticket" [size]="15" />
            {{ 'detail.tickets_from' | translate }}{{ c.priceLabel ? ' ' + c.priceLabel : '' }}
            @if (c.source) { · {{ c.source }} }
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
    }

    .detail__meta {
      font-size: 12px;
      color: var(--ld-text-2);
      margin: 0 0 10px;
      display: flex;
      align-items: center;
      gap: 3px;
      flex-wrap: wrap;
    }

    .detail__star { color: var(--ld-warn); }

    .detail__badges {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .detail__card {
      background: var(--ld-surface);
      border: 1px solid var(--ld-border);
      border-radius: 16px;
      padding: 12px;
      margin-bottom: 8px;
    }

    .detail__card-title {
      font-size: 13px;
      font-weight: 700;
      margin: 0 0 8px;
    }

    .detail__why-line {
      font-size: 12px;
      margin: 0 0 6px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .detail__why-line:last-child { margin-bottom: 0; }

    .detail__why-icon--matches_interest,
    .detail__why-icon--pet_friendly,
    .detail__why-icon--company_fit { color: var(--ld-secondary); }
    .detail__why-icon--open_now,
    .detail__why-icon--walk_time { color: var(--ld-primary); }
    .detail__why-icon--highly_rated { color: var(--ld-warn); }

    .detail__address-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .detail__address {
      font-size: 12px;
      color: var(--ld-text-2);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .detail__addr-icon { color: var(--ld-primary); }

    .detail__map-link {
      font-size: 12px;
      color: var(--ld-primary);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .detail__date-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .detail__date-title {
      font-size: 13px;
      font-weight: 700;
      margin: 0;
    }

    .detail__date-sub {
      font-size: 11px;
      color: var(--ld-text-2);
      margin: 2px 0 0;
    }

    .detail__price-row {
      display: flex;
      justify-content: space-between;
    }

    .detail__actions {
      display: flex;
      gap: 6px;
      margin-top: 12px;
    }

    .detail__action-main {
      flex: 1;
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

  private api = inject(ApiService);
  private profileStore = inject(ProfileStore);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private interactions = inject(InteractionService);

  card = signal<RecommendationCard | null>(null);
  isSaved = signal(false);
  shareToast = signal(false);

  ngOnInit() {
    this.api.getCard(this.type(), this.id()).subscribe((c) => {
      this.card.set(c);
      this.isSaved.set(this.profileStore.isSaved(c.id));
    });
  }

  categoryIcon(c: RecommendationCard): string {
    const map: Record<string, string> = {
      park: 'trees', viewpoint: 'compass', museum: 'masks-theater',
      gallery: 'masks-theater', theater: 'masks-theater', cinema: 'movie',
      restaurant: 'tools-kitchen-2', cafe: 'coffee', bar: 'glass-cocktail',
      club: 'music', gym: 'run', spa: 'dog', bath: 'dog',
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

  formatDistance(m: number): string {
    if (m < 1000) return `${Math.round(m)} м`;
    return `${(m / 1000).toFixed(1)} км`;
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
    const url = `https://lazigo.app/detail/${c.type}/${c.id}`;
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
    window.location.href = `bolt://ride?destination_lat=${c.lat}&destination_lng=${c.lng}`;
  }

  onToggleSave() {
    const c = this.card();
    if (!c) return;
    this.profileStore.toggleSaved(c.id);
    this.isSaved.set(this.profileStore.isSaved(c.id));
  }

  goBack() {
    history.back();
  }
}
