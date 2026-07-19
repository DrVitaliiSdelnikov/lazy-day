import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface ExplainResult {
  venueId: string;
  name: string;
  type: string;
  category: string;
  rank: number;
  finalScore: number;
  components: {
    interest: number;
    distance: number;
    time: number;
    quality: number;
    source: number;
    personalization: number;
    priceBoost: number;
  };
  facets: {
    cuisine: string[];
    format: string[];
    atmosphere: string[];
    occasion: string[];
    priceTier: number | null;
  };
  facetMatch: Record<string, number>;
  flags: { isExplore: boolean; isChain: boolean; companyFit: string | null };
}

interface ExplainResponse {
  profileSnapshot: {
    facet_weights: Record<string, Record<string, number>>;
    price_pref: any;
    signal_count: number;
    w_personal: number;
  };
  totalCandidates: number;
  results: ExplainResult[];
}

@Component({
  selector: 'app-reco-lab',
  standalone: true,
  imports: [],
  template: `
    <div class="lab">
      <h1 class="lab__title">🧪 Reco Lab</h1>

      <!-- Controls -->
      <div class="lab__controls">
        <select (change)="setInterest($event)">
          <option value="">All (no filter)</option>
          <option value="food">Food</option>
          <option value="nightlife">Nightlife</option>
          <option value="culture">Culture</option>
          <option value="nature">Nature</option>
          <option value="spa">Spa / Bath</option>
          <option value="gym">Gym</option>
          <option value="sports">Sports</option>
          <option value="shopping">Shopping</option>
          <option value="entertainment">Entertainment</option>
          <option value="family">Family</option>
          <option value="active">Active</option>
        </select>
        <button class="lab__btn" (click)="load()">Load</button>
        <button class="lab__btn lab__btn--danger" (click)="resetProfile()">Reset Profile</button>
      </div>

      @if (loading()) {
        <p>Loading...</p>
      }

      @if (data()) {
        <!-- Profile -->
        <div class="lab__section">
          <h2>Profile ({{ data()!.profileSnapshot.signal_count }} signals, w={{ data()!.profileSnapshot.w_personal }})</h2>
          <div class="lab__facets">
            @for (entry of profileEntries(); track entry.key) {
              <div class="lab__facet-group">
                <span class="lab__facet-type">{{ entry.type }}:</span>
                @for (f of entry.facets; track f.key) {
                  <span class="lab__facet-chip" [class.lab__facet-chip--neg]="f.weight < 0"
                    [style.opacity]="0.3 + Math.min(0.7, Math.abs(f.weight) / 2)">
                    {{ f.key }} ({{ f.weight.toFixed(2) }})
                  </span>
                }
              </div>
            }
          </div>
        </div>

        <!-- Results -->
        <div class="lab__section">
          <h2>Results ({{ data()!.totalCandidates }} candidates → {{ data()!.results.length }} shown)</h2>
          <table class="lab__table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th title="Final weighted score = sum of all components">Score</th>
                <th title="Interest match (0.45): how well venue tags match selected category">Int</th>
                <th title="Distance decay (0.25): closer = higher, 0 at radius edge">Dist</th>
                <th title="Time fit (0.15): open now = 1.0, closes soon = partial, closed = 0">Time</th>
                <th title="Personalization (0→0.20): cosine similarity of venue facets vs your taste profile. Grows with signals.">Pers</th>
                <th title="Price boost: gaussian match between venue price tier and your preferred price">Price</th>
                <th title="Atmosphere facets from Gemini enrichment">Atmosphere</th>
                <th title="Why this venue ranks high — top matching facets from your profile">Why</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of data()!.results.slice(0, 30); track r.venueId) {
                <tr [class.lab__row--explore]="r.flags.isExplore" [class.lab__row--chain]="r.flags.isChain">
                  <td>{{ r.rank }}</td>
                  <td class="lab__name" [title]="r.category + ' | ' + (r.facets.cuisine?.join(', ') || '-')">{{ r.name }}</td>
                  <td class="lab__score" [title]="'Category: ' + r.category + (r.flags.isExplore ? ' | EXPLORE slot' : '') + (r.flags.isChain ? ' | chain ×0.85' : '')">{{ r.finalScore.toFixed(3) }}</td>
                  <td [title]="'Tags matched to interest category'">{{ r.components.interest.toFixed(3) }}</td>
                  <td>{{ r.components.distance.toFixed(3) }}</td>
                  <td [title]="r.components.time.toFixed(3) === '0.000' ? 'Closed or no hours data' : 'Open / opening soon'">{{ r.components.time.toFixed(3) }}</td>
                  <td class="lab__pers" [title]="facetMatchTooltip(r)">{{ r.components.personalization.toFixed(3) }}</td>
                  <td [title]="'Price tier: ' + (r.facets.priceTier ?? 'unknown')">{{ r.components.priceBoost.toFixed(3) }}</td>
                  <td class="lab__atm" [title]="(r.facets.atmosphere?.join(', ') || '-') + ' | ' + (r.facets.occasion?.join(', ') || '-')">{{ r.facets.atmosphere?.join(', ') || '-' }}</td>
                  <td class="lab__why">
                    @for (reason of topReasons(r); track reason.label) {
                      <span class="lab__reason" [class.lab__reason--neg]="reason.weight < 0">{{ reason.label }}</span>
                    }
                    @if (!topReasons(r).length) { <span class="lab__reason lab__reason--none">—</span> }
                  </td>
                  <td>
                    <button class="lab__action" [class.lab__action--liked]="likedIds().has(r.venueId)" (click)="simulateLike(r.venueId)">{{ likedIds().has(r.venueId) ? '♥' : '♡' }}</button>
                    <button class="lab__action lab__action--hide" [class.lab__action--hidden]="hiddenIds().has(r.venueId)" (click)="simulateHide(r.venueId)">✕</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .lab {
      padding: 16px;
      font-family: monospace;
      font-size: 12px;
      max-width: 1200px;
      margin: 0 auto;
      color: var(--ld-text, #333);
    }
    .lab__title { font-size: 20px; margin: 0 0 16px; }
    .lab__controls { display: flex; gap: 8px; margin-bottom: 16px; }
    .lab__btn {
      padding: 6px 12px; border: 1px solid #ccc; border-radius: 6px;
      cursor: pointer; font-family: inherit; font-size: 12px;
    }
    .lab__btn--danger { color: red; border-color: red; }
    .lab__section { margin-bottom: 24px; }
    .lab__section h2 { font-size: 14px; margin: 0 0 8px; }
    .lab__facets { display: flex; flex-direction: column; gap: 4px; }
    .lab__facet-group { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
    .lab__facet-type { font-weight: bold; min-width: 80px; }
    .lab__facet-chip {
      background: #e8f5e9; padding: 2px 6px; border-radius: 4px; font-size: 11px;
    }
    .lab__facet-chip--neg { background: #ffebee; color: #c62828; }
    .lab__table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .lab__table th, .lab__table td { padding: 4px 6px; border-bottom: 1px solid #eee; text-align: left; }
    .lab__table th { background: #f5f5f5; font-weight: bold; }
    .lab__name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lab__score { font-weight: bold; }
    .lab__pers { color: #1565c0; }
    .lab__atm { font-size: 10px; color: #666; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
    .lab__row--explore { background: #fff3e0; }
    .lab__row--chain { opacity: 0.7; }
    .lab__action {
      border: none; background: none; cursor: pointer; font-size: 14px; padding: 2px 4px;
    }
    .lab__why { max-width: 200px; }
    .lab__reason {
      display: inline-block; background: #e3f2fd; color: #1565c0; padding: 1px 5px;
      border-radius: 3px; font-size: 10px; margin: 1px 2px;
    }
    .lab__reason--neg { background: #ffebee; color: #c62828; }
    .lab__reason--none { background: transparent; color: #ccc; }
    .lab__action--liked { color: #e91e63; }
    .lab__action--hide { color: red; }
    .lab__action--hidden { color: #999; }
  `,
})
export class RecoLabComponent implements OnInit {
  private http = inject(HttpClient);
  private baseUrl = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    ? 'https://api.lazigo.app/v1' : '/v1';

