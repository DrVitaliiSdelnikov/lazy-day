/**
 * Canonical interest presets — SINGLE SOURCE OF TRUTH.
 *
 * Used by: landing, discover presets, tune block, onboarding.
 * Do NOT duplicate these definitions in components.
 *
 * Weight scheme:
 *   1.0 — primary interest, explicitly selected
 *   0.5 — associated interest, logically linked
 *   0.3 — weak association
 */

export const CANONICAL_PRESETS: Record<string, Record<string, number>> = {
  chill:         { nature: 0.8, food: 0.5, spa: 0.5 },
  food:          { food: 1.0 },
  culture:       { culture: 1.0, food: 0.3 },
  active:        { active: 1.0, sports: 0.5 },
  family:        { family: 1.0, nature: 0.5, entertainment: 0.5 },
  nightlife:     { nightlife: 1.0, entertainment: 0.5 },
  gym:           { gym: 1.0, sports: 0.5 },
  entertainment: { entertainment: 1.0, nightlife: 0.3 },
  spa:           { spa: 1.0 },
};

export const CANONICAL_RADIUS: Record<string, number> = {
  chill: 5000,
  food: 5000,
  culture: 10000,
  active: 10000,
  family: 8000,
  nightlife: 10000,
  gym: 10000,
  entertainment: 10000,
  spa: 8000,
};

/** Preset metadata for UI rendering (icon + i18n key) */
export const PRESET_META: Array<{ key: string; labelKey: string; icon: string }> = [
  { key: 'chill',         labelKey: 'preset.chill',         icon: 'trees' },
  { key: 'food',          labelKey: 'preset.food',          icon: 'tools-kitchen-2' },
  { key: 'culture',       labelKey: 'preset.culture',       icon: 'masks-theater' },
  { key: 'active',        labelKey: 'preset.active',        icon: 'run' },
  { key: 'family',        labelKey: 'preset.family',        icon: 'balloon' },
  { key: 'nightlife',     labelKey: 'preset.nightlife',     icon: 'moon' },
  { key: 'gym',           labelKey: 'preset.gym',           icon: 'barbell' },
  { key: 'entertainment', labelKey: 'preset.entertainment', icon: 'movie' },
  { key: 'spa',           labelKey: 'preset.spa',           icon: 'coffee' },
];

/** Interest options for onboarding / tune block (uses interest.* i18n keys) */
export const INTEREST_OPTIONS: Array<{ slug: string; labelKey: string; icon: string }> = [
  { slug: 'nature',        labelKey: 'interest.nature',        icon: 'trees' },
  { slug: 'food',          labelKey: 'interest.food',          icon: 'tools-kitchen-2' },
  { slug: 'culture',       labelKey: 'interest.culture',       icon: 'masks-theater' },
  { slug: 'active',        labelKey: 'interest.active',        icon: 'run' },
  { slug: 'entertainment', labelKey: 'interest.entertainment', icon: 'movie' },
  { slug: 'nightlife',     labelKey: 'interest.nightlife',     icon: 'moon' },
  { slug: 'family',        labelKey: 'interest.family',        icon: 'balloon' },
  { slug: 'spa',           labelKey: 'interest.spa',           icon: 'coffee' },
  { slug: 'gym',           labelKey: 'interest.gym',           icon: 'barbell' },
];
