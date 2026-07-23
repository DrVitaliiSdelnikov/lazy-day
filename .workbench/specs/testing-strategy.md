# LaziGo Testing Strategy

*Angular 21 + Nx 23 + Vitest. Solo dev, zero existing tests.*

## Принципы

1. **Pure logic extraction** — высший ROI. Вынести логику из компонентов в `core/logic/`, тестировать без TestBed.
2. **Тестировать поведение на швах** — не coverage %, а конкретные места которые ломаются при рефакторе.
3. **Никаких платных инструментов** — Playwright native `toHaveScreenshot()` для визуала, Vitest для логики.
4. **AI-friendly** — colocated specs, `data-testid`, AAA, explicit imports, known-good values.

## Runner: Vitest via `vitest-angular`

Angular 21 default. Не Karma, не Jasmine, не AnalogJS.

### Setup

```bash
npx nx add @nx/vitest
npx nx g @nx/vitest:configuration --project lazy-day
```

`nx.json`:
```json
{
  "generators": {
    "@nx/angular:application": { "unitTestRunner": "vitest-angular" },
    "@nx/angular:library": { "unitTestRunner": "vitest-angular" }
  }
}
```

`project.json` test target:
```json
{
  "test": {
    "builder": "@angular/build:unit-test",
    "options": {
      "runner": "vitest",
      "buildTarget": "::development",
      "tsConfig": "tsconfig.spec.json",
      "providersFile": "src/test-providers.ts"
    }
  }
}
```

Zoneless providers:
```ts
// src/test-providers.ts
import { provideZonelessChangeDetection } from '@angular/core';
export default [provideZonelessChangeDetection()];
```

### Команды

```bash
npx nx test lazy-day                    # watch mode
npx nx test lazy-day --watch=false      # CI, once
npx nx test lazy-day --testFile=status-slot.spec.ts   # single file
npx nx e2e lazy-day-e2e                 # e2e
npx playwright test --grep @visual      # visual only
```

## Что тестировать

### Tier 1: Pure functions (no TestBed, highest ROI)

Вынести в `core/logic/`, тестировать plain Vitest.

| Функция | Файл | Что проверять |
|---|---|---|
| `resolveStatusSlot()` | `core/logic/status-slot.ts` | Приоритет: event countdown > closing soon > open until > hours unknown > closed |
| `decidePick()` | `core/logic/decide.ts` | Детерминизм (seed), антиповтор, квота событий, ≤3 attempts |
| `formatDistance()` | `core/logic/formatters.ts` | 0→пусто, 500→"500 м", 1500→"1.5 км" |
| `formatEventTime()` | `core/logic/formatters.ts` | Locale-aware, "сегодня в 20:00" |
| `lTag()` / `lAlsoHas()` | backend, но та же логика | bar→бар, food→еда |
| `venueSim()` | `core/logic/decide.ts` | category+type+distanceBand → [0,1] |
| `mulberry32()` | `core/logic/decide.ts` | Детерминизм: same seed → same sequence |

Пример:
```ts
// status-slot.spec.ts — plain Vitest
import { describe, it, expect } from 'vitest';
import { resolveStatusSlot } from './status-slot';

const NOW = new Date('2026-07-17T20:00:00+04:00');

describe('resolveStatusSlot', () => {
  it('event countdown beats everything', () => {
    const s = resolveStatusSlot({
      eventStartsAt: new Date('2026-07-17T20:37:00+04:00'),
      isOpen: true, closesAt: new Date('2026-07-17T20:30:00+04:00')
    }, NOW);
    expect(s).toEqual({ kind: 'event-countdown', minutes: 37 });
  });

  it('hours-unknown when never fetched', () => {
    expect(resolveStatusSlot({ isOpen: false }, NOW))
      .toEqual({ kind: 'hours-unknown' });
  });
});
```

### Tier 2: Signal stores (TestBed.inject, no DOM)

```ts
// profile.store.spec.ts
import { TestBed } from '@angular/core/testing';
import { ProfileStore } from './profile.store';

describe('ProfileStore', () => {
  let store: ProfileStore;
  beforeEach(() => { store = TestBed.inject(ProfileStore); });

  it('toggles interest', () => {
    store.toggleInterest('coffee');
    expect(store.interests()).toContain('coffee');
    store.toggleInterest('coffee');
    expect(store.interests()).not.toContain('coffee');
  });
});
```

Важно:
- `TestBed.tick()` вместо `TestBed.flushEffects()` (deprecated)
- Signals stateful — reset в `beforeEach`
- Тестировать transitions, не internal state

### Tier 3: Component tests (TestBed + setInput, conditional DOM)

Только где DOM рендеринг имеет значение (conditional visibility).

```ts
// result-card.spec.ts
import { TestBed } from '@angular/core/testing';
import { ResultCardComponent } from './result-card.component';

describe('ResultCardComponent', () => {
  it('hides distance when venue not linked', async () => {
    const fixture = TestBed.createComponent(ResultCardComponent);
    fixture.componentRef.setInput('card', { distanceM: 0, type: 'event', ... });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="distance"]')).toBeNull();
  });
});
```

Паттерны:
- `fixture.componentRef.setInput('name', value)` для signal inputs
- `await fixture.whenStable()` вместо `detectChanges()` (zoneless)
- `[data-testid="..."]` селекторы — стабильные, agent-friendly
- Не тестировать CSS — это visual suite

