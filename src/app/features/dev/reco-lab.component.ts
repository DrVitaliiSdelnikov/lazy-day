import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

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
  imports: [FormsModule],
  template: `
    <div class="lab">
      <h1 class="lab__title">Reco Lab</h1>

      <!-- Controls row 1: Interest + Company -->
      <div class="lab__controls">
        <label class="lab__label">Interest
          <select (change)="setInterest($event)">
            <option value="">All</option>
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
        </label>

        <label class="lab__label">Company
          <select [(ngModel)]="company" (ngModelChange)="load()">
            <option value="">None</option>
            <option value="solo">Solo</option>
            <option value="couple">Couple</option>
            <option value="friends">Friends</option>
            <option value="family">Family</option>
          </select>
        </label>

        <label class="lab__label">Local type
          <select [(ngModel)]="localType" (ngModelChange)="load()">
            <option value="">Default</option>
            <option value="tourist">Tourist</option>
            <option value="first_time">First time</option>
            <option value="visitor">Visitor</option>
            <option value="local">Local</option>
          </select>
        </label>

        <label class="lab__label lab__label--check">
          <input type="checkbox" [(ngModel)]="hasPet" (ngModelChange)="load()" /> Pet
        </label>
      </div>

      <!-- Controls row 2: Actions -->
      <div class="lab__controls">
        <button class="lab__btn" (click)="load()">Reload</button>
        <button class="lab__btn lab__btn--danger" (click)="resetProfile()">Reset Profile</button>
        <span class="lab__showing">Showing {{ visibleCount() }} of {{ data()?.results?.length ?? 0 }}</span>
        @if (data() && visibleCount() < (data()?.results?.length ?? 0)) {
          <button class="lab__btn" (click)="showMore()">Show more</button>
        }
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
          <h2>Results ({{ data()!.totalCandidates }} candidates)</h2>
          <table class="lab__table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th title="Final weighted score = sum of all components">Score</th>
                <th title="Interest match (0.45): how well venue tags match selected category">Int</th>
                <th title="Distance decay (0.25): closer = higher, 0 at radius edge">Dist</th>
                <th title="Time fit (0.15): open now = 1.0, closes soon = partial, closed = 0">Time</th>
                <th title="Personalization (0-0.20): cosine similarity of venue facets vs your taste profile">Pers</th>
                <th title="Price boost: gaussian match between venue price tier and your preferred price">Price</th>
                <th title="Atmosphere facets from Gemini enrichment">Atm</th>
                <th title="Why this venue ranks high - top matching facets from your profile">Why</th>
                <th title="Actions: save(1.0) route(0.7) click(0.3) hide(neg)">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of data()!.results.slice(0, visibleCount()); track r.venueId) {
                <tr [class.lab__row--explore]="r.flags.isExplore" [class.lab__row--chain]="r.flags.isChain">
                  <td>{{ r.rank }}</td>
                  <td class="lab__name" [title]="r.category + ' | ' + (r.facets.cuisine?.join(', ') || '-')">{{ r.name }}</td>
                  <td class="lab__score" [title]="'Category: ' + r.category + (r.flags.isExplore ? ' | EXPLORE' : '') + (r.flags.isChain ? ' | chain' : '') + (r.flags.companyFit ? ' | ' + r.flags.companyFit : '')">{{ r.finalScore.toFixed(3) }}</td>
                  <td>{{ r.components.interest.toFixed(3) }}</td>
                  <td>{{ r.components.distance.toFixed(3) }}</td>
                  <td [title]="r.components.time.toFixed(3) === '0.000' ? 'Closed / no hours' : 'Open'">{{ r.components.time.toFixed(3) }}</td>
                  <td class="lab__pers" [title]="facetMatchTooltip(r)">{{ r.components.personalization.toFixed(3) }}</td>
                  <td [title]="'Price tier: ' + (r.facets.priceTier ?? '?')">{{ r.components.priceBoost.toFixed(3) }}</td>
                  <td class="lab__atm" [title]="(r.facets.atmosphere?.join(', ') || '-') + ' | ' + (r.facets.occasion?.join(', ') || '-')">{{ r.facets.atmosphere?.join(', ') || '-' }}</td>
                  <td class="lab__why">
                    @for (reason of topReasons(r); track reason.label) {
                      <span class="lab__reason" [class.lab__reason--neg]="reason.weight < 0">{{ reason.label }}</span>
                    }
                    @if (!topReasons(r).length) { <span class="lab__reason lab__reason--none">-</span> }
                  </td>
                  <td class="lab__actions-cell">
                    <button class="lab__action" [class.lab__action--liked]="actionLog().has(r.venueId + ':save')"
                      title="Save (weight 1.0)" (click)="simulateAction(r.venueId, 'save')">{{ actionLog().has(r.venueId + ':save') ? '\u2665' : '\u2661' }}</button>
                    <button class="lab__action lab__action--route" [class.lab__action--done]="actionLog().has(r.venueId + ':route')"
                      title="Route (weight 0.7)" (click)="simulateAction(r.venueId, 'route')">R</button>
                    <button class="lab__action lab__action--click" [class.lab__action--done]="actionLog().has(r.venueId + ':card_click')"
                      title="Card click (weight 0.3)" (click)="simulateAction(r.venueId, 'card_click')">C</button>
                    <button class="lab__action lab__action--taxi" [class.lab__action--done]="actionLog().has(r.venueId + ':taxi')"
                      title="Taxi (weight 0.7)" (click)="simulateAction(r.venueId, 'taxi')">T</button>
                    <button class="lab__action lab__action--hide" [class.lab__action--done]="actionLog().has(r.venueId + ':hide')"
                      title="Hide (negative)" (click)="simulateAction(r.venueId, 'hide')">x</button>
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
      max-width: 1400px;
      margin: 0 auto;
      color: var(--ld-text, #333);
    }
    .lab__title { font-size: 20px; margin: 0 0 12px; }
    .lab__controls { display: flex; gap: 8px; margin-bottom: 10px; align-items: flex-end; flex-wrap: wrap; }
    .lab__label { display: flex; flex-direction: column; font-size: 10px; color: #888; gap: 2px; }
    .lab__label select { font-family: inherit; font-size: 12px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; }
    .lab__label--check { flex-direction: row; align-items: center; gap: 4px; font-size: 12px; color: inherit; }
    .lab__btn {
      padding: 5px 10px; border: 1px solid #ccc; border-radius: 6px;
      cursor: pointer; font-family: inherit; font-size: 12px; background: #fff;
    }
    .lab__btn:hover { background: #f5f5f5; }
    .lab__btn--danger { color: red; border-color: red; }
    .lab__showing { font-size: 11px; color: #888; align-self: center; }
    .lab__section { margin-bottom: 20px; }
    .lab__section h2 { font-size: 13px; margin: 0 0 6px; }
    .lab__facets { display: flex; flex-direction: column; gap: 3px; }
    .lab__facet-group { display: flex; gap: 3px; flex-wrap: wrap; align-items: center; }
    .lab__facet-type { font-weight: bold; min-width: 70px; font-size: 11px; }
    .lab__facet-chip {
      background: #e8f5e9; padding: 1px 5px; border-radius: 3px; font-size: 10px;
    }
    .lab__facet-chip--neg { background: #ffebee; color: #c62828; }
    .lab__table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .lab__table th, .lab__table td { padding: 3px 5px; border-bottom: 1px solid #eee; text-align: left; }
    .lab__table th { background: #f5f5f5; font-weight: bold; position: sticky; top: 0; z-index: 1; }
    .lab__name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lab__score { font-weight: bold; }
    .lab__pers { color: #1565c0; }
    .lab__atm { font-size: 10px; color: #666; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lab__row--explore { background: #fff3e0; }
    .lab__row--chain { opacity: 0.7; }
    .lab__actions-cell { white-space: nowrap; }
    .lab__action {
      border: none; background: none; cursor: pointer; font-size: 12px; padding: 1px 3px;
      border-radius: 3px;
    }
    .lab__action:hover { background: #f0f0f0; }
    .lab__action--liked { color: #e91e63; font-weight: bold; }
    .lab__action--route { color: #1976d2; }
    .lab__action--click { color: #7b1fa2; }
    .lab__action--taxi { color: #f57c00; }
    .lab__action--hide { color: #d32f2f; }
    .lab__action--done { font-weight: bold; text-decoration: underline; }
    .lab__why { max-width: 160px; }
    .lab__reason {
      display: inline-block; background: #e3f2fd; color: #1565c0; padding: 0 4px;
      border-radius: 3px; font-size: 9px; margin: 0 1px;
    }
    .lab__reason--neg { background: #ffebee; color: #c62828; }
    .lab__reason--none { background: transparent; color: #ccc; }
  `,
})
export class RecoLabComponent implements OnInit {
  private http = inject(HttpClient);
  private baseUrl = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    ? 'https://api.lazigo.app/v1' : '/v1';

