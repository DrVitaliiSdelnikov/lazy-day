# Redesign: Detail Page — Modal on Desktop, Page on Mobile

## Spec (8.4)

Desktop (≥1024): click on card → modal overlay 560px, backdrop, two columns.
Mobile (<1024): full-screen page (current behavior).
URL changes to `/detail/:type/:id` via history.pushState in both cases.

## What needs to change

### 1. Detail component — redesign template per ui-spec

**Mobile (full-screen page)**:
- Color header bar: `--ld-primary-soft` (place) / `--ld-event-soft` (event)
- Category icon 38px centered
- Back/share/heart buttons as icon circles on header
- Title 19px bold
- Meta line: category · distance · walk time · rating
- Badges row: open status, pet, kids
- "Почему это вам" card with icon + text per reason
- Hours card (collapsible)
- Address card with map-pin icon
- Action buttons: Route (primary), Share (icon), Hide (icon)
- Event: sticky "Билеты от X ₾ · source" at bottom
- Event: date/time block with countdown badge

**Desktop (modal)**:
- Overlay backdrop `rgba(45,38,26,0.4)` / `rgba(35,26,42,0.45)` evening
- Modal 560px, radius 20, bg themed
- Header bar: icon + title + heart/share/close buttons
- Two columns: left = content (meta, badges, "why this"), right = actions (hours, address, route, hide)
- Event: ticket CTA in right column

### 2. Routing change

Currently: card click → `router.navigate(['/detail', type, id])` → full page.

Need:
- Mobile: keep full page navigation (same as now)
- Desktop: prevent navigation, open modal overlay in discover component
- URL still changes via `history.pushState` for sharing

### 3. Implementation approach

**Option A: Two separate components** — DetailPageComponent (mobile) + DetailModalComponent (desktop).
Pros: clean separation. Cons: duplicate logic.

**Option B: One component, two render modes** — DetailComponent checks viewport.
Pros: shared logic. Cons: complex template.

**Option C: Detail as overlay in DiscoverComponent** — on desktop, card click opens detail overlay inside discover.
Pros: natural modal behavior (backdrop = blurred feed). Cons: discover component grows.

**Recommendation: Option C** — matches the spec exactly. The spec says "модалка поверх ленты" — the feed stays visible and blurred underneath.

### 4. Steps

1. Create `DetailModalComponent` — modal wrapper (backdrop + centered panel)
2. Extract detail content into shared `DetailContentComponent` — used by both page and modal
3. In `DiscoverComponent`: on card click, check viewport. If ≥1024 → open modal. If <1024 → navigate.
4. Style modal per desktop mockup (two columns, header bar)
5. Style mobile page per mobile mockup (color header, full width)
6. URL: `history.pushState` on modal open, `history.back` on close

### 5. Files to create/modify

- `src/app/features/detail/detail-content.component.ts` — shared content (NEW)
- `src/app/features/detail/detail-modal.component.ts` — desktop modal wrapper (NEW)
- `src/app/features/detail/detail.component.ts` — mobile page, uses detail-content (MODIFY)
- `src/app/features/discover/discover.component.ts` — add modal overlay logic (MODIFY)
