import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DrawerModule } from 'primeng/drawer';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SliderModule } from 'primeng/slider';
import { ProfileStore } from '../../../core/stores/profile.store';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { ApiService } from '../../../core/services/api.service';
import { apiProviders } from '../../../core/providers';
import { CategoryNode, CompanyType } from '../../../core/models';

type PanelType = 'location' | 'company' | 'interests' | 'time' | null;

@Component({
  selector: 'app-context-bar',
  standalone: true,
  imports: [TranslatePipe, DrawerModule, SelectButtonModule, SliderModule, FormsModule],
  providers: [...apiProviders],
  template: `
    <div class="ctx">
      <div class="ctx__chips">
        <button class="ctx__chip" (click)="openPanel('location')">
          <span class="ctx__icon">&#128205;</span>
          {{ locationLabel() }}
        </button>
        <button class="ctx__chip" (click)="openPanel('company')">
          <span class="ctx__icon">{{ companyIcon() }}</span>
          {{ companyLabel() }}
        </button>
        <button class="ctx__chip" (click)="openPanel('interests')">
          <span class="ctx__icon">&#9733;</span>
          {{ interestsLabel() }}
        </button>
        <button class="ctx__chip" (click)="openPanel('time')">
          <span class="ctx__icon">&#9201;</span>
          {{ timeLabel() }}
        </button>
      </div>
    </div>

    <!-- Bottom sheet for editing -->
    <p-drawer
      [(visible)]="panelVisible"
      position="bottom"
      [modal]="true"
      [style]="{ height: 'auto', maxHeight: '70vh' }"
    >
      <ng-template #header>
        <h3 class="panel-title">
          @switch (activePanel()) {
            @case ('location') { {{ 'context.location' | translate }} }
            @case ('company') { {{ 'context.company' | translate }} }
            @case ('interests') { {{ 'context.interests' | translate }} }
            @case ('time') { {{ 'context.time' | translate }} }
          }
        </h3>
      </ng-template>

      <div class="panel-body">
        <!-- Location panel -->
        @if (activePanel() === 'location') {
          <div class="panel-section">
            <label class="panel-label">{{ 'context.radius' | translate }}: {{ radiusKm() }} km</label>
            <p-slider [ngModel]="radiusKm()" (ngModelChange)="onRadiusChange($event)"
              [min]="1" [max]="15" [step]="1"></p-slider>
          </div>
          <div class="panel-chips">
            @for (d of districts; track d.name) {
              <button class="panel-chip"
                [class.panel-chip--active]="selectedDistrict() === d.name"
                (click)="selectDistrict(d)">{{ d.name }}</button>
            }
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
    </p-drawer>
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
  private geo = inject(GeolocationService);
  private api = inject(ApiService);

  changed = output<void>();

  panelVisible = false;
  activePanel = signal<PanelType>(null);
  categories = signal<CategoryNode[]>([]);
  selectedDistrict = signal<string | null>(null);
  selectedTime = signal('now');
  radiusKm = signal(5);

  districts = [
    { name: 'Старый город', lat: 41.6934, lng: 44.8015 },
    { name: 'Вера', lat: 41.7089, lng: 44.7853 },
    { name: 'Ваке', lat: 41.7137, lng: 44.7505 },
    { name: 'Сабуртало', lat: 41.7267, lng: 44.7505 },
    { name: 'Мтацминда', lat: 41.6978, lng: 44.7926 },
    { name: 'Дигоми', lat: 41.7658, lng: 44.7299 },
  ];

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
    const d = this.selectedDistrict();
    const r = this.radiusKm();
    return d ? `${d} ${r}км` : `${r}км`;
  }

  companyLabel(): string {
    const c = this.profileStore.company();
    return this.companyOptions.find((o) => o.value === c)?.label ?? 'Любой';
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
      const from = new Date(now); from.setHours(18, 0, 0);
      const to = new Date(now); to.setHours(23, 59, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (t === 'tomorrow') {
      const from = new Date(now); from.setDate(from.getDate() + 1); from.setHours(10, 0, 0);
      const to = new Date(from); to.setHours(23, 59, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (t === 'weekend') {
      const dayOfWeek = now.getDay();
      const daysToSat = (6 - dayOfWeek + 7) % 7 || 7;
      const from = new Date(now); from.setDate(from.getDate() + daysToSat); from.setHours(10, 0, 0);
      const to = new Date(from); to.setDate(to.getDate() + 1); to.setHours(23, 59, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    // now
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

  selectDistrict(d: { name: string; lat: number; lng: number }) {
    this.selectedDistrict.set(d.name);
    this.geo.setFallback(d.lat, d.lng);
    this.panelVisible = false;
    this.emitChanged();
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
