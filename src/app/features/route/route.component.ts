import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { ProfileStore } from '../../core/stores/profile.store';
import { apiProviders } from '../../core/providers';
import { LdIconComponent } from '../../core/components/ld-icon.component';

interface RoutePoint {
  id: string; name: string; category: string; lat: number; lng: number;
  hook?: string; role: string; durationMin: number; arriveAt: string; photoUrl?: string;
}

interface RouteTransition {
  type: 'walk' | 'taxi'; distanceM: number; durationMin: number; careLine?: string;
}

interface CareLine {
  rule: string; text: string; position: string;
}

@Component({
  selector: 'app-route',
  standalone: true,
  imports: [TranslatePipe, LdIconComponent],
  providers: [...apiProviders],
  template: `
    <div class="route">
      <!-- Back -->
      <header class="route__header">
        <button class="route__back" (click)="goBack()">
          <ld-icon name="arrow-left" [size]="18" />
        </button>
        <h1 class="route__title">{{ 'route.title' | translate }}</h1>
      </header>

      <!-- Step: Form -->
      @if (step() === 'form') {
        <section class="route__form">
          <p class="route__form-label">{{ 'route.duration' | translate }}</p>
          <div class="route__chips">
            @for (d of durationOptions; track d.value) {
              <button class="ld-chip" [class.ld-chip--active]="selectedDuration() === d.value"
                (click)="selectedDuration.set(d.value)">{{ d.labelKey | translate }}</button>
            }
          </div>

          <p class="route__form-label">{{ 'route.mood' | translate }}</p>
          <div class="route__chips">
            @for (m of moodOptions; track m.value) {
              <button class="ld-chip" [class.ld-chip--active]="selectedMoods().includes(m.value)"
                (click)="toggleMood(m.value)">
                <ld-icon [name]="m.icon" [size]="14" /> {{ m.labelKey | translate }}
              </button>
            }
          </div>

          <p class="route__form-label">{{ 'route.pace' | translate }}</p>
          <div class="route__chips">
            @for (p of paceOptions; track p.value) {
              <button class="ld-chip" [class.ld-chip--active]="selectedPace() === p.value"
                (click)="selectedPace.set(p.value)">{{ p.labelKey | translate }}</button>
            }
          </div>

          <button class="ld-btn ld-btn--primary route__submit" (click)="buildRoute()">
            {{ 'route.build' | translate }}
          </button>
        </section>
      }

      <!-- Step: Loading -->
      @if (step() === 'loading') {
        <section class="route__loading">
          <div class="route__loader-pins">
            <span class="pin"><ld-icon name="map-pin" [size]="20" /></span>
            <span class="pin"><ld-icon name="map-pin" [size]="20" /></span>
            <span class="pin"><ld-icon name="map-pin" [size]="20" /></span>
          </div>
          <p class="route__loader-text">{{ loaderPhrase() }}</p>
        </section>
      }

      <!-- Step: Result -->
      @if (step() === 'result' && routeData()) {
        <section class="route__result">
          <!-- Header / napustvie -->
          <div class="route__napustvie">
            <p>{{ routeData()!.header }}</p>
          </div>

          <!-- Timeline -->
          <div class="route__timeline">
            @for (point of routeData()!.points; track point.id; let i = $index) {
              <!-- Point -->
              <div class="route__point">
                <div class="route__point-time">{{ point.arriveAt }}</div>
                <div class="route__point-marker">{{ i + 1 }}</div>
                <div class="route__point-body">
                  <h3 class="route__point-name">{{ point.name }}</h3>
                  <span class="route__point-role">{{ roleLabel(point.role) }} · ~{{ point.durationMin }} {{ 'route.min' | translate }}</span>
                  @if (point.hook) {
                    <p class="route__point-hook">{{ point.hook }}</p>
                  }
                  @if (pointCare(point.role)) {
                    <p class="route__point-care">{{ pointCare(point.role) }}</p>
                  }
                </div>
              </div>
              <!-- Transition -->
              @if (i < routeData()!.transitions.length) {
                <div class="route__transition" [class.route__transition--taxi]="routeData()!.transitions[i].type === 'taxi'">
                  <ld-icon [name]="routeData()!.transitions[i].type === 'taxi' ? 'car' : 'route'" [size]="14" />
                  <span>
                    {{ routeData()!.transitions[i].type === 'taxi' ? ('route.taxi' | translate) : ('route.walk' | translate) }}
                    · {{ routeData()!.transitions[i].durationMin }} {{ 'route.min' | translate }}
                  </span>
                  @if (routeData()!.transitions[i].careLine) {
                    <p class="route__transition-care">{{ routeData()!.transitions[i].careLine }}</p>
                  }
                </div>
              }
            }
          </div>

          <!-- Footer care -->
          @for (care of footerCare(); track care.rule) {
            <p class="route__footer-care">{{ care.text }}</p>
          }

          <!-- Actions -->
          <div class="route__actions">
            <button class="ld-btn ld-btn--ghost" (click)="step.set('form')">{{ 'route.edit' | translate }}</button>
            <button class="ld-btn ld-btn--primary" (click)="buildRoute()">{{ 'route.rebuild' | translate }}</button>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .route { min-height: 100vh; background: var(--ld-bg); padding-bottom: 80px; }

    .route__header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px var(--ld-space-lg); position: sticky; top: 0;
      background: var(--ld-bg); z-index: 10;
    }
    .route__back { background: none; border: none; cursor: pointer; color: var(--ld-text); padding: 4px; }
    .route__title { font-size: 18px; font-weight: 700; margin: 0; }

    .route__form { padding: 0 var(--ld-space-lg); }
    .route__form-label { font-size: 13px; color: var(--ld-text-2); margin: 16px 0 8px; font-weight: 600; }
    .route__chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .route__submit { width: 100%; margin-top: 24px; min-height: 48px; font-size: 16px; }

    .route__loading { text-align: center; padding: 80px var(--ld-space-lg); }
    .route__loader-pins { display: flex; justify-content: center; gap: 4px; margin-bottom: 16px; }
    .route__loader-pins .pin {
      display: inline-block; transform-origin: bottom center; color: var(--ld-primary);
      animation: pinHop 1.05s ease-in-out infinite;
    }
    .route__loader-pins .pin:nth-child(2) { animation-delay: 0.14s; }
    .route__loader-pins .pin:nth-child(3) { animation-delay: 0.28s; }
    @keyframes pinHop {
      0%, 70%, 100% { transform: translateY(0) scale(1); opacity: 0.55; }
      35% { transform: translateY(-7px) scale(1.12); opacity: 1; }
    }
    .route__loader-text { font-size: 14px; color: var(--ld-text-2); font-style: italic; }

    .route__result { padding: 0 var(--ld-space-lg); }
    .route__napustvie {
      background: var(--ld-primary-soft); border-radius: 12px; padding: 14px 16px;
      font-size: 14px; color: var(--ld-text); line-height: 1.5; margin-bottom: 20px;
    }

    .route__timeline { position: relative; padding-left: 40px; }
    .route__point { display: flex; gap: 12px; margin-bottom: 4px; position: relative; }
    .route__point-time {
      position: absolute; left: -40px; top: 2px;
      font-size: 12px; font-weight: 600; color: var(--ld-text-2); width: 36px; text-align: right;
    }
    .route__point-marker {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: var(--ld-primary); color: var(--ld-bg);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
    }
    .route__point-body { flex: 1; min-width: 0; }
    .route__point-name { font-size: 15px; font-weight: 600; margin: 0 0 2px; }
    .route__point-role { font-size: 11px; color: var(--ld-text-3); }
    .route__point-hook { font-size: 12px; color: var(--ld-text-2); font-style: italic; margin: 4px 0 0; }
    .route__point-care { font-size: 12px; color: var(--ld-primary); margin: 4px 0 0; }

    .route__transition {
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
      padding: 8px 0 8px 40px; font-size: 12px; color: var(--ld-text-3);
      border-left: 2px dashed var(--ld-border); margin-left: 13px;
    }
    .route__transition--taxi { border-left-color: var(--ld-primary); }
    .route__transition-care {
      width: 100%; font-size: 12px; color: var(--ld-primary);
      font-style: italic; margin: 2px 0 0;
    }

    .route__footer-care {
      font-size: 13px; color: var(--ld-primary); font-style: italic;
      text-align: center; margin: 16px 0 0;
    }

    .route__actions {
      display: flex; gap: 8px; margin-top: 24px;
    }
    .route__actions .ld-btn { flex: 1; }
  `,
})
export class RouteComponent {
  private api = inject(ApiService);
  private geo = inject(GeolocationService);
  private profile = inject(ProfileStore);
  private router = inject(Router);
  private translate = inject(TranslateService);

