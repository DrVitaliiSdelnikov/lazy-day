import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ProfileStore } from '../../../core/stores/profile.store';
import { LdIconComponent } from '../../../core/components/ld-icon.component';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { ApiService } from '../../../core/services/api.service';
import { apiProviders } from '../../../core/providers';
import { CategoryNode, CompanyType } from '../../../core/models';

type PanelType = 'location' | 'company' | 'interests' | 'time' | null;

@Component({
  selector: 'app-context-bar',
  standalone: true,
  imports: [TranslatePipe, FormsModule, LdIconComponent],
  providers: [...apiProviders],
  template: `
    <div class="ctx">
      <div class="ctx__chips">
        <button class="ctx__chip" (click)="openPanel('location')">
          <ld-icon name="map-pin" [size]="14" />
          {{ locationLabel() }}
        </button>
        <button class="ctx__chip" (click)="openPanel('time')">
          <ld-icon name="clock" [size]="14" />
          {{ timeLabel() }}
        </button>
      </div>
    </div>

    <!-- Bottom sheet for editing -->
    <!-- Sheet backdrop -->
    @if (panelVisible) {
      <div class="ld-sheet-backdrop ld-sheet-backdrop--visible" (click)="panelVisible = false"></div>
    }

    <div class="ld-sheet" [class.ld-sheet--open]="panelVisible">
      <div class="ld-sheet__handle"></div>
      <h3 class="panel-title">
        @switch (activePanel()) {
          @case ('location') { {{ 'context.location' | translate }} }
          @case ('company') { {{ 'context.company' | translate }} }
          @case ('interests') { {{ 'context.interests' | translate }} }
          @case ('time') { {{ 'context.time' | translate }} }
        }
      </h3>

      <div class="panel-body">
        <!-- Location panel -->
        @if (activePanel() === 'location') {
          <div class="panel-section">
            <button class="panel-geo-btn" (click)="useMyLocation()" [disabled]="geoLoading()">
              📍 {{ geoLoading() ? 'Определяю...' : 'Моя локация' }}
            </button>
          </div>
          <div class="panel-section">
            <label class="panel-label">Или вставьте координаты:</label>
            <div class="panel-coords-row">
              <input class="panel-coords-input"
                placeholder="41°41'39.0&quot;N 45°00'33.9&quot;E  или  41.694, 45.009"
                #coordsInput />
              <button class="panel-coords-btn" (click)="applyCoords(coordsInput.value)">OK</button>
            </div>
            @if (coordsError()) {
              <span class="panel-coords-error">{{ coordsError() }}</span>
            }
          </div>
          <div class="panel-section">
            <label class="panel-label">Радиус: {{ radiusKm() }} km</label>
            <input type="range" class="ld-slider"
              [ngModel]="radiusKm()" (ngModelChange)="onRadiusChange($event)"
              min="1" max="15" step="1" />
          </div>
          <div class="panel-section panel-pos-info">
            📍 {{ geo.position().lat.toFixed(5) }}, {{ geo.position().lng.toFixed(5) }}
            <span class="panel-pos-source">({{ geo.position().source }})</span>
          </div>
        }

        <!-- Company panel -->
        @if (activePanel() === 'company') {
          <div class="panel-options">
            @for (opt of companyOptions; track opt.value) {
              <button class="panel-option"
                [class.panel-option--active]="profileStore.company() === opt.value"
                (click)="selectCompany(opt.value)">
                <span class="panel-option__icon">{{ opt.icon }}</span>
                <span>{{ opt.label }}</span>
              </button>
            }
            <button class="panel-option"
              [class.panel-option--active]="profileStore.hasPet()"
              (click)="togglePet()">
              <span class="panel-option__icon">🐕</span>
              <span>С питомцем</span>
            </button>
          </div>
        }

        <!-- Interests panel -->
        @if (activePanel() === 'interests') {
          <div class="panel-chips">
            @for (cat of categories(); track cat.slug) {
              <button class="panel-chip"
                [class.panel-chip--active]="isSelected(cat.slug)"
                (click)="toggleInterest(cat.slug)">{{ cat.label }}</button>
            }
          </div>
        }

        <!-- Time panel -->
        @if (activePanel() === 'time') {
          <div class="panel-chips">
            <button class="panel-chip"
              [class.panel-chip--active]="selectedTime() === 'now'"
              (click)="selectTime('now')">{{ 'context.now' | translate }}</button>
            <button class="panel-chip"
              [class.panel-chip--active]="selectedTime() === 'evening'"
              (click)="selectTime('evening')">{{ 'context.evening' | translate }}</button>
            <button class="panel-chip"
              [class.panel-chip--active]="selectedTime() === 'tomorrow'"
              (click)="selectTime('tomorrow')">{{ 'context.tomorrow' | translate }}</button>
            <button class="panel-chip"
              [class.panel-chip--active]="selectedTime() === 'weekend'"
              (click)="selectTime('weekend')">{{ 'context.weekend' | translate }}</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .ctx {
      padding: 0 var(--ld-space-lg);
      margin-bottom: var(--ld-space-md);
    }

    .ctx__chips {
      display: flex;
      gap: var(--ld-space-xs);
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 2px;

      &::-webkit-scrollbar { display: none; }
    }

    .ctx__chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid var(--ld-divider);
      background: var(--ld-card-bg);
      color: var(--ld-text);
      font-size: 13px;
      white-space: nowrap;
      cursor: pointer;
      min-height: 36px;
      transition: border-color 120ms;

      &:active {
        border-color: var(--ld-accent);
      }
    }

    .ctx__icon {
      font-size: 14px;
    }

    .panel-title {
      font-size: 17px;
      font-weight: 600;
    }

    .panel-body {
      padding: 0 var(--ld-space-lg) var(--ld-space-xl);
    }

    .panel-section {
      margin-bottom: var(--ld-space-xl);
    }

    .panel-label {
      display: block;
      font-size: 14px;
      color: var(--ld-text-secondary);
      margin-bottom: var(--ld-space-sm);
    }

    .panel-geo-btn {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--ld-primary, #6366f1);
      border-radius: var(--ld-radius-md, 12px);
      background: none;
      color: var(--ld-primary, #6366f1);
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      min-height: 48px;

      &:disabled {
        opacity: 0.5;
      }
    }

    .panel-coords-row {
      display: flex;
      gap: 8px;
    }

    .panel-coords-input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid var(--ld-divider);
      border-radius: var(--ld-radius-sm, 8px);
      font-size: 13px;
      color: var(--ld-text);
      background: var(--ld-card-bg);
      min-height: 44px;
    }

    .panel-coords-btn {
      padding: 10px 16px;
      border: none;
      border-radius: var(--ld-radius-sm, 8px);
      background: var(--ld-primary, #6366f1);
      color: white;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
    }

    .panel-coords-error {
      display: block;
      margin-top: 6px;
      font-size: 12px;
      color: #c62828;
    }

    .panel-pos-info {
      font-size: 12px;
      color: var(--ld-text-secondary);
      font-family: monospace;
    }

    .panel-pos-source {
      color: var(--ld-divider);
    }

    .panel-chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ld-space-sm);
    }

    .panel-chip {
      padding: 8px 16px;
      border-radius: 20px;
      border: 1.5px solid var(--ld-divider);
      background: var(--ld-card-bg);
      color: var(--ld-text);
      font-size: 14px;
      cursor: pointer;
      min-height: 44px;
      transition: all 120ms;

      &--active {
        border-color: var(--ld-accent);
        background: rgba(47, 111, 237, 0.08);
        color: var(--ld-accent);
        font-weight: 500;
      }
    }

    .panel-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ld-space-md);
    }

    .panel-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ld-space-sm);
      padding: var(--ld-space-lg);
      border-radius: var(--ld-radius-md);
      border: 1.5px solid var(--ld-divider);
      background: var(--ld-card-bg);
      color: var(--ld-text);
      font-size: 15px;
      cursor: pointer;
      min-height: 48px;

      &--active {
        border-color: var(--ld-accent);
        background: rgba(47, 111, 237, 0.08);
      }
    }

    .panel-option__icon {
      font-size: 28px;
    }
  `,
})
export class ContextBarComponent {
  readonly profileStore = inject(ProfileStore);
  readonly geo = inject(GeolocationService);
  private api = inject(ApiService);

