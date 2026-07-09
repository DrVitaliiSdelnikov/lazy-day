import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SavedStore } from '../../core/stores/saved.store';
import { LdIconComponent } from '../../core/components/ld-icon.component';

@Component({
  selector: 'app-saved',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent],
  template: `
    <div class="saved">
      <div class="saved__header">
        <h1 class="saved__title">{{ 'saved.title' | translate }}</h1>
        <span class="saved__count">{{ savedStore.count() }}</span>
      </div>

      <!-- Segment control -->
      <div class="saved__segments">
        @for (seg of segments; track seg.value) {
          <button class="saved__seg"
            [class.saved__seg--active]="activeSegment() === seg.value"
            (click)="activeSegment.set(seg.value)">{{ seg.labelKey | translate }}</button>
        }
      </div>

      @if (filteredItems().length === 0) {
        <div class="saved__empty">
          <ld-icon name="zzz" [size]="40" class="saved__empty-icon" />
          <h3 class="saved__empty-title">{{ 'saved.empty_title' | translate }}</h3>
          <p class="saved__empty-text">{{ 'saved.empty_text' | translate }}</p>
          <button class="ld-btn ld-btn--secondary" (click)="goToFeed()">{{ 'saved.to_feed' | translate }}</button>
        </div>
      } @else {
        <div class="saved__list">
          @for (item of filteredItems(); track item.id) {
            <div class="saved__card ld-card" (click)="openDetail(item)">
              @if (item.type === 'event') {
                <div class="saved__stripe"></div>
              }
              <div class="saved__card-inner">
                <div class="saved__card-header">
                  <h3 class="saved__card-title">{{ item.title }}</h3>
                  <button class="saved__heart" [attr.aria-label]="'detail.unsave' | translate" (click)="onRemove($event, item.id)">
                    <ld-icon name="heart-filled" [size]="18" />
                  </button>
                </div>
                <p class="saved__card-meta">
                  {{ item.categoryLabel || item.category }}
                  @if (item.rating) {
                    · <ld-icon name="star-filled" [size]="12" class="saved__star" /> {{ item.rating }}
                  }
                  @if (item.openStatus) {
                    · <span [class.saved__open]="isOpen(item.openStatus)"
                            [class.saved__closed]="!isOpen(item.openStatus)">{{ item.openStatus }}</span>
                  }
                </p>
                @if (item.address) {
                  <p class="saved__card-address">{{ item.address }}</p>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .saved {
      padding: var(--ld-space-lg);
      padding-bottom: 80px;
      max-width: 900px;
      margin: 0 auto;
    }

    .saved__header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: var(--ld-space-md);
    }

    .saved__title {
      font-size: 20px;
      font-weight: 700;
    }

    .saved__count {
      font-size: 12px;
      color: var(--ld-text-2);
    }

    .saved__segments {
      display: flex;
      gap: 3px;
      background: var(--ld-surface-2);
      border-radius: 12px;
      padding: 3px;
      margin-bottom: var(--ld-space-lg);
    }

    .saved__seg {
      flex: 1;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      border-radius: 9px;
      background: none;
      color: var(--ld-text-2);
      cursor: pointer;
      font-family: inherit;
    }

    .saved__seg--active {
      background: var(--ld-surface);
      color: var(--ld-on-primary-soft);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .saved__empty {
      text-align: center;
      padding: 48px 16px;
    }

    .saved__empty-icon {
      color: var(--ld-text-3);
      margin-bottom: 12px;
    }

    .saved__empty-title {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .saved__empty-text {
      font-size: 13px;
      color: var(--ld-text-2);
      margin-bottom: 16px;
    }

    .saved__list {
      display: grid;
      gap: 12px;
    }

    @media (min-width: 640px) {
      .saved__list {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .saved__card {
      cursor: pointer;
      display: flex;
      overflow: hidden;
    }

    .saved__stripe {
      width: 4px;
      flex-shrink: 0;
      background: var(--ld-event);
    }

    .saved__card-inner {
      flex: 1;
      padding: 12px 16px;
      min-width: 0;
    }

    .saved__card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .saved__card-title {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .saved__heart {
      background: none;
      border: none;
      color: var(--ld-heart);
      cursor: pointer;
      padding: 2px;
      min-width: 36px;
      min-height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .saved__card-meta {
      font-size: 12px;
      color: var(--ld-text-2);
      margin: 3px 0 0;
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .saved__star { color: var(--ld-warn); }
    .saved__open { color: var(--ld-open); font-weight: 500; }
    .saved__closed { color: var(--ld-danger); font-weight: 500; }

    .saved__card-address {
      font-size: 11px;
      color: var(--ld-text-3);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class SavedComponent {
  readonly savedStore = inject(SavedStore);
  private router = inject(Router);

  activeSegment = signal<'all' | 'place' | 'event'>('all');

  segments = [
    { value: 'all' as const, labelKey: 'saved.all' },
    { value: 'place' as const, labelKey: 'saved.places' },
    { value: 'event' as const, labelKey: 'saved.events' },
  ];

  filteredItems() {
    const seg = this.activeSegment();
    const all = this.savedStore.all();
    if (seg === 'all') return all;
    return all.filter((i) => i.type === seg);
  }

  openDetail(item: { id: string; type: string }) {
    this.router.navigate(['/detail', item.type, item.id]);
  }

  onRemove(event: Event, id: string) {
    event.stopPropagation();
    this.savedStore.remove(id);
  }

  goToFeed() {
    this.router.navigate(['/discover']);
  }

  isOpen(status: string): boolean {
    return status === 'Открыто' || status === 'Open' || status === 'ღიაა';
  }
}