  step = signal<'form' | 'loading' | 'result'>('form');
  routeData = signal<any>(null);

  selectedDuration = signal('2-3h');
  selectedMoods = signal<string[]>(['scenic', 'food']);
  selectedPace = signal('relaxed');

  durationOptions = [
    { value: '2-3h', labelKey: 'route.dur_short' },
    { value: 'half-day', labelKey: 'route.dur_half' },
    { value: 'full-day', labelKey: 'route.dur_full' },
  ];

  moodOptions = [
    { value: 'scenic', labelKey: 'route.mood_scenic', icon: 'sun' },
    { value: 'food', labelKey: 'route.mood_food', icon: 'tools-kitchen-2' },
    { value: 'culture', labelKey: 'route.mood_culture', icon: 'masks-theater' },
    { value: 'nature', labelKey: 'route.mood_nature', icon: 'trees' },
    { value: 'coffee', labelKey: 'route.mood_coffee', icon: 'coffee' },
  ];

  paceOptions = [
    { value: 'relaxed', labelKey: 'route.pace_relaxed' },
    { value: 'intense', labelKey: 'route.pace_intense' },
  ];

  private loaderPhrases = ['route.loader_1', 'route.loader_2', 'route.loader_3'];
  private loaderIdx = 0;

  loaderPhrase = signal(this.loaderPhrases[0]);

