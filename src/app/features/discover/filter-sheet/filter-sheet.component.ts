import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { SliderModule } from 'primeng/slider';

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
  imports: [DrawerModule, ButtonModule, SliderModule, FormsModule, TranslatePipe],
  template: `
    <p-drawer
      [(visible)]="visible"
      position="bottom"
      [modal]="true"
      [style]="{ height: 'auto', maxHeight: '70vh' }"
      styleClass="filter-drawer"
    >
      <ng-template #header>
        <h3 class="filter-sheet__title">{{ 'filters.title' | translate }}</h3>
      </ng-template>

      <div class="filter-sheet">
        <div class="filter-sheet__chips">
          <button
            class="filter-chip"
            [class.filter-chip--active]="filters().openNow"
            (click)="toggle('openNow')"
          >{{ 'filters.open_now' | translate }}</button>

          <button
            class="filter-chip"
            [class.filter-chip--active]="filters().freeOnly"
            (click)="toggle('freeOnly')"
          >{{ 'filters.free' | translate }}</button>

          <button
            class="filter-chip"
            [class.filter-chip--active]="filters().walkMax20"
            (click)="toggle('walkMax20')"
          >{{ 'filters.walk_20' | translate }}</button>

          <button
            class="filter-chip"
            [class.filter-chip--active]="filters().outdoor"
            (click)="toggle('outdoor')"
          >{{ 'filters.outdoor' | translate }}</button>

          <button
            class="filter-chip"
            [class.filter-chip--active]="filters().forTwo"
            (click)="toggle('forTwo')"
          >{{ 'filters.for_two' | translate }}</button>
        </div>

        <div class="filter-sheet__budget">
          <label class="filter-sheet__label">
            {{ 'filters.budget' | translate }}
            @if (budgetValue() > 0) {
              <span>: {{ budgetValue() }} GEL</span>
            }
          </label>
          <p-slider
            [ngModel]="budgetValue()"
            (ngModelChange)="onBudgetChange($event)"
            [min]="0"
            [max]="500"
            [step]="10"
          ></p-slider>
        </div>

        <div class="filter-sheet__actions">
          <button
            pButton
            [label]="'filters.apply' | translate"
            (click)="onApply()"
            class="filter-sheet__btn"
          ></button>
          <button
            pButton
            [label]="'filters.reset' | translate"
            severity="secondary"
            [outlined]="true"
            (click)="onReset()"
            class="filter-sheet__btn"
          ></button>
        </div>
      </div>
    </p-drawer>
  `,
  styles: `
    .filter-sheet {
      padding: 0 var(--ld-space-lg) var(--ld-space-lg);
    }

    .filter-sheet__title {
      font-size: 17px;
      font-weight: 600;
    }

    .filter-sheet__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ld-space-sm);
      margin-bottom: var(--ld-space-xl);
    }

    .filter-chip {
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

    .filter-sheet__budget {
      margin-bottom: var(--ld-space-xl);
    }

    .filter-sheet__label {
      display: block;
      font-size: 14px;
      color: var(--ld-text-secondary);
      margin-bottom: var(--ld-space-sm);
    }

    .filter-sheet__actions {
      display: flex;
      gap: var(--ld-space-sm);
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

  open() {
    this.visible = true;
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
