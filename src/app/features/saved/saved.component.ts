import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SavedStore } from '../../core/stores/saved.store';

@Component({
  selector: 'app-saved',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="saved">
      <h1 class="saved__title">{{ 'saved.title' | translate }}</h1>

      @if (savedStore.count() === 0) {
        <div class="saved__empty">
          <p>{{ 'saved.empty' | translate }}</p>
        </div>
      } @else {
        <div class="saved__list">
          @for (item of savedStore.all(); track item.id) {
            <div class="saved__item" (click)="openDetail(item)">
              <div class="saved__item-header">
                <h3 class="saved__item-title">{{ item.title }}</h3>
                <button class="saved__remove" (click)="onRemove($event, item.id)">&times;</button>
              </div>
              <div class="saved__item-meta">
                <span>{{ item.categoryLabel || item.category }}</span>
                @if (item.rating) {
                  <span> &middot; &#9733; {{ item.rating }}</span>
                }
                @if (item.openStatus) {
                  <span> &middot; </span>
                  <span [style.color]="isOpen(item.openStatus) ? '#2e7d32' : '#c62828'"
                        [style.font-weight]="'500'">{{ item.openStatus }}</span>
                }
                @if (item.priceLabel) {
                  <span> &middot; {{ item.priceLabel }}</span>
                }
              </div>
              @if (item.address) {
                <div class="saved__item-address">{{ item.address }}</div>
              }
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
    }

    .saved__title {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: var(--ld-space-lg);
    }

    .saved__empty {
      text-align: center;
      padding: var(--ld-space-xl);
      color: var(--ld-text-secondary);
    }

    .saved__item {
      padding: var(--ld-space-md) 0;
      border-bottom: 1px solid var(--ld-divider);
      cursor: pointer;
    }

    .saved__item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .saved__item-title {
      font-size: 17px;
      font-weight: 500;
      line-height: 22px;
    }

    .saved__remove {
      background: none;
      border: none;
      font-size: 20px;
      color: var(--ld-text-secondary);
      cursor: pointer;
      padding: 4px 8px;
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .saved__item-meta {
      font-size: 13px;
      color: var(--ld-text-secondary);
      margin-top: 2px;
    }

    .saved__item-address {
      font-size: 13px;
      color: var(--ld-text-secondary);
      margin-top: 2px;
    }
  `,
})
export class SavedComponent {
  readonly savedStore = inject(SavedStore);
  private router = inject(Router);

  openDetail(item: { id: string; type: string }) {
    this.router.navigate(['/detail', item.type, item.id]);
  }

  onRemove(event: Event, id: string) {
    event.stopPropagation();
    this.savedStore.remove(id);
  }

  isOpen(status: string): boolean {
    return status === 'Открыто' || status === 'Open' || status === 'ღიაა';
  }
}
