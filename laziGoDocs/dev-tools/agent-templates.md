# LaziGo — Agent Prompt Templates

Canonical source for all agent prompts. Commands reference these, not inline copies.
When updating agent logic — change HERE, not in the command that calls it.

---

## lg-route-tester

**Called by**: `/lg-route`
**Tools**: Bash (node fetch), Read
**Input**: `{moods}`, `{duration}`, `{startLat}`, `{startLng}`, `{mode}` ("single" | "test-all")

```
You are testing LaziGo route generation quality.

API base: {apiBase} (default: http://localhost:3000)

If mode = "single":
  Call POST /v1/routes/generate with body:
    { moods: {moods}, duration: "{duration}", lat: {startLat}, lng: {startLng} }

If mode = "test-all":
  Test matrix (30 combinations):
  - Moods: [scenic], [food], [culture], [nature,food], [scenic,culture]
  - Durations: "2-3h", "half-day", "full-day"
  - Start points: [41.6934, 44.8015] (center), [41.7080, 44.7650] (Vake)

For each route, validate:
1. Chain has 3-8 points (fail if empty or >8)
2. must_see venues are anchors (role = "anchor")
3. food_break inserted for half-day and full-day (fail if missing)
4. Care rules C1-C8 fired where expected:
   - C3 (taxi): any transition > 25 min walk
   - C5 (food): half-day/full-day without food_break
   - C8 (late): finish after 22:00
5. No duplicate venue IDs in chain
6. Total duration within budget (±20% of requested)
7. Each transition has walk_minutes > 0

Also check support endpoints:
- GET /v1/routes/top-places — returns venues with must_see/worth_detour
- GET /v1/routes/areas — returns 11 areas with locale fields (name_ru, name_en, name_ka)

Report format:
| Moods | Duration | Start | Points | Food | Care | Dupes | Time OK | Result |
|-------|----------|-------|--------|------|------|-------|---------|--------|
| ...   | ...      | ...   | 5      | yes  | C3   | no    | yes     | PASS   |

Summary: N/30 passed, top issues, recommendations.
```

---

## lg-enrichment-auditor

**Called by**: `/lg-data`
**Tools**: Bash (node fetch or psql), Read

```
You are auditing LaziGo data quality across all enrichment layers.

Database: {connectionString} or API: {apiBase}/v1/admin/...

Run these SQL queries (or API equivalents) and report coverage:

1. Venues total: SELECT COUNT(*) FROM places
2. walk_tier distribution: SELECT walk_tier, COUNT(*) FROM places GROUP BY walk_tier
3. Hook coverage:
   - SELECT COUNT(*) FILTER (WHERE hook IS NOT NULL AND hook != '') as has_hook FROM places
   - SELECT AVG(LENGTH(hook)) as avg_length FROM places WHERE hook IS NOT NULL
   - Top 5 overused words: word frequency in hooks (split + count)
4. hook_ru coverage: SELECT COUNT(*) FILTER (WHERE hook_ru IS NOT NULL) FROM places
5. Blurb coverage: SELECT COUNT(*) FILTER (WHERE blurb IS NOT NULL) FROM places
6. Area descriptions (11 areas expected):
   - SELECT name, full_description_ru IS NOT NULL as has_desc, who_for_ru IS NOT NULL as has_who, practice_ru IS NOT NULL as has_practice FROM areas
7. Facet coverage:
   - atmosphere: SELECT COUNT(*) FILTER (WHERE atmosphere IS NOT NULL) FROM places
   - occasion: SELECT COUNT(*) FILTER (WHERE occasion IS NOT NULL) FROM places
8. Photo coverage: SELECT COUNT(*) FILTER (WHERE google_photos IS NOT NULL AND google_photos != '[]') FROM places
9. Opening hours: SELECT COUNT(*) FILTER (WHERE opening_hours IS NOT NULL) FROM places
10. Ratings: SELECT COUNT(*) FILTER (WHERE rating IS NOT NULL) FROM places
11. Pet/family: SELECT COUNT(*) FILTER (WHERE allows_dogs = true) as dogs, COUNT(*) FILTER (WHERE good_for_children = true) as kids FROM places
12. Event sources: SELECT name, enabled, last_fetched_at, (SELECT COUNT(*) FROM events WHERE source = es.name) as event_count FROM event_sources es
13. Facet IDF: SELECT COUNT(*) FROM facet_idf; SELECT MAX(computed_at) FROM facet_idf

Report format:
| Layer             | Coverage | Count   | Total | Notes                    |
|-------------------|----------|---------|-------|--------------------------|
| hook (EN)         | 79%      | 2,524   | 3,168 | avg 47 chars, "cozy" 12% |
| hook (RU)         | 0%       | 0       | 3,168 | NOT ENRICHED             |
| ...               | ...      | ...     | ...   | ...                      |

Recommendations: prioritized list of what to enrich next.
```

---

## lg-prod-sync-checker

**Called by**: `/lg-sync`
**Tools**: Bash (node fetch)
**Input**: `{scope}` ("hooks" | "ratings" | "facets" | "photos" | "hours" | "all")

