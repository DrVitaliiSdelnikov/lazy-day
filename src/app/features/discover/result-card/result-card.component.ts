import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RecommendationCard } from '../../../core/models';
import { LdIconComponent } from '../../../core/components/ld-icon.component';

@Component({
  selector: 'app-result-card',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent],
  template: `
    <article class="card ld-card" [class.card--event]="card().type === 'event'" (click)="openDetail.emit()">
      @if (card().type === 'event') {
        <div class="card__stripe"></div>
      }
      <div class="card__inner">
        <!-- Header: title + save -->
        <div class="card__header">
          <h3 class="card__title">{{ card().title }}</h3>
          @if (card().type === 'event') {
            <ld-icon name="ticket" [size]="18" class="card__ticket-icon" />
          }
          <button class="card__hide-btn" (click)="onHideClick($event)"
            [attr.aria-label]="'detail.hide' | translate">
            <ld-icon name="eye-off" [size]="15" />
          </button>
          <button
            class="card__heart"
            [class.card__heart--saved]="isSaved()"
            (click)="onSaveClick($event)"
            [attr.aria-label]="isSaved() ? 'Unsave' : 'Save'">
            <ld-icon [name]="isSaved() ? 'heart-filled' : 'heart'" [size]="18" />
          </button>
        </div>

        <!-- Meta line -->
        <p class="card__meta">
          {{ card().type === 'event' ? eventLabel() : categoryLabel() }}
          · {{ formatDistance() }}
          @if (card().walkMinutes && card().type !== 'event') {
            · {{ card().walkMinutes }} {{ 'detail.min' | translate }}
          }
          @if (card().startsAt) {
            · <span class="card__event-time">{{ formatEventTime() }}</span>
          }
        </p>

        <!-- Badges row -->
        <div class="card__badges">
          @if (card().openStatus) {
            <span class="ld-badge" [class.ld-badge--open]="isOpen()" [class.ld-badge--closed]="!isOpen()">
              {{ card().openStatus }}
            </span>
          }
          @for (tag of card().explanations.slice(0, 3); track tag.type) {
            <span class="ld-badge" [class]="badgeClass(tag.type)">{{ tag.label }}</span>
          }
        </div>

        <!-- Rating -->
        @if (card().rating) {
          <p class="card__rating tabular-nums">
            <ld-icon name="star-filled" [size]="13" class="card__star" />
            {{ card().rating }}
            @if (card().ratingCount) {
              <span class="card__rating-count">({{ formatRatingCount() }})</span>
            }
          </p>
        }
      </div>
    </article>
  `,
  styles: `
    :host { display: block; overflow: hidden; max-width: 100%; }

    .card {
      cursor: pointer;
      position: relative;
      overflow: hidden;
      padding: 0;

      &:active { transform: scale(0.98); }
    }

    .card--event {
      display: flex;
    }

    .card__stripe {
      width: 4px;
      flex-shrink: 0;
      background: var(--ld-event);
    }

    .theme-evening .card__stripe { width: 5px; }

    .card__inner {
      flex: 1;
      padding: 14px 16px;
      min-width: 0;
    }

    .card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .card__title {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--ld-text);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 1;
    }

    .card__hide-btn {
      display: none;
      background: none;
      border: none;
      color: var(--ld-text-3);
      cursor: pointer;
      padding: 2px;
      min-width: 32px;
      min-height: 32px;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 150ms;
    }

    @media (min-width: 1024px) {
      .card__hide-btn { display: flex; }
      .card:hover .card__hide-btn { opacity: 1; }
    }

    .card__heart {
      background: none;
      border: none;
      font-size: 18px;
      color: var(--ld-text-3);
      cursor: pointer;
      padding: 2px;
      min-width: 36px;
      min-height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 150ms;

      &--saved {
        color: var(--ld-heart);
        animation: heart-pop 300ms ease;
      }

      &:active { transform: scale(1.2); }
    }

    @keyframes heart-pop {
      0% { transform: scale(1); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }

    .card__meta {
      font-size: 11px;
      color: var(--ld-text-2);
      margin: 3px 0 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card__ticket-icon {
      color: var(--ld-event);
    }

    .card__event-time {
      color: var(--ld-event);
      font-weight: 500;
    }

    .card__badges {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .card__rating {
      font-size: 12px;
      margin: 0;
      color: var(--ld-text);
    }

    .card__star {
      color: var(--ld-warn);
      font-size: 13px;
    }

    .card__rating-count {
      color: var(--ld-text-2);
    }
  `,
})
export class ResultCardComponent {
  card = input.required<RecommendationCard>();
  isSaved = input(false);
  openDetail = output<void>();
  toggleSave = output<void>();
  hideCard = output<void>();

  showHideMenu = signal(false);

  private readonly CATEGORY_LABELS: Record<string, string> = {
    restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar', park: 'Park',
    viewpoint: 'Viewpoint', museum: 'Museum', gallery: 'Gallery',
    theater: 'Theater', cinema: 'Cinema', club: 'Club', mall: 'Mall',
    bakery: 'Bakery', gym: 'Gym', spa: 'Spa', bath: 'Bath',
  };

  categoryLabel(): string {
    return this.card().categoryLabel || this.CATEGORY_LABELS[this.card().category] || this.card().category;
  }

  eventLabel(): string {
    const labels: Record<string, string> = {
      music: 'Concert', theater: 'Theater', exhibition: 'Exhibition',
      festival: 'Festival', sports: 'Sport', entertainment: 'Event',
      workshop: 'Workshop', market: 'Market', family: 'Family',
    };
    return labels[this.card().category] ?? 'Event';
  }

  formatEventTime(): string {
    const s = this.card().startsAt;
    if (!s) return '';
    const d = new Date(s);
    const day = d.getDate();
    const month = d.toLocaleDateString('en', { month: 'short' });
    const time = d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} ${month} ${time}`;
  }

  formatDistance(): string {
    const d = this.card().distanceM;
    if (d < 1000) return `${Math.round(d)} м`;
    return `${(d / 1000).toFixed(1)} км`;
  }

  formatRatingCount(): string {
    const c = this.card().ratingCount ?? 0;
    if (c >= 1000) return `${(c / 1000).toFixed(1)}k`;
    return `${c}`;
  }

  isOpen(): boolean {
    const s = this.card().openStatus;
    return s === 'Открыто' || s === 'Open' || s === 'ღიაა';
  }

  badgeClass(type: string): string {
    switch (type) {
      case 'open_now': return 'ld-badge--open';
      case 'company_fit':
      case 'pet_friendly': return 'ld-badge--secondary';
      case 'matches_interest': return 'ld-badge--primary';
      case 'highly_rated': return 'ld-badge--primary';
      case 'also_has': return 'ld-badge--event';
      default: return 'ld-badge--primary';
    }
  }

  onSaveClick(event: Event) {
    event.stopPropagation();
    this.toggleSave.emit();
  }

  onHideClick(event: Event) {
    event.stopPropagation();
    this.hideCard.emit();
  }

  onHide(reason: string) {
    this.showHideMenu.set(false);
    this.hideCard.emit();
  }
}
