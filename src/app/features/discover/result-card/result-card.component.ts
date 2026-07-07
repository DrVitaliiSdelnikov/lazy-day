import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TagModule } from 'primeng/tag';
import { RecommendationCard } from '../../../core/models';

@Component({
  selector: 'app-result-card',
  standalone: true,
  imports: [TagModule, TranslatePipe],
  template: `
    <article class="card" (click)="openDetail.emit()">
      <div class="card__header">
        <div class="card__header-left">
          <h3 class="card__title">{{ card().title }}</h3>
          @if (card().rating) {
            <div class="card__rating">
              <span class="card__star">&#9733;</span>
              <span class="card__rating-value">{{ card().rating }}</span>
              @if (card().ratingCount) {
                <span class="card__rating-count">({{ formatRatingCount() }})</span>
              }
            </div>
          }
        </div>
        <button
          class="card__save"
          [class.card__save--active]="isSaved()"
          (click)="onSaveClick($event)"
          aria-label="Save"
        >
          {{ isSaved() ? '&#9829;' : '&#9825;' }}
        </button>
      </div>

      <div class="card__meta">
        @if (card().type === 'event') {
          <span class="card__event-badge">Event</span>
        }
        <span class="card__category">{{ categoryLabel() }}</span>
        <span class="card__dot">&middot;</span>
        <span class="card__distance">{{ formatDistance() }}</span>
        @if (card().walkMinutes && card().type !== 'event') {
          <span class="card__walk">&#128694; {{ card().walkMinutes }} min</span>
        }
        @if (card().startsAt) {
          <span class="card__dot">&middot;</span>
          <span class="card__event-time">{{ formatEventTime() }}</span>
        }
        @if (card().openStatus) {
          <span class="card__dot">&middot;</span>
          <span class="card__status"
            [class.card__status--open]="isOpen()"
            [class.card__status--closed]="!isOpen()">{{ card().openStatus }}</span>
        }
      </div>

      @if (card().address) {
        <div class="card__address">{{ card().address }}</div>
      }

      @if (card().secondaryTags?.length) {
        <div class="card__secondary">
          @for (tag of card().secondaryTags!.slice(0, 3); track tag) {
            <span class="card__stag">{{ tag }}</span>
          }
        </div>
      }

      @if (card().explanations.length) {
        <div class="card__explanations">
          @for (tag of card().explanations.slice(0, 3); track tag.type) {
            <p-tag [value]="tag.label" [severity]="tagSeverity(tag.type)" />
          }
        </div>
      }

      <div class="card__footer">
        @if (card().priceLabel) {
          <span class="card__price">{{ card().priceLabel }}</span>
        }
        @if (card().timeLabel) {
          <span class="card__time">{{ card().timeLabel }}</span>
        }
        @if (card().status) {
          <p-tag
            [value]="card().status!"
            [severity]="card().status === 'cancelled' ? 'danger' : 'warn'"
          />
        }
      </div>

      <!-- Hide menu -->
      @if (showHideMenu()) {
        <div class="card__hide-menu" (click)="$event.stopPropagation()">
          <button class="hide-option" (click)="onHide('far')">{{ 'hide.far' | translate }}</button>
          <button class="hide-option" (click)="onHide('expensive')">{{ 'hide.expensive' | translate }}</button>
          <button class="hide-option" (click)="onHide('not_mine')">{{ 'hide.not_mine' | translate }}</button>
        </div>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
    }

    .card {
      padding: var(--ld-space-md) var(--ld-space-lg);
      border-bottom: 1px solid var(--ld-divider);
      cursor: pointer;
      transition: background 120ms;
      position: relative;

      &:active {
        background: rgba(0, 0, 0, 0.03);
      }
    }

    @media (min-width: 640px) {
      .card {
        border: 1px solid var(--ld-divider);
        border-radius: var(--ld-radius-md, 12px);
        border-bottom: 1px solid var(--ld-divider);
      }
    }

    .card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--ld-space-sm);
    }

    .card__title {
      font-size: 17px;
      font-weight: 500;
      line-height: 22px;
      color: var(--ld-text);
    }

    .card__save {
      background: none;
      border: none;
      font-size: 20px;
      color: var(--ld-text-secondary);
      cursor: pointer;
      padding: 4px;
      min-width: 48px;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;

      &--active {
        color: var(--ld-error);
      }
    }

    .card__header-left {
      flex: 1;
      min-width: 0;
    }

    .card__rating {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 13px;
      margin-top: 1px;
    }

    .card__star {
      color: #f5a623;
      font-size: 14px;
    }

    .card__rating-value {
      font-weight: 600;
      color: var(--ld-text);
    }

    .card__rating-count {
      color: var(--ld-text-secondary);
      font-weight: 400;
    }

    .card__meta {
      display: flex;
      align-items: center;
      gap: var(--ld-space-xs);
      font-size: 13px;
      color: var(--ld-text-secondary);
      margin-top: 4px;
    }

    .card__walk {
      font-size: 12px;
    }

    .card__dot {
      color: var(--ld-divider);
    }

    .card__status--open {
      color: #2e7d32;
      font-weight: 500;
    }

    .card__status--closed {
      color: #c62828;
      font-weight: 500;
    }

    .card__event-badge {
      background: var(--ld-primary, #6366f1);
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .card__event-time {
      font-weight: 500;
      color: var(--ld-primary, #6366f1);
    }

    .card__address {
      font-size: 12px;
      color: var(--ld-text-secondary);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card__secondary {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }

    .card__stag {
      font-size: 11px;
      color: var(--ld-text-secondary);
      background: rgba(0,0,0,0.05);
      padding: 1px 6px;
      border-radius: 4px;
    }

    .card__explanations {
      display: flex;
      gap: var(--ld-space-xs);
      flex-wrap: wrap;
      margin-top: var(--ld-space-sm);
    }

    .card__footer {
      display: flex;
      align-items: center;
      gap: var(--ld-space-sm);
      margin-top: var(--ld-space-sm);
      font-size: 14px;
    }

    .card__price {
      font-weight: 500;
    }

    .card__time {
      color: var(--ld-text-secondary);
    }

    .card__hide-menu {
      position: absolute;
      right: var(--ld-space-lg);
      top: 50%;
      transform: translateY(-50%);
      background: var(--ld-card-bg);
      border: 1px solid var(--ld-divider);
      border-radius: var(--ld-radius-sm);
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      z-index: 10;
      overflow: hidden;
    }

    .hide-option {
      display: block;
      width: 100%;
      padding: 10px 16px;
      border: none;
      background: none;
      color: var(--ld-text);
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      min-height: 44px;

      &:hover {
        background: rgba(0,0,0,0.04);
      }

      &:not(:last-child) {
        border-bottom: 1px solid var(--ld-divider);
      }
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

  tagSeverity(type: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (type) {
      case 'open_now': return 'success';
      case 'company_fit': return 'info';
      case 'pet_friendly': return 'info';
      case 'matches_interest': return 'secondary';
      case 'highly_rated': return 'warn';
      default: return 'secondary';
    }
  }

  onSaveClick(event: Event) {
    event.stopPropagation();
    this.toggleSave.emit();
  }

  onHide(reason: string) {
    this.showHideMenu.set(false);
    this.hideCard.emit();
  }

  // Long press to show hide menu (simple version: context menu)
  onContextMenu(event: Event) {
    event.preventDefault();
    this.showHideMenu.set(true);
    setTimeout(() => this.showHideMenu.set(false), 5000);
  }
}
