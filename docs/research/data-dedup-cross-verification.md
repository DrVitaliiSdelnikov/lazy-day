# LazyDay — Data Dedup & Cross-Verification Spec

How to connect new map providers (Yandex, later Apple) without duplicates
and with data quality benefits. Built on existing tables
`source_items`, `source_refs`, `dedup_candidates`.

---

## 1. Model: star, not mesh

Canonical entity — `venue` (our UUID). Providers are attribute-references.

```
                OSM ────────┐
                Google ─────┼──→  venue (canon)
                Yandex ─────┤
                Apple ──────┘
```

Rules:
- Each new provider matches **against canon**, never against another
  provider. N providers = N pipelines, not N².
- Raw provider data immutably stored in `source_items` (payload JSONB).
  Merge is never destructive: any link can be broken.
- Links in `source_refs`:

```sql
ALTER TABLE source_refs ADD COLUMN IF NOT EXISTS
  match_score NUMERIC,            -- final match score 0..1
  matched_by TEXT,                -- 'auto' | 'llm' | 'manual'
  matched_at TIMESTAMPTZ,
  match_features JSONB;           -- { phone: 1, name: .84, dist_m: 42, ... } for debug

-- provider identifiers on venue
ALTER TABLE venues ADD COLUMN IF NOT EXISTS
  yandex_org_id TEXT,             -- google_place_id already exists
  apple_place_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_venues_yandex ON venues (yandex_org_id)
  WHERE yandex_org_id IS NOT NULL;
```

## 2. Matching pipeline

```
provider candidate
  → BLOCKING (rough filter)
  → SCORING (weighted features)
  → ZONES: auto-merge | gray (LLM) | new entity
```

### 2.1 Blocking

Compare candidate only with venues where:
- `ST_DWithin(geom, point, 150)` — 150m (providers diverge by 20–80m:
  entrance vs building centroid; 150 with margin);
  - **Exception**: 300m for `leisure=park` / `tourism=attraction` (centroid vs entrance can be far)
- Category compatible (mapping of provider categories → ours, compatibility
  table: `cafe`≈`restaurant`≈`bar` compatible, `park`≠`restaurant`).

Everything that doesn't pass blocking is not compared at all.

### 2.2 Scoring

```
score = 0.35·phone + 0.20·website + 0.30·name + 0.10·distance + 0.05·housenumber
```

| Feature | How to compute | Note |
|---|---|---|
| phone | normalize to E.164 (+995...), exact match → 1 | strongest cross-provider key |
| website | domain without www/protocol/utm/trailing slash, match → 1; eTLD+1 only → 0.7 | compare social links (instagram.com/...) by full path |
| name | max across all pairs of localized names after normalization (§3), token_set_ratio | 0..1 |
| distance | exp(−d/60): 0m→1, 60m→0.37, 120m→0.14 | don't count as equality |
| housenumber | extract house number from addresses, match → 1 | auxiliary |

Missing feature — weight redistributed to remaining
(normalize by sum of available weights), not counted as zero:
OSM often has no phone — this shouldn't sink the match.

**Phone normalization for Georgia:**
- Format: `+995 XXX XX XX XX`
- Yandex sometimes returns without country code → `0XXX...` → `+995XXX...`
- Google usually with code
- Strip spaces, dashes, parens before comparison

### 2.3 Zones

| Score | Action |
|---|---|
| ≥ 0.80 | auto-merge: write to `source_refs (matched_by='auto')`, provider id on venue |
| 0.50–0.79 | gray zone → `dedup_candidates` → LLM arbiter (§4) |
| < 0.50 | new venue entity (candidate is not ours) |

Special case: phone matched but name < 0.3 — not auto-merge, gray zone
(chain establishments with shared call center, neighbors in same mall).

Thresholds are starting values; calibrate on manual sample of 100 pairs (§7).

## 3. Name normalization (main Tbilisi trap)

Google returns en/ka, Yandex — ru/ka, OSM — whatever. Direct fuzzy between
"Черепашье озеро" and "Turtle Lake" gives ~0.

Normalization pipeline for each name:
1. lowercase, trim, collapse whitespace;
2. remove organizational suffixes: ООО, ИП, LLC, Ltd, შპს, სს;
3. remove category stop-words: кафе/café/კაფე, ресторан/restaurant/
   რესტორანი, бар/bar/ბარი, отель/hotel etc. (dictionary ~30 words × 3 languages);
