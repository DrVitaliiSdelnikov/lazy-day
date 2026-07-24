import { Component, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LdIconComponent } from '../../../core/components/ld-icon.component';
import { INTEREST_OPTIONS } from '../../../core/models';

@Component({
  selector: 'app-feed-tune-block',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent],
  template: `
    <div class="tune">
      <button class="tune__dismiss" (click)="onDismiss()">{{ 'tune.dismiss' | translate }}</button>
      <p class="tune__title">{{ 'tune.title' | translate }}</p>
      <p class="tune__subtitle">{{ 'tune.subtitle' | translate }}</p>
      <div class="tune__chips">
        @for (opt of interestOptions; track opt.slug) {
          <button class="ld-chip" [class.ld-chip--active]="selected().has(opt.slug)"
            (click)="toggle(opt.slug)">
            <ld-icon [name]="opt.icon" [size]="14" />
            {{ opt.labelKey | translate }}
          </button>
        }
      </div>
      @if (selected().size > 0) {
        <button class="ld-btn ld-btn--primary tune__apply" (click)="onApply()">
          {{ 'tune.apply' | translate }}
        </button>
      }
    </div>
  `,
  styles: `
    .tune {
      background: var(--ld-primary-soft);
      border-radius: 20px;
      padding: 16px;
      position: relative;
    }

    .tune__dismiss {
      position: absolute;
      top: 12px;
      right: 12px;
      background: none;
      border: none;
      font-family: inherit;
      font-size: 12px;
      color: var(--ld-text-3);
      cursor: pointer;
    }

    .tune__title {
      font-size: 14px;
      font-weight: 700;
      color: var(--ld-text);
      margin: 0 0 4px;
    }

    .tune__subtitle {
      font-size: 12px;
      color: var(--ld-text-2);
      margin: 0 0 12px;
    }

    .tune__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tune__apply {
      margin-top: 12px;
      width: 100%;
      min-height: 40px;
      font-size: 14px;
    }
  `,
})
export class FeedTuneBlockComponent {
  applied = output<Record<string, number>>();
  dismissed = output<void>();

  readonly selected = signal(new Set<string>());

  interestOptions = INTEREST_OPTIONS;

  toggle(slug: string) {
    const s = new Set(this.selected());
    if (s.has(slug)) s.delete(slug); else s.add(slug);
    this.selected.set(s);
  }

  onApply() {
    const interests: Record<string, number> = {};
    for (const slug of this.selected()) {
      interests[slug] = 1.0;
    }
    this.applied.emit(interests);
  }

  onDismiss() {
    this.dismissed.emit();
  }
}
