# LaziGo — Commands & Agents Spec (v2)

## Problem

Project is growing fast: 3168 venues, 11 areas, route engine, palette,
graceful degradation, MapLibre maps, Gemini enrichment, 24 migrations.
Single-context conversations hit limits. Need specialized commands for
repeatable workflows and agents for parallel work.

## Architecture: Commands vs Agents

**Commands** (`/lg-*`): user-invocable, run in main context.
For structured workflows that need user interaction.
Commands are **thin wrappers** — they collect params, invoke agents, show results.

**Agents** (subagent_type): spawned by Claude, run in background.
For parallel research, validation, bulk operations.
Agents hold the **logic** — commands don't duplicate it.

**Rule**: If a command and an agent do similar work, the agent owns the logic.
The command calls the agent with params and formats the report for the user.

---

## Safety: Destructive Guard

**Applies to**: any command or agent that applies SQL to a database.

Before executing any migration or SQL mutation (INSERT/UPDATE/DELETE/DROP/ALTER):
1. Parse SQL statements from the migration
2. Flag destructive operations: `DROP`, `DELETE`, `TRUNCATE`, `ALTER TABLE ... DROP`
3. If destructive found → **STOP**, show the exact statements, require explicit user confirmation
4. Even non-destructive migrations require user approval before `apply` step

This guard runs in: `/lg-deploy` (step 7), `/lg-seed` (step 5), `/lg-enrich` (step 4).
The `lg-migration-validator` agent provides the scan logic — commands call it before apply.

**Project policy**: additive migrations only. DROP/DELETE = red flag, not routine.

---

## Stable ID Policy

**Match key**: `osm_id` (migration 018, backfilled 3168/3168).
**Never match by**: float coordinates (lat/lng). Known issue: `ABS < 1e-7` produces
silent mismatches on venues with similar coords but different identities.

All sync operations (local↔prod, enrichment, import) MUST use `osm_id` as the join key.
If `osm_id` is missing → flag as unresolvable, don't guess by coordinates.

---

## COMMANDS (user-invocable, `/lg-*`)

### /lg-task — Universal entry point
Like cb-task but for LaziGo. Accepts --type and --scope.
Types: bug, feature, enrich, route, data, deploy, test.

### /lg-enrich — Data enrichment workflow
Input: what to enrich (hooks, blurbs, walk_tier, areas, new POIs).
Steps:
1. Check current enrichment coverage (SQL stats)
2. Identify gaps (places without hooks, missing walk_tier, etc.)
3. Prepare Gemini prompt + batch config
4. **Destructive guard**: scan generated SQL before apply
5. Run enrichment (step1/step2)
6. Spot-check results
7. Report: N enriched, N errors, N remaining

Note: text polish (cozy diversification, capitalization, truncation) lives in `/lg-polish`.
This command does NOT include polish — call `/lg-polish` separately after enrichment.

### /lg-deploy — Deploy checklist
Three phases: pre-deploy, deploy, post-deploy. Post-deploy runs immediately
after push — migrations and enrichment don't wait for a separate session.

**Phase A: Pre-deploy checks**
1. Check branch status (release-candidate vs main)
2. List uncommitted changes
3. List unapplied migrations (local vs prod)
4. Check enrichment data sync status (local vs prod):
   - **Match by `osm_id`**, never by coordinates
   - Report: matched count, local-only count, prod-only count, mismatched fields
   - Flag venues without `osm_id` as unresolvable
5. Build API + frontend
6. **Destructive guard**: run `lg-migration-validator` on pending migrations.
   If DROP/DELETE found → STOP, show statements, require confirmation.
7. Report: ready / blocked. Show what will happen in post-deploy.

**Phase B: Deploy**
8. Push to release-candidate (or main)
9. Wait for Railway deploy (health endpoint poll)

**Phase C: Post-deploy (runs immediately, same session)**
10. Run prod migrations: `POST /v1/health/migrate`
11. Verify migrations applied: compare `_migrations` table vs expected
12. If enrichment diff exists (from step 4):
    - Run `/lg-sync` (local→prod, scope from diff)
    - Or run enrichment endpoint directly if new venues added
13. Spot-check: fetch 3 random venues from prod API, verify fields present
14. Final health check: `/v1/health`, count endpoints, sample recommendation

Post-deploy is NOT optional — if there are pending migrations or enrichment gaps,
the command continues through Phase C automatically. User can skip with explicit "skip post-deploy".

### /lg-route — Route debugging & testing (thin wrapper)
Input: lat, lng, duration, moods (or "test all").
Steps:
1. Spawn `lg-route-tester` agent with provided params
2. Wait for agent report
3. Format and display results interactively
4. If "test all" → show summary table with pass/fail per combination

All validation logic (chain quality, care rules, must_see coverage, diversity)
lives in the `lg-route-tester` agent. This command only manages params + display.

### /lg-data — Data quality audit (thin wrapper)
Steps:
1. Spawn `lg-enrichment-auditor` agent
2. Wait for agent report
3. Display coverage table + recommendations
4. Optionally suggest next action (/lg-enrich, /lg-polish, /lg-sync)

