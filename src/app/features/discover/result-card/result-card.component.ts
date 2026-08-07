import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RecommendationCard } from '../../../core/models';
import { LdIconComponent } from '../../../core/components/ld-icon.component';

@Component({
  selector: 'app-result-card',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent],
  template: `
    <article class="card ld-card" [class.card--event]="card().type === 'event'" [class.card--place]="card().type === 'place'">
      <div class="card__stripe"></div>
      <div class="card__body">
        <!-- Why line (top, from real signals) -->
        @if (explanationLine()) {
          <p class="card__why-top">{{ explanationLine() }}</p>
        }

        <!-- Title row: photo + name + heart -->
        <div class="card__title-row">
          @if (cardImage() && !brokenImage()) {
            <img class="card__thumb" [src]="cardImage()" alt="" loading="lazy" (error)="brokenImage.set(true)" />
          }
          <div class="card__title-col">
            <div class="card__header">
              @if (card().type === 'event') {
                <ld-icon name="ticket" [size]="14" class="card__ticket-icon" />
              }
              <h2 class="card__title" [title]="card().title">{{ card().title }}</h2>
            </div>
            <!-- Meta line -->
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
                @if (card().openStatus) {
                  · <span [class]="'card__status-inline card__status-inline--' + statusTone()">{{ card().openStatus }}</span>
                }
                @if (card().rating) {
                  · <span class="card__rating-inline">★ {{ card().rating }}@if (card().ratingCount) { <span class="card__rating-count">({{ formatRatingCount() }})</span>}</span>
                }
              }
            </p>
          </div>
          <button
            class="card__heart"
            [class.card__heart--saved]="isSaved()"
            (click)="onSaveClick($event)"
            [attr.aria-label]="isSaved() ? 'Unsave' : 'Save'">
            <ld-icon [name]="isSaved() ? 'heart-filled' : 'heart'" [size]="18" />
          </button>
        </div>

        <!-- Hook (friend's voice) -->
        @if (card().hook) {
          <p class="card__hook">{{ card().hook }}</p>
        }

        <!-- Two actions -->
        <div class="card__actions">
          @if (card().type === 'event') {
            @if (card().ticketUrl) {
              <a class="card__action card__action--primary" [href]="card().ticketUrl" target="_blank" rel="noopener">
                <ld-icon name="ticket" [size]="13" /> {{ 'card.ticket' | translate }}
              </a>
            }
          } @else {
            <a class="card__action card__action--primary" [href]="googleMapsLink()" target="_blank" rel="noopener">
              <ld-icon name="route" [size]="13" /> {{ 'card.navigate' | translate }}
            </a>
            @if (card().lat && card().lng) {
              <a class="card__action card__action--secondary card__action--mobile-only" [href]="taxiLink()" target="_blank" rel="noopener">
                <ld-icon name="car" [size]="13" /> {{ 'card.taxi' | translate }}
              </a>
            }
          }
          <button class="card__expand-btn" (click)="openDetail.emit()" [title]="'card.details' | translate">
            <ld-icon name="eye" [size]="13" />
          </button>
        </div>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; overflow: hidden; max-width: 100%; }

    .card {
      position: relative;
      overflow: hidden;
      padding: 0;
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

    .card--event .card__stripe { background: var(--ld-event); }
    .card--place .card__stripe { background: var(--ld-primary); }
    .theme-evening .card__stripe { width: 5px; }

    .card__body {
      flex: 1; min-width: 0; padding: 10px 14px;
    }

    /* Why line on top */
    .card__why-top {
      display: flex; align-items: center; gap: 4px;
      font-size: 10px; color: var(--ld-text-3); margin: 0 0 6px;
    }
    .card__why-top ld-icon { color: var(--ld-primary); }

    /* Title row: photo + name + heart */
    .card__title-row {
      display: flex; gap: 10px; align-items: flex-start;
    }
    .card__thumb {
      width: 44px; height: 44px; object-fit: cover; flex-shrink: 0;
      border-radius: 9px; background: var(--ld-surface-2, #f0f0f0);
    }
    .card__title-col { flex: 1; min-width: 0; }
    .card__header {
      display: flex; align-items: center; gap: 6px;
    }
    .card__title {
      font-size: 14px; font-weight: 700; line-height: 1.3;
      color: var(--ld-text); margin: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      min-width: 0; flex: 1;
    }

    .card__heart {
      background: none; border: none;
      font-size: 18px; color: var(--ld-text-3); cursor: pointer;
      padding: 2px; min-width: 36px; min-height: 36px;
      display: flex; align-items: center; justify-content: center;
      transition: transform 150ms, color 150ms;
      border-radius: 8px; flex-shrink: 0;
    }
    .card__heart:hover { color: var(--ld-heart); transform: scale(1.1); }
    .card__heart:active { transform: scale(1.2); }
    .card__heart--saved { color: var(--ld-heart); animation: heart-pop 300ms ease; }

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

    .card__hook {
      font-size: 11px; color: var(--ld-text-2); margin: 6px 0 0;
      font-style: italic; line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
    }

    .card__status-inline--success { color: var(--ld-open); font-weight: 600; }
    .card__status-inline--warning { color: var(--ld-warn); }
    .card__status-inline--muted { color: var(--ld-text-3); }
    .card__status-inline--secondary { color: var(--ld-text-2); }

    .card__rating-count { color: var(--ld-text-3); font-weight: 400; }

    /* Two action buttons */
    .card__actions {
      display: flex; gap: 6px; margin-top: 8px;
    }
    .card__action {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 10px; border-radius: 8px;
      font-size: 11px; font-weight: 700; text-decoration: none;
      font-family: inherit; cursor: pointer;
    }
    .card__action--primary {
      flex: 1; justify-content: center;
      border: 1px solid var(--ld-primary); background: var(--ld-primary-soft);
      color: var(--ld-on-primary-soft, var(--ld-primary));
      transition: background 150ms, transform 100ms;
    }
    .card__action--primary:hover { background: var(--ld-primary); color: var(--ld-on-primary, #fff); }
    .card__action--primary:active { transform: scale(0.97); }
    .card__action--secondary {
      border: 1px solid var(--ld-border); background: var(--ld-surface);
      color: var(--ld-text-2);
      transition: background 150ms, border-color 150ms, transform 100ms;
    }
    .card__action--secondary:hover { border-color: var(--ld-text-3); background: var(--ld-surface-2); }
    .card__action--secondary:active { transform: scale(0.97); }
    @media (min-width: 900px) {
      .card__action--mobile-only { display: none; }
    }

    .card__expand-btn {
      border: 1px solid var(--ld-border); background: var(--ld-surface);
      border-radius: 8px; padding: 6px 8px; cursor: pointer;
      display: flex; align-items: center; color: var(--ld-text-3);
      transition: background 150ms, color 150ms;
    }
    .card__expand-btn:hover { background: var(--ld-surface-2); color: var(--ld-text); }

    /* Collapsible detail */
    .card__detail {
      margin-top: 10px; padding-top: 10px;
      border-top: 1px solid var(--ld-border);
    }
    .card__detail-row {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; color: var(--ld-text-2); margin: 0 0 4px;
    }
    .card__detail-row--status { font-weight: 600; }
    .card__detail-desc {
      font-size: 12px; color: var(--ld-text-2); margin: 6px 0;
      line-height: 1.4; font-style: italic;
    }
    .card__detail-actions {
      display: flex; gap: 12px; margin-top: 8px;
    }
    .card__detail-link {
      background: none; border: none; font-size: 12px;
      color: var(--ld-primary); cursor: pointer;
      font-family: inherit; padding: 0; text-decoration: underline;
    }
    .card__detail-link:hover { opacity: 0.8; }
    .card__detail-link--muted { color: var(--ld-text-3); }
  `,
})
export class ResultCardComponent {
  card = input.required<RecommendationCard>();
  isSaved = input(false);
  showGeoHint = input(false);
  openDetail = output<void>();
  toggleSave = output<void>();
  hideCard = output<void>();

  showHideMenu = signal(false);
  brokenImage = signal(false);
  expanded = signal(false);

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

  googleMapsLink(): string {
    const c = this.card();
    if (c.lat && c.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=walking`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.title)}`;
  }

  taxiLink(): string {
    const c = this.card();
    return `https://3.redirect.appmetrica.yandex.com/route?end-lat=${c.lat}&end-lon=${c.lng}&appmetrica_tracking_id=1178268795219780156`;
  }
}
