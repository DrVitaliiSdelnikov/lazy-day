import { Component, inject, input, output, signal, computed } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RecommendationCard } from '../../../core/models';
import { LdIconComponent } from '../../../core/components/ld-icon.component';
import { InteractionService } from '../../../core/services/interaction.service';
import { SavedStore } from '../../../core/stores/saved.store';

@Component({
  selector: 'app-decide-for-me',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent],
  template: `
    <div class="dfm" (click)="$event.stopPropagation()">
      <div class="dfm__backdrop" (click)="close.emit()"></div>

      <div class="dfm__card">
        <!-- Close -->
        <button class="dfm__close" (click)="close.emit()">
          <ld-icon name="x" [size]="16" />
        </button>

        <!-- Header -->
        <div class="dfm__header" [class.dfm__header--event]="current().type === 'event'">
          <p class="dfm__label">{{ 'decide.tonight' | translate }}</p>
        </div>

        <!-- Content -->
        <div class="dfm__body">
          <h1 class="dfm__title">{{ current().title }}</h1>
          <p class="dfm__meta">
            {{ current().categoryLabel || current().category }}
            · {{ formatDistance(current().distanceM) }}
            @if (current().walkMinutes) { · {{ current().walkMinutes }} {{ 'detail.min' | translate }} }
            @if (current().rating) {
              · <ld-icon name="star-filled" [size]="12" class="dfm__star" /> {{ current().rating }}
            }
          </p>

          @if (current().openStatus) {
            <span class="ld-badge ld-badge--open" style="margin: 8px 0">{{ current().openStatus }}</span>
          }

          <!-- Why here -->
          @if (current().explanations?.length) {
            <div class="dfm__why">
              <p class="dfm__why-title">{{ 'decide.why' | translate }}</p>
              @for (tag of current().explanations.slice(0, 4); track tag.type) {
                <p class="dfm__why-line">{{ tag.label }}</p>
              }
            </div>
          }

          <!-- Actions -->
          <div class="dfm__actions">
            <button class="ld-btn ld-btn--primary dfm__route" (click)="onRoute()">
              <ld-icon name="route" [size]="14" /> {{ 'detail.route' | translate }}
            </button>
            <button class="dfm__icon-btn" (click)="onShare()" [attr.aria-label]="'detail.share' | translate">
              <ld-icon name="share-2" [size]="16" />
            </button>
            <button class="dfm__icon-btn" [class.dfm__icon-btn--saved]="isSaved()"
              (click)="onSave()" [attr.aria-label]="'detail.save' | translate">
              <ld-icon [name]="isSaved() ? 'heart-filled' : 'heart'" [size]="16" />
            </button>
          </div>

          <!-- Another / Show feed -->
          <div class="dfm__bottom">
            @if (canShowAnother()) {
              <button class="ld-btn ld-btn--ghost dfm__another" (click)="onAnother()">
                {{ 'decide.another' | translate }} ({{ maxAttempts - attempt() }})
              </button>
            } @else {
              <button class="ld-btn ld-btn--ghost dfm__another" (click)="close.emit()">
                {{ 'decide.no_more' | translate }}
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .dfm {
      position: fixed;
      inset: 0;
      z-index: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dfm__backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.5);
    }

    .dfm__card {
      position: relative;
      width: 100%;
      max-width: 420px;
      max-height: 90vh;
      overflow-y: auto;
      background: var(--ld-bg);
      border-radius: 24px;
      margin: 16px;
      animation: dfm-in 300ms ease-out;
    }

    .dfm__close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      padding: 0;
      background: var(--ld-surface);
      border: none;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--ld-text);
      z-index: 1;
    }

    .dfm__header {
      background: var(--ld-primary-soft);
      padding: 32px 20px 20px;
      border-radius: 24px 24px 0 0;
      text-align: center;
    }

    .dfm__header--event {
      background: var(--ld-event-soft, var(--ld-primary-soft));
    }

    .dfm__label {
      font-family: 'Unbounded', sans-serif;
      font-size: 18px;
      font-weight: 500;
      color: var(--ld-on-primary-soft);
      margin: 0;
    }

    .dfm__body {
      padding: 20px;
    }

    .dfm__title {
      font-size: 20px;
      font-weight: 700;
      color: var(--ld-text);
      margin: 0 0 6px;
      line-height: 1.3;
    }

    .dfm__meta {
      font-size: 13px;
      color: var(--ld-text-2);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .dfm__star { color: var(--ld-warn, #E8862D); }

    .dfm__why {
      margin: 16px 0;
      padding: 12px;
      background: var(--ld-surface);
      border-radius: 14px;
    }

    .dfm__why-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--ld-text-3);
      margin: 0 0 6px;
    }

    .dfm__why-line {
      font-size: 13px;
      color: var(--ld-text);
      margin: 2px 0;
    }

    .dfm__actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    .dfm__route { flex: 1; }

    .dfm__icon-btn {
      width: 48px;
      height: 48px;
      background: var(--ld-surface);
      border: 1px solid var(--ld-border);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--ld-text-3);
      padding: 0;
    }

    .dfm__icon-btn--saved { color: var(--ld-heart, #E05D5D); }

    .dfm__bottom {
      text-align: center;
      margin-top: 12px;
    }

    .dfm__another {
      font-size: 13px;
      color: var(--ld-primary);
    }

    @keyframes dfm-in {
      from { opacity: 0; transform: scale(0.95) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
  `,
})
export class DecideForMeComponent {
  cards = input.required<RecommendationCard[]>();
  close = output<void>();

  private savedStore = inject(SavedStore);
  private interactions = inject(InteractionService);

  readonly attempt = signal(0);
  readonly maxAttempts = 3;

  readonly current = computed(() => this.cards()[this.attempt()]);
  readonly isSaved = computed(() => this.savedStore.isSaved(this.current()?.id));
  readonly canShowAnother = computed(() =>
    this.attempt() < this.maxAttempts - 1 && this.attempt() < this.cards().length - 1
  );

  formatDistance(m: number): string {
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
  }

  onRoute() {
    const c = this.current();
    this.interactions.trackRoute(c.type, c.id);
    let url = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
    if ((c as any).googlePlaceId) url += `&destination_place_id=${(c as any).googlePlaceId}`;
    if (c.distanceM < 2500) url += '&travelmode=walking';
    window.open(url, '_blank');
  }

  async onShare() {
    const c = this.current();
    this.interactions.trackShare(c.type, c.id);
    const url = `https://lazigo.app/detail/${c.type}/${c.id}`;
    const text = `${c.title} — ${c.categoryLabel || c.category}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'LaziGo', text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
      }
    } catch {}
  }

  onSave() {
    const c = this.current();
    this.savedStore.toggle(c);
    this.interactions.trackSave(c.type, c.id);
  }

  onAnother() {
    const c = this.current();
    // Track weak negative — user rejected this recommendation
    this.interactions.track({
      eventType: 'decide_skip',
      targetType: c.type,
      targetId: c.id,
      cardPosition: this.attempt(),
    });
    this.attempt.update(n => n + 1);
  }
}
