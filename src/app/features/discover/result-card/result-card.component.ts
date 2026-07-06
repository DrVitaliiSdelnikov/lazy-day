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
        <h3 class="card__title">{{ card().title }}</h3>
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
        <span class="card__category">{{ card().categoryLabel || card().category }}</span>
        <span class="card__dot">&middot;</span>
        <span class="card__distance">{{ formatDistance() }}</span>
        @if (card().openStatus) {
          <span class="card__dot">&middot;</span>
          <span class="card__status">{{ card().openStatus }}</span>
        }
      </div>

      @if (card().explanations.length) {
        <div class="card__explanations">
          @for (tag of card().explanations.slice(0, 3); track tag.type) {
            <p-tag [value]="tag.label" severity="secondary" />
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

    .card__meta {
      display: flex;
      align-items: center;
      gap: var(--ld-space-xs);
      font-size: 13px;
      color: var(--ld-text-secondary);
      margin-top: 2px;
    }

    .card__dot {
      color: var(--ld-divider);
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

  formatDistance(): string {
    const d = this.card().distanceM;
    if (d < 1000) return `${Math.round(d)} м`;
    return `${(d / 1000).toFixed(1)} км`;
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
