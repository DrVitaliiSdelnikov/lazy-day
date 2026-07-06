import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { ProfileStore } from '../../core/stores/profile.store';
import { apiProviders } from '../../core/providers';
import { RecommendationCard } from '../../core/models';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [TranslatePipe, ButtonModule, TagModule],
  providers: [...apiProviders],
  template: `
    <div class="detail">
      <button
        pButton
        icon="pi pi-arrow-left"
        [text]="true"
        severity="secondary"
        (click)="goBack()"
        class="detail__back"></button>

      @if (card(); as c) {
        <h1 class="detail__title">{{ c.title }}</h1>

        <div class="detail__meta">
          <span>{{ c.categoryLabel || c.category }}</span>
          <span>&middot;</span>
          <span>{{ formatDistance(c.distanceM) }}</span>
          @if (c.status) {
            <p-tag
              [value]="c.status"
              [severity]="c.status === 'cancelled' ? 'danger' : 'warn'"
            />
          }
        </div>

        @if (c.explanations?.length) {
          <div class="detail__why">
            <h3 class="detail__section-title">
              {{ 'detail.why_recommended' | translate }}
            </h3>
            <div class="detail__tags">
              @for (tag of c.explanations; track tag.type) {
                <p-tag [value]="tag.label" severity="secondary" />
              }
            </div>
          </div>
        }

        @if (c.description) {
          <div class="detail__description">
            <p>{{ c.description }}</p>
          </div>
        }

        <div class="detail__info">
          @if (c.address) {
            <div class="detail__row">
              <span class="detail__label">{{ 'detail.address' | translate }}</span>
              <span>{{ c.address }}</span>
            </div>
          }
          @if (c.timeLabel) {
            <div class="detail__row">
              <span class="detail__label">{{ 'detail.time' | translate }}</span>
              <span>{{ c.timeLabel }}</span>
            </div>
          }
          @if (c.priceLabel) {
            <div class="detail__row">
              <span class="detail__label">{{ 'detail.price' | translate }}</span>
              <span>{{ c.priceLabel }}</span>
            </div>
          }
          @if (c.freshness) {
            <div class="detail__row">
              <span class="detail__label">{{ 'detail.verified' | translate }}</span>
              <span>{{ c.freshness }}</span>
            </div>
          }
          <div class="detail__row">
            <span class="detail__label">{{ 'detail.source' | translate }}</span>
            <span>{{ c.source }}</span>
          </div>
        </div>

        <div class="detail__actions">
          @if (c.ticketUrl || c.externalUrl) {
            <a
              pButton
              [label]="c.type === 'event' ? ('detail.tickets' | translate) : ('detail.website' | translate)"
              [href]="c.ticketUrl || c.externalUrl"
              target="_blank"
              rel="noopener"
              class="detail__action-btn"
            ></a>
          }
          <a
            pButton
            [label]="'detail.open_maps' | translate"
            severity="secondary"
            [href]="'https://www.google.com/maps/search/?api=1&query=' + c.lat + ',' + c.lng"
            target="_blank"
            rel="noopener"
            class="detail__action-btn"
          ></a>
          <button
            pButton
            [label]="isSaved() ? ('detail.saved' | translate) : ('detail.save' | translate)"
            [severity]="isSaved() ? 'success' : 'secondary'"
            [outlined]="!isSaved()"
            (click)="onToggleSave()"
            class="detail__action-btn"></button>
        </div>
      }
    </div>
  `,
  styles: `
    .detail {
      padding: var(--ld-space-lg);
      padding-bottom: 100px;
    }

    .detail__back {
      margin-bottom: var(--ld-space-md);
    }

    .detail__title {
      font-size: 22px;
      font-weight: 600;
      line-height: 28px;
      margin-bottom: var(--ld-space-sm);
    }

    .detail__meta {
      display: flex;
      align-items: center;
      gap: var(--ld-space-xs);
      font-size: 14px;
      color: var(--ld-text-secondary);
      margin-bottom: var(--ld-space-lg);
    }

    .detail__why {
      margin-bottom: var(--ld-space-lg);
    }

    .detail__section-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--ld-text-secondary);
      margin-bottom: var(--ld-space-sm);
    }

    .detail__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ld-space-xs);
    }

    .detail__description {
      font-size: 15px;
      line-height: 22px;
      margin-bottom: var(--ld-space-lg);
    }

    .detail__info {
      margin-bottom: var(--ld-space-xl);
    }

    .detail__row {
      display: flex;
      justify-content: space-between;
      padding: var(--ld-space-md) 0;
      border-bottom: 1px solid var(--ld-divider);
      font-size: 14px;
    }

    .detail__label {
      color: var(--ld-text-secondary);
    }

    .detail__actions {
      display: flex;
      flex-direction: column;
      gap: var(--ld-space-sm);
    }

    .detail__action-btn {
      width: 100%;
      justify-content: center;
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

  formatDistance(m: number): string {
    if (m < 1000) return `${Math.round(m)} м`;
    return `${(m / 1000).toFixed(1)} км`;
  }

  onToggleSave() {
    const c = this.card();
    if (!c) return;
    this.profileStore.toggleSaved(c.id);
    this.isSaved.set(this.profileStore.isSaved(c.id));
  }

  goBack() {
    this.router.navigate(['/discover']);
  }
}