All audit queries and checks live in the `lg-enrichment-auditor` agent.
This command only manages display + follow-up suggestions.

### /lg-polish — Hook/description polish
Input: scope (hooks, blurbs, area descriptions, or "all").
Steps:
1. SQL stats: how many need fixing
2. Fix capitalization, trailing periods
3. Diversify overused words (category-aware bulk SQL):
   - "cozy" synonyms by category (warm/welcoming/inviting/pleasant/comfortable)
   - Other overused adjectives detected by frequency analysis
4. Complete truncated hooks
5. Verify: random sample
6. Report: N fixed

This is the **single owner** of text quality fixes. `/lg-enrich` does NOT polish.

### /lg-review — Pre-commit review
Steps:
1. git diff --stat
2. Check for debug console.log / console.debug / console.warn
3. Check for debug artifacts:
   - Inline debug styles: `color:red`, `color:green`, `background:yellow`, `border:.*debug`
   - MapLibre debug: `triggerRepaint`, `line-width` > 4, `circle-radius` > 8
   - Temporary test values: hardcoded lat/lng, `TODO`, `FIXME`, `HACK`
4. Check i18n key parity (ru vs en vs ka)
5. Check for uncommitted migration dependencies
6. Build both (API + frontend)
7. Report: blockers / warnings / ready

### /lg-seed — Seed data from specs
Input: source doc (compass_artifact, base-mest-zon, etc.)
Steps:
1. Parse POIs/routes from markdown spec
2. Generate migration SQL (INSERT venues + places)
3. Generate enrichment data (walk_tier, hook, route_moment)
4. Validate coordinates (Tbilisi bbox check)
5. **Destructive guard**: scan SQL for DROP/DELETE before showing preview.
   If destructive found → STOP, show statements, require confirmation.
6. Preview: show what will be added (non-destructive INSERTs)
7. Apply migration on approval

### /lg-sync — Prod enrichment sync (NEW)
Input: direction (local→prod or prod→local), scope (all, hooks, ratings, facets).
Steps:
1. Connect to both databases (local + prod)
2. Match venues by `osm_id` (never coordinates)
3. Compare fields per scope:
   - hooks: hook, hook_ru, blurb, blurb_ru
   - ratings: rating, ratingCount
   - facets: atmosphere, occasion, walk_tier
   - photos: googlePhotos array
   - hours: openingHours, openStatus
4. Report: N matched, N local-only, N prod-only, N with field differences
5. Show diff sample (first 5 mismatches with field-level detail)
6. On approval: sync missing data in chunks of 30 (NestJS body limit)
7. Verify: re-count after sync

---

## AGENTS (spawned by Claude, specialized)

Agent prompt templates live in `laziGoDocs/dev-tools/agent-templates.md` (versioned with code).
NOT in CLAUDE.md or memory — those bloat and drift from reality.

### lg-route-tester
Purpose: Test route generation quality. Used by `/lg-route` command.
Tools: Bash (node fetch), Read.
```
Test route generation:
- Params: {moods}, {duration}, {startLat}, {startLng}
  (or if "test all": 5 mood combos x 3 durations x 2 start points)
- For each: call POST /v1/routes/generate
- Validate per route:
  - Chain has 3-8 points
  - must_see venues used as anchors (role=anchor)
  - food_break inserted for half-day/full-day
  - Care rules fired where expected (C1-C8)
  - No duplicate venues
  - Total duration within budget (±20%)
  - Transitions have realistic walk times
- Call GET /v1/routes/top-places — check coverage
- Call GET /v1/routes/areas — check locale fields (ru/en/ka)
Report: table with pass/fail per combination, quality issues, empty results.
```

### lg-enrichment-auditor
Purpose: Audit data quality across all enrichment layers. Used by `/lg-data` command.
Tools: Bash (node fetch or psql), Read.
```
Run SQL queries to check:
- Venue count total, by walk_tier distribution
- hook coverage: has_hook / total, avg length, overused words (top 5 by frequency)
- hook_ru coverage (for RU voice enrichment tracking)
- blurb coverage: has_blurb / total
- Area descriptions: fields present for all 11 areas (RU: full_description_ru, who_for_ru, practice_ru)
- Facet coverage: atmosphere (%), occasion (%), cuisine (%)
- Photo coverage: googlePhotos non-empty (%)
- Opening hours coverage: has openingHours (%)
- Rating coverage: has rating (%)
- allowsDogs / goodForChildren coverage (%)
- Event sources health: per-source count, last_fetched, enabled status
- Facet IDF freshness: last computed date, facet count
Report as table with coverage % and recommendations.
```

### lg-prod-sync-checker (NEW)
Purpose: Compare local and prod data by `osm_id`. Used by `/lg-sync` command.
Tools: Bash (node fetch).
```
For a given scope (hooks/ratings/facets/photos/hours/all):
- Fetch local venue data (osm_id + requested fields)
- Fetch prod venue data (via API or direct DB)
- Join by osm_id
- Report:
  - N venues matched by osm_id
  - N local-only (no osm_id match on prod)
  - N prod-only (no osm_id match locally)
  - N with field differences (per field: local value vs prod value)
  - N venues without osm_id (unresolvable — flag as warning)
- Return structured diff for sync decision
```