### Tier 4: i18n key parity (one meta-test)

```ts
// i18n-parity.spec.ts
import { describe, it, expect } from 'vitest';
import ru from '../../public/assets/i18n/ru.json';
import en from '../../public/assets/i18n/en.json';
import ka from '../../public/assets/i18n/ka.json';

function deepKeys(obj: any, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? deepKeys(v, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

describe('i18n key parity', () => {
  const ruKeys = deepKeys(ru).sort();
  const enKeys = deepKeys(en).sort();
  const kaKeys = deepKeys(ka).sort();

  it('en has all ru keys', () => {
    expect(enKeys).toEqual(ruKeys);
  });
  it('ka has all ru keys', () => {
    expect(kaKeys).toEqual(ruKeys);
  });
});
```

### Tier 5: E2E (thin, critical path only)

2-3 flow максимум:
- Landing → discover → видны карточки → клик → детали
- "Реши за меня" → получить результат → маршрут
- Save → перейти в Избранное → карточка там

Паттерны:
- `page.route()` для mock API (не MSW)
- `page.clock.setFixedTime()` для countdown
- `context.setGeolocation()` для GPS
- `retries: 2` в CI, `trace: 'on-first-retry'`

### Visual regression (отложено до стабилизации)

Playwright `toHaveScreenshot()`. Только для redesigned компонентов.
- 1 тема × 1 язык для smoke
- Full matrix только для card components если нужно
- `animations: 'disabled'`, `maxDiffPixelRatio: 0.01`
- НЕ покупать Chromatic/Percy/Applitools

## Файловая структура

```
apps/lazy-day/src/
  test-providers.ts
  app/core/logic/
    status-slot.ts + status-slot.spec.ts
    formatters.ts + formatters.spec.ts
    decide.ts + decide.spec.ts
  app/core/stores/
    profile.store.ts + profile.store.spec.ts
    saved.store.ts + saved.store.spec.ts
  app/features/discover/
    result-card.component.ts + result-card.spec.ts
  app/i18n/
    i18n-parity.spec.ts
e2e/
  fixtures/feed.json
  discover.spec.ts
```

Colocated `*.spec.ts` рядом с source. E2E под `/e2e`.

## Антипаттерны (запрещено)

- **Тавтологические тесты** — не копировать логику кода в expect. Assert known-good literal values.
- **Over-mocking** — prefer real pure functions и MockApiService. Не мокать всё подряд.
- **Coverage chasing** — не ставить 80% gate. Test поведение на швах.
- **fakeAsync/tick** — не работает в zoneless. Использовать `vi.useFakeTimers()`.
- **flushEffects()** — deprecated. Использовать `TestBed.tick()`.
- **Shared mutable fixtures** — каждый тест свой state.

## Порядок внедрения

### Phase 0.3a: Setup (~2ч)
- [ ] Настроить Vitest (`vitest-angular`, test-providers.ts, tsconfig.spec.json)
- [ ] Убедиться что `npx nx test lazy-day` запускает trivial passing test

### Phase 0.3b: Pure logic tests (~4ч)
- [ ] Extract `resolveStatusSlot()` → `core/logic/status-slot.ts`
- [ ] Extract `formatDistance()`, `formatEventTime()` → `core/logic/formatters.ts`
- [ ] Write status-slot.spec.ts (5-7 cases по приоритету)
- [ ] Write formatters.spec.ts (edge cases: 0, null, locale variants)
- [ ] Write i18n-parity.spec.ts

### Phase 0.3c: Store + component tests (~3ч)
- [ ] profile.store.spec.ts (interests, company, budget transitions)
- [ ] saved.store.spec.ts (toggle, isSaved, persistence)
- [ ] result-card.spec.ts (distance hidden at 0, status slot variants)

### Phase 0.3d: K1 algorithm tests (~2ч)
- [ ] Extract `decidePick()` → `core/logic/decide.ts`
- [ ] decide.spec.ts: determinism, anti-repeat, event quota, ≤3 attempts
- [ ] Seeded snapshot: fixed seed + fixed candidates → fixed output

### Phase 0.3e: E2E smoke (~2ч)
- [ ] Landing → discover → card visible
- [ ] "Реши за меня" → result shown

**Total: ~13ч (~2 дня)**

## CLAUDE.md секция (вставить в репо)

```markdown
## Testing

### Commands
- Unit (watch): `npx nx test lazy-day`
- Unit (CI): `npx nx test lazy-day --watch=false`
- Single file: `npx nx test lazy-day --testFile=status-slot.spec.ts`
- E2E: `npx nx e2e lazy-day-e2e`

### Runner
Vitest via `@angular/build:unit-test` (vitest-angular). Zoneless.
NO Karma, NO Jasmine, NO AnalogJS. NO fakeAsync/tick.
Use `TestBed.tick()`, never `flushEffects()`.

### Conventions
- Colocate `*.spec.ts` next to source. AAA structure.
- Pure logic in `core/logic/` — test as plain Vitest, no TestBed.
- Signal stores: `TestBed.inject(Store)`, assert transitions.
- Signal inputs: `fixture.componentRef.setInput()` + `await fixture.whenStable()`.
- Select with `[data-testid="..."]`.
- Assert known-good literal values, not re-derived ones.
```