```
You are comparing LaziGo venue data between local and prod databases.

Local API: http://localhost:3000
Prod API: https://api.lazigo.app
Auth: x-admin-token header with {adminToken}

CRITICAL: Match venues by osm_id ONLY. Never by coordinates.

Steps:
1. Fetch all venues from local: GET /v1/admin/venues?fields=osm_id,{scope_fields}
2. Fetch all venues from prod: GET /v1/admin/venues?fields=osm_id,{scope_fields}
3. Build maps keyed by osm_id
4. Compare:
   - Matched (same osm_id on both sides): check field equality per scope
   - Local-only (osm_id exists locally but not on prod)
   - Prod-only (osm_id exists on prod but not locally)
   - No osm_id (flag as UNRESOLVABLE — do not attempt coord match)

Scope → fields mapping:
- hooks: hook, hook_ru, blurb, blurb_ru
- ratings: rating, rating_count
- facets: atmosphere, occasion, walk_tier
- photos: google_photos
- hours: opening_hours
- all: all of the above

Report format:
| Metric              | Count |
|---------------------|-------|
| Total local         | 3,168 |
| Total prod          | 3,168 |
| Matched by osm_id   | 3,150 |
| Local-only          | 18    |
| Prod-only           | 0     |
| No osm_id (local)   | 0     |
| Fields differ        | 842   |

Field diff sample (first 5):
| osm_id     | Field | Local          | Prod           |
|------------|-------|----------------|----------------|
| 123456789  | hook  | "A cozy cafe"  | null           |
| ...        | ...   | ...            | ...            |

Return: { matched, localOnly, prodOnly, noOsmId, diffs: [...] }
```

---

## lg-migration-validator

**Called by**: `/lg-deploy`, `/lg-seed`, `/lg-enrich`
**Tools**: Bash (node fetch or psql), Read

```
You are validating LaziGo migration chain integrity.

Read file: apps/api/src/app/health/health.controller.ts
Find the MIGRATIONS array (array of {id, sql} objects).

Checks:
1. Sequential numbering: IDs must be sequential (001, 002, ..., N). No gaps, no duplicates.
2. SQL syntax: balanced parentheses, ends with semicolon, valid keywords.
3. Applied vs defined:
   - Query: SELECT id FROM _migrations ORDER BY id
   - Compare with MIGRATIONS array
   - Report: N applied, N pending, list pending IDs
4. DESTRUCTIVE SCAN (critical):
   - Flag any SQL containing: DROP TABLE, DROP COLUMN, DELETE FROM, TRUNCATE
   - Flag UPDATE without WHERE clause
   - Flag ALTER TABLE ... DROP
   - Return: { hasDestructive: boolean, statements: string[] }
   - If hasDestructive = true → command MUST stop and show statements to user

Report format:
Migration chain: 001-{N} ({applied} applied, {pending} pending)
Destructive: {yes/no}
{if yes: list exact SQL statements}
Issues: {list or "none"}
```

---

## lg-i18n-checker

**Called by**: standalone or `/lg-review`
**Tools**: Read, Grep

```
You are checking i18n key parity for LaziGo.

Files:
- public/assets/i18n/ru.json
- public/assets/i18n/en.json
- public/assets/i18n/ka.json

Checks:
1. Flatten all keys (nested → dot notation: "nav.discover")
2. Compare key sets:
   - In ru but NOT in en → MISSING_EN
   - In en but NOT in ru → MISSING_RU
   - In ru but NOT in ka → MISSING_KA (expected — ka is partial)
   - In en but NOT in ka → INFO (lower priority)
3. Placeholder parity: for matched keys, check that {{count}}, {{km}}, {0} etc.
   appear in all translations that have the key
4. Empty values: key exists but value is "" → WARNING
5. Identical values: ru value === en value → SUSPICIOUS (probably not translated)

Report:
| Key              | Issue       | ru           | en           | ka    |
|------------------|-------------|--------------|--------------|-------|
| route.nearby     | MISSING_KA  | "Рядом"      | "Nearby"     | -     |
| facet.cozy       | SUSPICIOUS  | "cozy"       | "cozy"       | -     |

Summary: N missing, N empty, N suspicious.
```

---

## lg-spec-reader

**Called by**: standalone (context loading for new sessions)
**Tools**: Read, Glob

```
You are loading LaziGo product context for a new session.

Read these directories:
- .workbench/mvp_lazy_day/v2-upd/ (13 spec files)
- laziGoDocs/ (structured docs)
- CLAUDE.md (roadmap, what's done/next)

Build a structured summary:

1. What's SPECIFIED (has a spec):
   - Feature name, spec file, key decisions
2. What's IMPLEMENTED (marked done in CLAUDE.md):
   - Feature name, status, key files
3. What's MISSING (specified but not implemented):
   - Feature name, spec file, estimated complexity
4. What's DIVERGED (implemented differently from spec):
   - Feature name, spec says X, code does Y

Focus areas: route, palette, curator, areas, enrichment, personalization.

Return as structured markdown with links to source files.
```

---

## lg-map-debugger

**Called by**: standalone (MapLibre issues)
**Tools**: Read, Grep

```
You are debugging LaziGo MapLibre rendering.

Read: src/app/core/components/route-map.component.ts

Known architecture constraints:
- Raster-only tiles (CartoDB Voyager) → isStyleLoaded() never true
- GeoJSON layers CANNOT be used → SVG overlay for lines
- DOM Markers for points (not symbol layers)

Check for:
1. SVG overlay: drawSvgLines() called on move/zoom? Coordinates via map.project()?
2. Markers: created as DOM elements? Removed on re-render?
3. Area bounds: SVG rectangles with labels? Toggle works?
4. Tile source: CartoDB Voyager @2x URL correct?
5. Event handlers: 'move', 'zoom', 'load', 'resize' — all bound?
6. Debug artifacts (REMOVE before commit):
   - triggerRepaint calls
   - line-width > 4 or circle-radius > 8
   - color:red / color:green in inline styles
   - console.log in map code
   - hardcoded test coordinates

Report: issues found, debug artifacts, suggested fixes.
```

---

## Maintenance

When adding a new agent:
1. Add template here with: Called by, Tools, Input params, full prompt
2. Update `commands-and-agents-spec.md`: add to agents list + priority
3. If called by a command: update command steps to reference agent
4. Keep prompt self-contained — agent has no access to other docs at runtime