  footerCare = computed(() => {
    const data = this.routeData();
    return data?.careLines?.filter((c: CareLine) => c.position === 'footer') ?? [];
  });

  toggleMood(mood: string) {
    const current = this.selectedMoods();
    if (current.includes(mood)) {
      this.selectedMoods.set(current.filter(m => m !== mood));
    } else {
      this.selectedMoods.set([...current, mood]);
    }
  }

  buildRoute() {
    this.step.set('loading');
    this.loaderIdx = 0;
    this.loaderPhrase.set(this.loaderPhrases[0]);

    const interval = setInterval(() => {
      this.loaderIdx = (this.loaderIdx + 1) % this.loaderPhrases.length;
      this.loaderPhrase.set(this.loaderPhrases[this.loaderIdx]);
    }, 1200);

    const pos = this.geo.position();
    this.api.generateRoute({
      lat: pos.lat,
      lng: pos.lng,
      duration: this.selectedDuration(),
      moods: this.selectedMoods(),
      pace: this.selectedPace(),
      locale: this.profile.locale(),
    }).subscribe({
      next: (data) => {
        clearInterval(interval);
        this.routeData.set(data);
        this.step.set('result');
      },
      error: () => {
        clearInterval(interval);
        this.step.set('form');
      },
    });
  }

  roleLabel(role: string): string {
    const key = `route.role_${role}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : role;
  }

  pointCare(role: string): string | null {
    const data = this.routeData();
    if (!data) return null;
    const care = data.careLines?.find((c: CareLine) => c.position === 'point' && c.rule === 'C5' && role === 'food_break');
    return care?.text ?? null;
  }

  goBack() {
    this.router.navigate(['/discover']);
  }
}
