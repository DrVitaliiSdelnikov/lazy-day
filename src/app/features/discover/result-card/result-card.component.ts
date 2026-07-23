import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RecommendationCard } from '../../../core/models';
import { LdIconComponent } from '../../../core/components/ld-icon.component';

@Component({
  selector: 'app-result-card',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent],
  template: `
    <article class="card ld-card" [class.card--event]="card().type === 'event'" [class.card--place]="card().type === 'place'" (click)="openDetail.emit()">
      <div class="card__stripe"></div>
      @if (cardImage() && !brokenImage()) {
        <img class="card__thumb" [src]="cardImage()" alt="" loading="lazy" (error)="brokenImage.set(true)" />
      }
      <div class="card__inner">
        <!-- Slot 1: title + save -->
        <div class="card__header">
          @if (card().type === 'event') {
            <ld-icon name="ticket" [size]="16" class="card__ticket-icon" />
          }
          <h2 class="card__title">{{ card().title }}</h2>
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

        <!-- Slot 2: meta line -->
        <p class="card__meta">
          @if (card().type === 'event') {
            {{ eventLabel() }}
            @if (formatEventTime()) {
              · <span class="card__event-time">{{ formatEventTime() }}</span>
            }
          } @else {
            {{ categoryLabel() }}
            @if (hasDistance()) {
              · {{ formatDistance() }}
            }
            @if (card().rating) {
              · <span class="card__rating-inline">★ {{ card().rating }}@if (card().ratingCount) { ({{ formatRatingCount() }})}</span>
            }
            @if (crossInterest()) {
              · <span class="card__cross">{{ crossInterest() }}</span>
            }
          }
        </p>

        <!-- Explanations (compact inline) -->
        @if (explanationLine()) {
          <p class="card__why">{{ explanationLine() }}</p>
        }

        <!-- Slot 3: status (always one line) -->
        <div class="card__status" [class]="'card__status--' + statusTone()">
          @if (card().type === 'event') {
            <ld-icon name="clock" [size]="12" />
            <span>{{ eventStatus() }}</span>
          } @else if (card().openStatus) {
            <span class="card__status-dot"></span>
            <span>{{ card().openStatus }}</span>
          } @else {
            <ld-icon name="clock-off" [size]="12" />
            <span>{{ 'card.hours_unknown' | translate }}</span>
          }
        </div>
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

    .card--event,
    .card--place {
      display: flex;
    }

    .card__stripe {
      width: 4px;
      flex-shrink: 0;
      border-radius: var(--ld-radius-card) 0 0 var(--ld-radius-card);
    }

    .card--event .card__stripe {
      background: var(--ld-event);
    }

    .card--place .card__stripe {
      background: var(--ld-primary);
    }

    .theme-evening .card__stripe { width: 5px; }

    .card__thumb {
      width: 72px;
      height: 72px;
      object-fit: cover;
      flex-shrink: 0;
      border-radius: 8px;
      margin: 10px 0 10px 10px;
      background: var(--ld-surface-2, #f0f0f0);
    }

    @media (min-width: 1024px) {
      .card__thumb {
        width: 88px;
        height: 88px;
      }
    }

    .card__inner {
      flex: 1;
      padding: 14px 16px;
      min-width: 0;
    }

    .card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
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
      margin: 4px 0 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card__ticket-icon {
      color: var(--ld-event);
      flex-shrink: 0;
    }

    .card__event-time {
      color: var(--ld-event);
      font-weight: 500;
    }

    .card__rating-inline {
      color: var(--ld-warn);
      font-weight: 500;
    }

    .card__cross {
      color: var(--ld-text-3);
      font-style: italic;
    }

    .card__why {
      font-size: 11px;
      color: var(--ld-secondary);
      margin: 4px 0 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card__status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      margin-top: 12px;

      &--success {
        color: var(--ld-open);
      }
      &--warning {
        color: var(--ld-warn);
      }
      &--muted {
        color: var(--ld-text-3);
      }
      &--secondary {
        color: var(--ld-text-2);
      }
    }

    .card__status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
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
  brokenImage = signal(false);

  cardImage(): string | null {
    return this.card().posterUrl || this.card().photoUrl || null;
  }

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

  hasDistance(): boolean {
    const d = this.card().distanceM;
    return d != null && d > 0;
  }

  formatDistance(): string {
    const d = this.card().distanceM;
    if (d == null || d <= 0) return '';
    if (d < 1000) return `${Math.round(d)} м`;
    return `${(d / 1000).toFixed(1)} км`;
  }

  formatRatingCount(): string {
    const c = this.card().ratingCount ?? 0;
    if (c >= 1000) return `${(c / 1000).toFixed(1)}k`;
    return `${c}`;
  }

  crossInterest(): string | null {
    const expl = this.card().explanations ?? [];
    const also = expl.find(e => e.type === 'also_has');
    return also?.label ?? null;
  }

  /** Compact one-liner from explanations. Skips walk_time (already in meta) and also_has (in meta). */
  explanationLine(): string | null {
    const expl = this.card().explanations ?? [];
    const skip = new Set(['walk_time', 'also_has']);
    const parts = expl.filter(e => !skip.has(e.type)).map(e => e.label);
    if (!parts.length) {
      return this.card().whyLabel ?? null;
    }
    const line = this.card().whyLabel
      ? [this.card().whyLabel, ...parts].join(' · ')
      : parts.join(' · ');
    return line;
  }

  statusTone(): string {
    if (this.card().type === 'event') {
      const s = this.card().startsAt;
      if (!s) return 'secondary';
      const mins = (new Date(s).getTime() - Date.now()) / 60000;
      return mins < 180 ? 'warning' : 'secondary';
    }
    const s = this.card().openStatus;
    if (!s) return 'muted';
    if (s === 'Открыто' || s === 'Open' || s === 'ღიაა') return 'success';
    if (s === 'Закрыто' || s === 'Closed' || s === 'დახურულია') return 'secondary';
    return 'muted';
  }

  eventStatus(): string {
    const s = this.card().startsAt;
    if (!s) return '';
    const d = new Date(s);
    const mins = (d.getTime() - Date.now()) / 60000;
    if (mins < 0) return this.formatEventTime();
    if (mins < 60) return `Через ${Math.round(mins)} мин`;
    if (mins < 180) {
      const h = Math.floor(mins / 60);
      const m = Math.round(mins % 60);
      return `Через ${h}:${String(m).padStart(2, '0')}`;
    }
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return `Сегодня в ${d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    }
    return this.formatEventTime();
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