  changed = output<void>();

  panelVisible = false;
  activePanel = signal<PanelType>(null);
  categories = signal<CategoryNode[]>([]);
  selectedTime = signal('now');
  radiusKm = signal(5);
  geoLoading = signal(false);
  coordsError = signal<string | null>(null);

  companyOptions: { value: CompanyType; label: string; icon: string }[] = [
    { value: 'solo', label: 'Один', icon: '🧑' },
    { value: 'couple', label: 'Вдвоём', icon: '👫' },
    { value: 'family', label: 'С семьёй', icon: '👨‍👩‍👧' },
    { value: 'friends', label: 'С друзьями', icon: '👥' },
  ];

  constructor() {
    this.api.getCategories().subscribe((cats) => this.categories.set(cats));
  }

  locationLabel(): string {
    const r = this.radiusKm();
    const src = this.geo.position().source;
    return src === 'gps' ? `📍 ${r}км` : `${r}км`;
  }

  companyLabel(): string {
    const c = this.profileStore.company();
    const base = this.companyOptions.find((o) => o.value === c)?.label ?? 'Любой';
    return this.profileStore.hasPet() ? `${base} + 🐕` : base;
  }

  companyIcon(): string {
    const c = this.profileStore.company();
    return this.companyOptions.find((o) => o.value === c)?.icon ?? '👤';
  }

