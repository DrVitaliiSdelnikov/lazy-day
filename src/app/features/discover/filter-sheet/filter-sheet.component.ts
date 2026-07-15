import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

export interface FilterState {
  openNow: boolean;
  freeOnly: boolean;
  walkMax20: boolean;
  outdoor: boolean;
  forTwo: boolean;
  budgetMax: number | null;
}

export const defaultFilters: FilterState = {
  openNow: false,
  freeOnly: false,
  walkMax20: false,
  outdoor: false,
  forTwo: false,
  budgetMax: null,
};

@Component({
  selector: 'app-filter-sheet',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    @if (visible) {
      <div class="ld-sheet-backdrop ld-sheet-backdrop--visible" (click)="visible = false"></div>
    }

    <div class="ld-sheet" [class.ld-sheet--open]="visible">
      <div class="ld-sheet__handle"></div>
      <h3 class="filter-sheet__title">{{ 'filters.title' | translate }}</h3>

      <div class="filter-sheet">
        <div class="filter-sheet__chips">
          @for (f of filterOptions; track f.key) {
            <button class="ld-chip"
              [class.ld-chip--active]="isActive(f.key)"
              (click)="toggle(f.key)">{{ f.label | translate }}</button>
          }
        </div>

        <div class="filter-sheet__budget">
          <label class="filter-sheet__label">
            {{ 'filters.budget' | translate }}
            @if (budgetValue() > 0) {
              : {{ budgetValue() }} GEL
            }
          </label>
          <input type="range" class="ld-slider" aria-label="Budget"
            [ngModel]="budgetValue()" (ngModelChange)="onBudgetChange($event)"
            min="0" max="500" step="10" />
        </div>

        <div class="filter-sheet__actions">
          <button class="ld-btn ld-btn--primary filter-sheet__btn" (click)="onApply()">
            {{ 'filters.apply' | translate }}
          </button>
          <button class="ld-btn ld-btn--secondary filter-sheet__btn" (click)="onReset()">
            {{ 'filters.reset' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .filter-sheet {
      padding: 0 0 16px;
    }

    .filter-sheet__title {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .filter-sheet__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
    }

    .filter-sheet__budget {
      margin-bottom: 24px;
    }

    .filter-sheet__label {
      display: block;
      font-size: 14px;
      color: var(--ld-text-2);
      margin-bottom: 8px;
    }

    .filter-sheet__actions {
      display: flex;
      gap: 8px;
    }

    .filter-sheet__btn {
      flex: 1;
    }
  `,
})
export class FilterSheetComponent {
  visible = false;
  filters = signal<FilterState>({ ...defaultFilters });
  budgetValue = signal(0);

  filtersChanged = output<FilterState>();

  filterOptions = [
    { key: 'openNow' as const, label: 'filters.open_now' },
    { key: 'freeOnly' as const, label: 'filters.free' },
    { key: 'walkMax20' as const, label: 'filters.walk_20' },
    { key: 'outdoor' as const, label: 'filters.outdoor' },
    { key: 'forTwo' as const, label: 'filters.for_two' },
  ];

  open() {
    this.visible = true;
  }

  isActive(key: keyof Omit<FilterState, 'budgetMax'>): boolean {
    return this.filters()[key];
  }

  toggle(key: keyof Omit<FilterState, 'budgetMax'>) {
    this.filters.update((f) => ({ ...f, [key]: !f[key] }));
  }

  onBudgetChange(value: number) {
    this.budgetValue.set(value);
    this.filters.update((f) => ({ ...f, budgetMax: value > 0 ? value : null }));
  }

  onApply() {
    this.filtersChanged.emit(this.filters());
    this.visible = false;
  }

  onReset() {
    this.filters.set({ ...defaultFilters });
    this.budgetValue.set(0);
    this.filtersChanged.emit(this.filters());
    this.visible = false;
  }
}