  readonly loading = signal(false);
  readonly data = signal<ExplainResponse | null>(null);
  readonly actionLog = signal<Set<string>>(new Set()); // "venueId:action"
  readonly visibleCount = signal(30);
  readonly Math = Math;

  // Controls
  private interest = '';
  company = '';
  localType = '';
  hasPet = false;

  private readonly devDeviceId = 'dev-reco-lab';
  private devDeviceHash = '';
  private readonly headers = { 'x-device-id': this.devDeviceId };

  async ngOnInit() {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(this.devDeviceId));
    this.devDeviceHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
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

    const profile: any = { interests };
    if (this.company) profile.company = this.company;
    if (this.hasPet) profile.hasPet = true;
    if (this.localType) profile.localType = this.localType;

    this.http.post<ExplainResponse>(`${this.baseUrl}/recommendations/explain`, {
      deviceIdHash: this.devDeviceHash,
      lat: 41.749, lng: 44.786, radiusM: 5000,
      timeWindow: {
        from: new Date().toISOString(),
        to: new Date(Date.now() + 8 * 3600000).toISOString(),
      },
      profile,
      hiddenIds: [],
      locale: 'ru',
    }).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  showMore() {
    this.visibleCount.update(v => Math.min(v + 20, this.data()?.results?.length ?? v));
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

  simulateAction(venueId: string, action: string) {
    const s = new Set(this.actionLog());
    s.add(`${venueId}:${action}`);
    this.actionLog.set(s);

    this.http.post(`${this.baseUrl}/interactions`, {
      sessionId: 'dev', cardType: 'place', cardId: venueId, action,
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
    this.actionLog.set(new Set());
    this.visibleCount.set(30);
    this.http.patch(`${this.baseUrl}/recommendations/taste-profile`, { reset: true }, { headers: this.headers })
      .subscribe(() => this.load());
  }
}
