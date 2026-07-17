import { Component, effect, inject, input, output, signal, computed } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RecommendationCard } from '../../../core/models';
import { LdIconComponent } from '../../../core/components/ld-icon.component';
import { InteractionService } from '../../../core/services/interaction.service';
import { GeolocationService } from '../../../core/services/geolocation.service';
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
            @if (showTaxi()) {
              <button class="dfm__taxi-btn" (click)="onTaxi('yandex')">Yandex Go</button>
              <button class="dfm__taxi-btn" (click)="onTaxi('bolt')">Bolt</button>
            }
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
      word-break: break-word;
      overflow-wrap: break-word;
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

    .dfm__taxi-btn {
      height: 48px;
      padding: 0 12px;
      background: var(--ld-surface);
      border: 1px solid var(--ld-border);
      border-radius: 14px;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      color: var(--ld-text-2);
      white-space: nowrap;
    }

    @media (min-width: 1024px) {
      .dfm__taxi-btn { display: none; }
    }

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
  private geo = inject(GeolocationService);
  readonly hasGps = computed(() => this.geo.position().source === 'gps');

  readonly attempt = signal(0);
  readonly maxAttempts = 3;
  readonly currentPick = signal<RecommendationCard | null>(null);

  // Session state — lives only while modal is open
  private shownIds = new Set<string>();
  private shownCards: RecommendationCard[] = [];
  private skippedCategories = new Set<string>();
  private impressions = new Map<string, number>();

  readonly current = computed(() => this.currentPick() ?? this.cards()[0]);
  readonly isSaved = computed(() => this.savedStore.isSaved(this.current()?.id));
  readonly canShowAnother = computed(() =>
    this.attempt() < this.maxAttempts - 1 && this.pool().length > 0
  );

  private pool = computed(() => {
    const cards = this.cards();
    return cards.filter(c => !this.shownIds.has(c.id));
  });

  constructor() {
    // Pick first on init (afterNextRender equivalent via effect)
    effect(() => {
      const cards = this.cards();
      if (cards.length > 0 && !this.currentPick()) {
        this.currentPick.set(this.decidePick(0));
      }
    });
  }

  private decidePick(attempt: number): RecommendationCard {
    const cards = this.cards();
    const MMR_LAMBDA = 0.6;
    // Cards are pre-sorted by score on backend. Use position as proxy (0=best).

    // 1. Eligible candidates (not shown yet)
    const eligible = cards.filter(c => !this.shownIds.has(c.id));
    if (eligible.length === 0) return cards[0]; // fallback

    // 2. Pool: top ~15% of eligible (position-based band since no score on client)
    const bandSize = Math.max(4, Math.ceil(eligible.length * 0.25));
    let pool = eligible.slice(0, bandSize);

    // 3. Apply session penalties — assign effective score based on position + penalties
    const scored = pool.map((c, i) => ({
      ...c,
      _eff: this.applyPenalties(c, 1 - i / pool.length), // 1.0 for first, decays
    }));

    // 4. Event quota — if events exist and none shown yet, force one
    const hasEvents = scored.some(c => c.type === 'event');
    const shownEvent = this.shownCards.some(c => c.type === 'event');
    const needEvent = hasEvents && !shownEvent && attempt >= 1;

    // 5. MMR re-rank for diversity
    const ranked = this.mmr(scored, this.shownCards, MMR_LAMBDA);

    // 6. Seeded pick from top tier
    const seed = this.simpleHash(`${Date.now().toString(36)}-${attempt}`);
    const rng = this.mulberry32(seed);
    const tier = needEvent
      ? ranked.filter((c: any) => c.type === 'event').slice(0, 3)
      : ranked.slice(0, Math.min(4, ranked.length));

    if (tier.length === 0) return ranked[0] ?? eligible[0];
    const pick = tier[Math.floor(rng() * tier.length)];

    // Track
    this.shownIds.add(pick.id);
    this.shownCards.push(pick);
    this.impressions.set(pick.id, (this.impressions.get(pick.id) ?? 0) + 1);

    return pick;
  }

  private applyPenalties(c: RecommendationCard, positionScore: number): number {
    let score = positionScore;
    const seen = this.impressions.get(c.id) ?? 0;
    score *= Math.pow(0.6, seen);
    if (this.skippedCategories.has(c.category)) score *= 0.85;
    return score;
  }

  private mmr(pool: any[], selected: RecommendationCard[], lambda: number): any[] {
    const out: any[] = [];
    const cand = [...pool];
    const sel = [...selected];

    while (cand.length > 0) {
      let best: any = null;
      let bestVal = -Infinity;

      for (const c of cand) {
        const rel = c._eff ?? 0.5;
        const maxSim = sel.length > 0
          ? Math.max(...sel.map((s: any) => this.venueSim(c, s)))
          : 0;
        const val = lambda * rel - (1 - lambda) * maxSim;
        if (val > bestVal) { bestVal = val; best = c; }
      }

      out.push(best);
      sel.push(best);
      cand.splice(cand.indexOf(best), 1);
    }

    return out;
  }

  private venueSim(a: RecommendationCard, b: RecommendationCard): number {
    let sim = 0;
    if (a.category === b.category) sim += 0.5;
    if (a.type === b.type) sim += 0.2;
    if (this.distBand(a) === this.distBand(b)) sim += 0.3;
    return sim;
  }

  private distBand(c: RecommendationCard): number {
    return Math.floor((c.distanceM ?? 0) / 500);
  }

  private mulberry32(seed: number): () => number {
    return () => {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private simpleHash(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  formatDistance(m: number): string {
    if (m == null || m <= 0) return '';
    return m < 1000 ? `${Math.round(m)} м` : `${(m / 1000).toFixed(1)} км`;
  }

  showTaxi(): boolean {
    const c = this.current();
    return c?.distanceM != null && c.distanceM > 500;
  }

  onRoute() {
    const c = this.current();
    this.interactions.trackRoute(c.type, c.id);
    let url = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
    if ((c as any).googlePlaceId) url += `&destination_place_id=${(c as any).googlePlaceId}`;
    if (c.distanceM && c.distanceM < 2500) url += '&travelmode=walking';
    window.open(url, '_blank');
  }

  onTaxi(provider: 'yandex' | 'bolt') {
    const c = this.current();
    this.interactions.trackTaxi(c.type, c.id, provider);
    if (provider === 'bolt') {
      window.location.href = `bolt://ride?destination_lat=${c.lat}&destination_lng=${c.lng}`;
    } else {
      window.location.href = `yandextaxi://route?end-lat=${c.lat}&end-lon=${c.lng}`;
    }
  }

  async onShare() {
    const c = this.current();
    this.interactions.trackShare(c.type, c.id);
    const url = `https://api.lazigo.app/v1/og/${c.type}/${c.id}`;
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

    // Track weak negative
    this.interactions.track({
      eventType: 'decide_skip',
      targetType: c.type,
      targetId: c.id,
      cardPosition: this.attempt(),
    });

    // Session penalties
    this.skippedCategories.add(c.category);

    // Next pick
    const next = this.attempt() + 1;
    this.attempt.set(next);
    this.currentPick.set(this.decidePick(next));
  }
}