### lg-i18n-checker
Purpose: Verify i18n key parity across locales.
Tools: Read, Grep.
```
Compare ru.json, en.json, ka.json:
- Keys in ru but not in en
- Keys in en but not in ru
- Keys missing from ka
- Placeholder mismatches ({0}, {{count}}, etc.)
- Empty values (key exists but value is "")
Report missing keys with suggested translations.
```

### lg-migration-validator
Purpose: Validate migration chain integrity. Called by `/lg-deploy` and `/lg-seed` before apply.
Tools: Bash (node fetch or psql), Read.
```
Check health.controller.ts MIGRATIONS array:
- Sequential numbering (no gaps, no duplicates)
- SQL syntax validation (basic: balanced parens, semicolons)
- Compare applied (from _migrations table) vs defined
- **Destructive scan**: flag DROP, DELETE, TRUNCATE, ALTER TABLE ... DROP COLUMN
  Return: { hasDestructive: true/false, statements: [...] }
- Check for data-loss risk: UPDATE without WHERE, DELETE without WHERE
Report: applied count, pending, destructive warnings, issues.
```

### lg-spec-reader
Purpose: Read and summarize product specs for context loading.
Tools: Read, Glob.
```
Read all specs in .workbench/mvp_lazy_day/v2-upd/ and laziGoDocs/.
Build a summary: what's specified, what's implemented, what's missing.
Focus on: route, palette, curator, areas, enrichment.
Return structured gap analysis.
```

### lg-map-debugger
Purpose: Debug MapLibre rendering issues.
Tools: Read, Grep.
```
Read route-map.component.ts. Check:
- SVG overlay vs GeoJSON approach (raster-only = no GeoJSON layers)
- Marker rendering (DOM-based)
- Area bounds rendering (SVG rectangles)
- Tile source configuration (CartoDB Voyager @2x)
- Event handlers (move, zoom, load)
- Debug artifacts: triggerRepaint, line-width > 4, test colors
Report: known issues, workarounds applied, potential improvements.
```

---

## Implementation Priority

### Phase 1 (immediate value):
1. `/lg-review` — catches debug artifacts before commit
2. `/lg-sync` + `lg-prod-sync-checker` — active pain point (17% vs 55%)
3. `/lg-data` (thin wrapper) + `lg-enrichment-auditor` — data health check
4. `/lg-enrich` — structured enrichment workflow

### Phase 2 (route stabilization):
5. `/lg-route` (thin wrapper) + `lg-route-tester` — route quality testing
6. `/lg-deploy` + `lg-migration-validator` — deploy checklist with safety
7. `/lg-polish` — text quality fixes

### Phase 3 (scaling):
8. `/lg-seed` — bulk POI addition from specs
9. `lg-i18n-checker` — locale parity
10. `lg-spec-reader` — context loading for new sessions

---

## File Structure

```
.claude/commands/
  lg-task.md
  lg-enrich.md
  lg-deploy.md
  lg-route.md
  lg-data.md
  lg-polish.md
  lg-review.md
  lg-seed.md
  lg-sync.md

laziGoDocs/dev-tools/
  commands-and-agents-spec.md    # this file
  agent-templates.md             # all agent prompt templates (versioned)
```

Agent prompt templates live in `agent-templates.md`, not in CLAUDE.md or memory.
This keeps them versioned with code and prevents CLAUDE.md bloat.

---

## Hooks

Commands that should run automatically on git events:

### Pre-commit hook (recommended)
Trigger: `git commit`
Action: subset of `/lg-review` (fast checks only, no build):
- debug console.log / console.debug
- inline debug styles (color:red, triggerRepaint, line-width > 4)
- hardcoded test coordinates
- i18n key parity (ru vs en)

### Post-deploy hook (manual trigger)
Trigger: after Railway deploy completes
Action: `/lg-deploy` step 9 (health endpoint verify)

### Pre-push hook (optional)
Trigger: `git push`
Action: full build check (API + frontend)

Hook implementation: Claude Code `settings.json` hooks, not git hooks.
Keeps them in the AI workflow, not in `.git/hooks/` (which doesn't version well).

---

## Key Principles

1. **Commands = thin wrappers, agents = logic owners**.
   Don't duplicate validation logic between command and agent.

2. **Destructive guard before any SQL apply**.
   DROP/DELETE = red flag. Additive migrations only (project policy).

3. **Stable ID for all sync**: `osm_id`, never float coordinates.

4. **Agent templates versioned in code** (`agent-templates.md`),
   not in CLAUDE.md or memory.

5. **One owner per concern**:
   - Text polish → `/lg-polish` (not `/lg-enrich`)
   - Route testing → `lg-route-tester` agent (not `/lg-route` command)
   - Data audit → `lg-enrichment-auditor` agent (not `/lg-data` command)
   - Destructive scan → `lg-migration-validator` agent (called by commands)

6. Don't use a command when an agent suffices.
   Don't spawn an agent when a simple Bash/SQL does the job.
