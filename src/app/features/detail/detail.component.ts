import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ProfileStore } from '../../core/stores/profile.store';
import { apiProviders } from '../../core/providers';
import { RecommendationCard } from '../../core/models';
import { LdIconComponent } from '../../core/components/ld-icon.component';

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
          <button class="detail__icon-btn" (click)="goBack()" aria-label="Back">
            <ld-icon name="arrow-left" [size]="16" />
          </button>
          <div class="detail__header-actions">
            <button class="detail__icon-btn" aria-label="Share">
              <ld-icon name="share-2" [size]="15" />
            </button>
            <button class="detail__icon-btn" [class.detail__icon-btn--heart]="isSaved()"
              (click)="onToggleSave()" [attr.aria-label]="isSaved() ? 'Unsave' : 'Save'">
              <ld-icon [name]="isSaved() ? 'heart-filled' : 'heart'" [size]="16" />
            </button>
          </div>
        </div>
        <div class="detail__header-icon">
          <ld-icon [name]="categoryIcon(c)" [size]="38" />
        </div>
      </div>

      <!-- Content -->
      <div class="detail__body">
        @if (c.type === 'event') {
          <span class="ld-badge ld-badge--event" style="margin-bottom: 8px">Событие · {{ eventTypeLabel(c) }}</span>
        }

        <h1 class="detail__title">{{ c.title }}</h1>
        <p class="detail__meta">
          {{ c.categoryLabel || c.category }} · {{ formatDistance(c.distanceM) }}
          @if (c.walkMinutes) { · {{ c.walkMinutes }} мин }
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
                  <p class="detail__date-sub">длится ~{{ estimateDuration(c.startsAt, c.endsAt) }}</p>
                }
              </div>
              @if (minutesUntil(c.startsAt); as mins) {
                @if (mins > 0 && mins <= 180) {
                  <span class="ld-badge" style="background: var(--ld-glow-soft, var(--ld-primary-soft)); color: var(--ld-on-glow-soft, var(--ld-on-primary-soft))">
                    Через {{ formatCountdown(mins) }}
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
            <p class="detail__card-title">Почему это вам</p>
            @for (tag of c.explanations; track tag.type) {
              <p class="detail__why-line">
                <ld-icon [name]="whyIcon(tag.type)" [size]="13" [class]="'detail__why-icon detail__why-icon--' + tag.type" />
                {{ tag.label }}
              </p>
            }
          </div>
        }

        <!-- Address -->
        @if (c.address) {
          <div class="detail__card">
            <p class="detail__address">
              <ld-icon name="map-pin" [size]="13" class="detail__addr-icon" /> {{ c.address }}
            </p>
          </div>
        }

        @if (c.type === 'event' && c.venueName) {
          <div class="detail__card">
            <p class="detail__address">
              <ld-icon name="map-pin" [size]="13" class="detail__addr-icon" /> {{ c.venueName }}
            </p>
          </div>
        }

        <!-- Event: price -->
        @if (c.priceLabel) {
          <div class="detail__card detail__price-row">
            <span style="color: var(--ld-text-2); font-size: 12px">Билеты</span>
            <span style="font-weight: 700; font-size: 12px">{{ c.priceLabel }}</span>
          </div>
        }

        <!-- Actions (mobile) -->
        <div class="detail__actions">
          <a class="ld-btn ld-btn--primary detail__action-main" [href]="venueMapUrl(c)" target="_blank" rel="noopener">
            <ld-icon name="route" [size]="14" /> Маршрут
          </a>
          <button class="detail__icon-action" aria-label="Share">
            <ld-icon name="share-2" [size]="15" />
          </button>
          <button class="detail__icon-action detail__icon-action--danger" aria-label="Hide">
            <ld-icon name="eye-off" [size]="15" />
          </button>
        </div>
      </div>

      <!-- Event: sticky ticket CTA -->
      @if (c.type === 'event' && (c.ticketUrl || c.externalUrl)) {
        <div class="detail__sticky-cta">
          <a class="ld-btn ld-btn--primary detail__ticket-btn" [href]="c.ticketUrl || c.externalUrl" target="_blank" rel="noopener">
            <ld-icon name="ticket" [size]="15" />
            Билеты{{ c.priceLabel ? ' от ' + c.priceLabel : '' }}
            @if (c.source) { · {{ c.source }} }
          </a>
        </div>
      }
    </div>
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

    .detail__address {
      font-size: 12px;
      color: var(--ld-text-2);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .detail__addr-icon { color: var(--ld-primary); }

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
  `,
})
export class DetailComponent implements OnInit {
  type = input.required<string>();
  id = input.required<string>();

  private api = inject(ApiService);
  private profileStore = inject(ProfileStore);
  private router = inject(Router);

  card = signal<RecommendationCard | null>(null);
  isSaved = signal(false);

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
    const map: Record<string, string> = {
      music: 'Концерт', theater: 'Театр', exhibition: 'Выставка',
      festival: 'Фестиваль', entertainment: 'Событие', workshop: 'Мастер-класс',
    };
    return map[c.category] ?? 'Событие';
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
    if (mins < 60) return `${mins} мин`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  estimateDuration(startIso: string, endIso: string): string {
    const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
    if (mins < 60) return `${mins} мин`;
    const h = Math.round(mins / 60);
    return `${h} ${h === 1 ? 'час' : h < 5 ? 'часа' : 'часов'}`;
  }

  venueMapUrl(c: RecommendationCard): string {
    if (c.type === 'event' && c.venueName) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.venueName + ' Tbilisi')}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.title)}&center=${c.lat},${c.lng}`;
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