  interestsLabel(): string {
    const keys = Object.keys(this.profileStore.interests());
    if (keys.length === 0) return 'Все';
    if (keys.length <= 2) return keys.join(', ');
    return `${keys.slice(0, 2).join(', ')} +${keys.length - 2}`;
  }

  timeLabel(): string {
    const map: Record<string, string> = {
      now: 'Сейчас', evening: 'Вечер', tomorrow: 'Завтра', weekend: 'Выходные',
    };
    return map[this.selectedTime()] ?? 'Сейчас';
  }

  getRadiusM(): number {
    return this.radiusKm() * 1000;
  }

  getTimeWindow(): { from: string; to: string } {
    const now = new Date();
    const t = this.selectedTime();

    if (t === 'evening') {
      const from = new Date(now);
      // If already past 18:00, use current time as start
      if (now.getHours() < 18) {
        from.setHours(18, 0, 0, 0);
      }
      const to = new Date(from);
      to.setHours(23, 59, 59, 0);
      // If evening already passed, shift to tomorrow evening
      if (to < now) {
        from.setDate(from.getDate() + 1);
        from.setHours(18, 0, 0, 0);
        to.setDate(to.getDate() + 1);
        to.setHours(23, 59, 59, 0);
      }
      return { from: from.toISOString(), to: to.toISOString() };
    }

    if (t === 'tomorrow') {
      const from = new Date(now);
      from.setDate(from.getDate() + 1);
      from.setHours(8, 0, 0, 0);
      const to = new Date(from);
      to.setHours(23, 59, 59, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }

    if (t === 'weekend') {
      const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
      const from = new Date(now);

      if (dayOfWeek === 6) {
        // Saturday — start from now
        from.setHours(Math.max(from.getHours(), 8), 0, 0, 0);
      } else if (dayOfWeek === 0) {
        // Sunday — start from now
        from.setHours(Math.max(from.getHours(), 8), 0, 0, 0);
      } else {
        // Weekday — jump to next Saturday
        const daysToSat = 6 - dayOfWeek;
        from.setDate(from.getDate() + daysToSat);
        from.setHours(8, 0, 0, 0);
      }

      // End = Sunday 23:59
      const to = new Date(from);
      if (from.getDay() === 6) {
        // from is Saturday → end Sunday
        to.setDate(to.getDate() + 1);
      }
      // from is Sunday → end same day
      to.setHours(23, 59, 59, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }

    // "now" — next 6 hours
    return { from: now.toISOString(), to: new Date(now.getTime() + 6 * 3600000).toISOString() };
  }

  openPanel(panel: PanelType) {
    this.activePanel.set(panel);
    this.panelVisible = true;
  }

  isSelected(slug: string): boolean {
    return slug in this.profileStore.interests();
  }

  toggleInterest(slug: string) {
    this.profileStore.toggleInterest(slug);
    this.emitChanged();
  }

  selectCompany(value: CompanyType) {
    this.profileStore.setCompany(value);
    this.panelVisible = false;
    this.emitChanged();
  }

  togglePet() {
    this.profileStore.setHasPet(!this.profileStore.hasPet());
    this.emitChanged();
  }

  async useMyLocation() {
    this.geoLoading.set(true);
    await this.geo.requestPosition();
    this.geoLoading.set(false);
    this.coordsError.set(null);
    this.panelVisible = false;
    this.emitChanged();
  }

  applyCoords(input: string) {
    const parsed = this.parseCoordinates(input);
    if (parsed) {
      this.geo.setFallback(parsed.lat, parsed.lng);
      this.coordsError.set(null);
      this.panelVisible = false;
      this.emitChanged();
    } else {
      this.coordsError.set('Неверный формат. Примеры: 41°41\'39.0"N 45°00\'33.9"E  или  41.694, 45.009');
    }
  }

  /**
   * Parse coordinates in two formats:
   * - Decimal: "41.694, 45.009"
   * - DMS: "41°41'39.0"N 45°00'33.9"E"
   */
  private parseCoordinates(input: string): { lat: number; lng: number } | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Try decimal: "41.694, 45.009" or "41.694 45.009"
    const decimalMatch = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (decimalMatch) {
      const lat = parseFloat(decimalMatch[1]);
      const lng = parseFloat(decimalMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    // Try DMS: 41°41'39.0"N 45°00'33.9"E
    const dmsPattern = /(\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]\s*([NS])\s*(\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]\s*([EW])/i;
    const dmsMatch = trimmed.match(dmsPattern);
    if (dmsMatch) {
      let lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
      let lng = parseInt(dmsMatch[5]) + parseInt(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600;
      if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
      if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;
      return { lat, lng };
    }

    return null;
  }

  onRadiusChange(km: number) {
    this.radiusKm.set(km);
    this.emitChanged();
  }

  selectTime(time: string) {
    this.selectedTime.set(time);
    this.panelVisible = false;
    this.emitChanged();
  }

  private emitChanged() {
    this.changed.emit();
  }
}