  readonly loading = signal(false);
  readonly data = signal<ExplainResponse | null>(null);
  readonly likedIds = signal<Set<string>>(new Set());
  readonly hiddenIds = signal<Set<string>>(new Set());
  readonly Math = Math;

  private interest = '';
  private readonly devDeviceId = 'dev-reco-lab';
  private devDeviceHash = '';
  private readonly headers = { 'x-device-id': this.devDeviceId };

  async ngOnInit() {
    // Compute SHA-256 hash matching backend FeedbackService
    const encoder = new TextEncoder();
    const data = encoder.encode(this.devDeviceId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    this.devDeviceHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    this.load();
  }

  setInterest(event: Event) {
    this.interest = (event.target as HTMLSelectElement).value;
    this.load();
  }

  load() {
    this.loading.set(true);
    const interests: Record<string, number> = {};
    if (this.interest) interests[this.interest] = 1.0;

    this.http.post<ExplainResponse>(`${this.baseUrl}/recommendations/explain`, {
      deviceIdHash: this.devDeviceHash,
      lat: 41.749, lng: 44.786, radiusM: 5000,
      timeWindow: {
        from: new Date().toISOString(),
        to: new Date(Date.now() + 8 * 3600000).toISOString(),
      },
      profile: { interests },
      hiddenIds: [],
      locale: 'ru',
    }).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  profileEntries(): Array<{ type: string; key: string; facets: Array<{ key: string; weight: number }> }> {
    const weights = this.data()?.profileSnapshot.facet_weights ?? {};
    return Object.entries(weights).map(([type, vals]) => ({
      type,
      key: type,
      facets: Object.entries(vals)
        .map(([k, w]) => ({ key: k, weight: w as number }))
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    }));
  }

  simulateLike(venueId: string) {
    const s = new Set(this.likedIds());
    s.add(venueId);
    this.likedIds.set(s);

    this.http.post(`${this.baseUrl}/interactions`, {
      sessionId: 'dev', cardType: 'place', cardId: venueId, action: 'save',
    }, { headers: this.headers }).subscribe(() => {
      setTimeout(() => this.load(), 500);
    });
  }

  simulateHide(venueId: string) {
    const s = new Set(this.hiddenIds());
    s.add(venueId);
    this.hiddenIds.set(s);

    this.http.post(`${this.baseUrl}/interactions`, {
      sessionId: 'dev', cardType: 'place', cardId: venueId, action: 'hide',
    }, { headers: this.headers }).subscribe(() => {
      setTimeout(() => this.load(), 500);
    });
  }

  topReasons(r: ExplainResult): Array<{ label: string; weight: number }> {
    return Object.entries(r.facetMatch || {})
      .map(([k, v]) => ({ label: k.split(':')[1] || k, weight: v as number }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 3);
  }

  facetMatchTooltip(r: ExplainResult): string {
    const entries = Object.entries(r.facetMatch || {});
    if (!entries.length) return 'No profile yet';
    return entries.map(([k, v]) => `${k}: ${(v as number).toFixed(2)}`).join('\n');
  }

  resetProfile() {
    this.likedIds.set(new Set());
    this.hiddenIds.set(new Set());
    this.http.patch(`${this.baseUrl}/recommendations/taste-profile`, { reset: true }, { headers: this.headers })
      .subscribe(() => this.load());
  }
}
