/**
 * OSM tag → LazyDay category mapping.
 * Priority: first match wins (more specific tags first).
 */

interface OsmTagRule {
  key: string;
  value: string | string[];
  category: string;
  tags: string[];
  indoor?: boolean;
}

export const OSM_CATEGORY_MAP: OsmTagRule[] = [
  // Food & Drink
  { key: 'amenity', value: 'restaurant', category: 'restaurant', tags: ['food', 'restaurant'], indoor: true },
  { key: 'amenity', value: 'cafe', category: 'cafe', tags: ['food', 'cafe'], indoor: true },
  { key: 'amenity', value: 'bar', category: 'bar', tags: ['food', 'bar', 'nightlife'], indoor: true },
  { key: 'amenity', value: 'pub', category: 'bar', tags: ['food', 'bar', 'nightlife'], indoor: true },
  { key: 'amenity', value: 'fast_food', category: 'restaurant', tags: ['food', 'fast_food'], indoor: true },
  { key: 'shop', value: 'bakery', category: 'bakery', tags: ['food', 'bakery'], indoor: true },

  // Culture
  { key: 'tourism', value: 'museum', category: 'museum', tags: ['culture', 'museum'], indoor: true },
  { key: 'amenity', value: 'museum', category: 'museum', tags: ['culture', 'museum'], indoor: true },
  { key: 'tourism', value: 'gallery', category: 'gallery', tags: ['culture', 'gallery'], indoor: true },
  { key: 'amenity', value: 'arts_centre', category: 'gallery', tags: ['culture', 'gallery'], indoor: true },
  { key: 'amenity', value: 'theatre', category: 'theater', tags: ['culture', 'theater'], indoor: true },
  { key: 'amenity', value: 'library', category: 'museum', tags: ['culture', 'library'], indoor: true },

  // Entertainment
  { key: 'amenity', value: 'cinema', category: 'cinema', tags: ['entertainment', 'cinema'], indoor: true },
  { key: 'amenity', value: 'nightclub', category: 'club', tags: ['entertainment', 'club', 'nightlife'], indoor: true },

  // Outdoor
  { key: 'leisure', value: 'park', category: 'park', tags: ['outdoor', 'park'], indoor: false },
  { key: 'leisure', value: 'garden', category: 'park', tags: ['outdoor', 'park', 'garden'], indoor: false },
  { key: 'tourism', value: 'viewpoint', category: 'viewpoint', tags: ['outdoor', 'viewpoint'], indoor: false },
  { key: 'tourism', value: 'attraction', category: 'viewpoint', tags: ['outdoor', 'attraction'] },
  { key: 'tourism', value: 'artwork', category: 'viewpoint', tags: ['culture', 'artwork'], indoor: false },
  { key: 'leisure', value: 'playground', category: 'park', tags: ['outdoor', 'playground', 'family'], indoor: false },

  // Shopping
  { key: 'shop', value: 'mall', category: 'mall', tags: ['shopping', 'mall'], indoor: true },
  { key: 'shop', value: 'department_store', category: 'mall', tags: ['shopping', 'mall'], indoor: true },

  // Wellness
  { key: 'leisure', value: 'swimming_pool', category: 'spa', tags: ['wellness', 'swimming'], indoor: true },
  { key: 'leisure', value: 'sports_centre', category: 'gym', tags: ['wellness', 'gym', 'sports'], indoor: true },
  { key: 'leisure', value: 'fitness_centre', category: 'gym', tags: ['wellness', 'gym', 'sports'], indoor: true },
  { key: 'amenity', value: 'public_bath', category: 'bath', tags: ['wellness', 'bath'], indoor: true },

  // Activities & Entertainment
  { key: 'leisure', value: 'bowling_alley', category: 'entertainment', tags: ['entertainment', 'bowling', 'sports'], indoor: true },
  { key: 'leisure', value: 'escape_game', category: 'entertainment', tags: ['entertainment', 'escape_room'], indoor: true },
  { key: 'leisure', value: 'amusement_arcade', category: 'entertainment', tags: ['entertainment', 'gaming', 'arcade'], indoor: true },
  { key: 'leisure', value: 'water_park', category: 'entertainment', tags: ['entertainment', 'water_park', 'family'], indoor: false },
  { key: 'leisure', value: 'trampoline_park', category: 'entertainment', tags: ['entertainment', 'trampoline', 'family', 'sports'], indoor: true },
  { key: 'sport', value: 'climbing', category: 'gym', tags: ['sports', 'climbing', 'outdoor'], indoor: false },
  { key: 'sport', value: 'karting', category: 'entertainment', tags: ['entertainment', 'karting', 'sports'], indoor: false },
  { key: 'sport', value: 'paintball', category: 'entertainment', tags: ['entertainment', 'paintball', 'sports', 'outdoor'], indoor: false },
];

export function mapOsmCategory(
  tags: Record<string, string>,
): { category: string; tags: string[]; indoor?: boolean } | null {
  for (const rule of OSM_CATEGORY_MAP) {
    const val = tags[rule.key];
    if (!val) continue;
    const matches = Array.isArray(rule.value)
      ? rule.value.includes(val)
      : val === rule.value;
    if (matches) {
      return { category: rule.category, tags: rule.tags, indoor: rule.indoor };
    }
  }
  return null;
}