4. transliterate to Latin: ka→lat and ru→lat by deterministic tables
   (do NOT translate! only transliterate: "Черепашье" → "cherepashe");
5. remove punctuation and diacritics.

Comparison: all pairs (our name/name_en/name_ka × candidate names),
take maximum. Translation mismatches ("Черепашье озеро" vs "Turtle Lake")
transliteration won't save — that's honest work for gray zone and LLM.

## 4. Gray zone → local LLM

Same principle as in watchdog ss.ge: hard filters in code, LLM only
on pre-filtered remainder. Gray zone — hundreds of pairs, not thousands.

- Input: two cards (all names, address, phone, website, category, distance).
- Prompt: "same establishment? SAME | DIFFERENT | UNSURE + reason in one
  line". Model: qwen2.5:7b locally, in batches.
- SAME → merge `matched_by='llm'`; DIFFERENT → new entity;
  UNSURE → stays in `dedup_candidates` for manual review (CLI command:
  show pair, y/n — no admin panel needed).
- LLM verdicts with reason go to `dedup_candidates.reason` — this is a dataset
  for future threshold calibration.

## 5. Merge field policy (not "last wins")

| Field | Rule |
|---|---|
| Ratings | **per-provider**, no averaging: `google_rating`, `yandex_rating` (+counts). In card — one by rule "more reviews" |
| name (ru) | Yandex > Google > OSM |
| name_en | Google > OSM > transliteration |
| name_ka | OSM > Google > Yandex |
| Opening hours | most recent structured source (fetched_at); conflict of two fresh → flag for review |
| Phone/website | most recent; conflict → both in attributes, primary from provider with higher trust |
| Coordinates | don't touch after initial import (OSM usually more accurate for entrance); shift only manually. Exception: venues without OSM source (created from Google/Yandex) — can update coords. Consider `coords_source` field. |
| status | §6 |

## 6. Cross-verification of closures — main Yandex benefit

For the region, Yandex learns about venue closures faster than Google. Voting rule:

- "closed" from **one** provider → `status_suspect = true`, stays in feed, log;
- "closed" from **two+** (or from the only provider that knows the place) →
  `status = 'permanently_closed'` → hard-filter from feed;
- disagreement "Google: open, Yandex: closed" hold no longer than 30 days —
  then manual verdict (CLI queue, usually single-digit venues).

This directly strengthens the existing closed-venues filter.

## 7. Implementation order

1. **Formalize matcher on OSM↔Google pair** (currently implicit in
   enrichment): scoring §2, zones, `match_features`. Run on current 3.1k.
   This is also retrospective validation of current 1,755 matches — may find false merges.
2. Manual sample 100 pairs from auto-merges + 50 from gray zone → compute
   precision. Target: auto-zone ≥ 98% correct merges. Tune thresholds.
3. LLM arbiter for gray zone (reuse harness from watchdog).
4. **Yandex adapter** plugs into ready pipeline: fetch by bbox (reuse Tbilisi bbox
   from OSM import, split into ~500m tiles for rate limits) → blocking → scoring → zones.
   Plus closure rule §6.
5. Apple — same path, when time permits (MapKit Server API).

## 8. Provider gotchas

- **Yandex returns coordinates in lon,lat order** (Geocoder/Organizations API) —
  swapping axes = half the city in the Caspian Sea. Explicit test on import:
  point must fall within city bbox.
- `oid` in Yandex is stable, but on re-moderation an organization can be
  recreated with a new oid — store `matched_at`, fix broken links via
  re-matching, not manually.
- Rate limits: Yandex free tier is strict — batch jobs with pauses,
  incrementally by tiles, not "entire city overnight".

## 9. Legal note

- Google Places ToS: can permanently store only `place_id`; other content
  is cache up to 30 days (formally). At MVP scale risk is theoretical,
  but architecturally maintain the rule: external data is **signals for our
  decision** (status, verification), not "showing Yandex data on top of Google".
- Yandex prohibits using API data on third-party maps — we have no maps in
  UI, ok; if maps appear — verify.

## 10. Quality metrics

- Share of venues with ≥2 providers (cross-verification coverage);
- Auto-merge precision (manual sample, monthly after connecting a source);
- Duplicates per 1000 venues (manual sample);
- Time "venue death → closed in our system" (random checks);
- UNSURE queue size (should not grow indefinitely).
