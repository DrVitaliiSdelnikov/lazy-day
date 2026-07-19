/**
 * Synthetic venue fixtures for personalization validation.
 * 15 venues with hand-assigned facets so expected rankings are obvious by eye.
 * Used by: McDonald's test, preference-recovery, invariant suite, persona tests.
 */

export interface TestVenue {
  id: string;
  name: string;
  category: string;
  tags: string[];
  facetCuisine: string[] | null;
  facetFormat: string[] | null;
  facetAtmosphere: string[];
  facetOccasion: string[];
  facetPriceTier: number | null;
  googleRating: number | null;
  distanceM: number;
  isChain?: boolean;
  chainKey?: string;
}

export const TEST_VENUES: TestVenue[] = [
  // === Upscale fine dining (3) — target for "foodie" persona ===
  {
    id: 'v-fine-1', name: 'Château Mukhrani', category: 'restaurant',
    tags: ['food', 'restaurant'],
    facetCuisine: ['georgian'], facetFormat: ['fine_dining'],
    facetAtmosphere: ['upscale', 'romantic'], facetOccasion: ['date', 'celebration'],
    facetPriceTier: 5, googleRating: 4.8, distanceM: 800,
  },
  {
    id: 'v-fine-2', name: 'Wine Gallery', category: 'restaurant',
    tags: ['food', 'bar', 'nightlife'],
    facetCuisine: ['georgian'], facetFormat: ['wine_bar'],
    facetAtmosphere: ['upscale', 'cozy', 'live_music'], facetOccasion: ['date'],
    facetPriceTier: 4, googleRating: 4.7, distanceM: 1200,
  },
  {
    id: 'v-fine-3', name: 'Barbarestan', category: 'restaurant',
    tags: ['food', 'restaurant'],
    facetCuisine: ['georgian'], facetFormat: ['fine_dining'],
    facetAtmosphere: ['upscale', 'cultural', 'traditional'], facetOccasion: ['celebration'],
    facetPriceTier: 5, googleRating: 4.9, distanceM: 500,
  },

  // === McDonald's (cheap, chain) — must NOT outrank fine dining after likes ===
  {
    id: 'v-mcdonalds', name: "McDonald's", category: 'restaurant',
    tags: ['food', 'restaurant'],
    facetCuisine: ['burgers'], facetFormat: ['fast_food'],
    facetAtmosphere: ['casual', 'family_friendly'], facetOccasion: ['quick_stop'],
    facetPriceTier: 1, googleRating: 3.5, distanceM: 300,
    isChain: true, chainKey: 'mcdonalds',
  },

  // === Budget café ===
  {
    id: 'v-budget-cafe', name: 'Tone Café', category: 'cafe',
    tags: ['food', 'cafe'],
    facetCuisine: null, facetFormat: ['cafe'],
    facetAtmosphere: ['casual', 'work_friendly'], facetOccasion: ['solo', 'quick_stop'],
    facetPriceTier: 1, googleRating: 4.0, distanceM: 200,
  },

  // === Wine bar (rare format, high IDF) ===
  {
    id: 'v-wine-1', name: 'Vino Underground', category: 'bar',
    tags: ['bar', 'nightlife'],
    facetCuisine: null, facetFormat: ['wine_bar'],
    facetAtmosphere: ['cozy', 'romantic', 'quiet'], facetOccasion: ['date'],
    facetPriceTier: 4, googleRating: 4.6, distanceM: 900,
  },

  // === Nightclub ===
  {
    id: 'v-club-1', name: 'Bassiani', category: 'club',
    tags: ['nightlife', 'club', 'entertainment'],
    facetCuisine: null, facetFormat: ['club'],
    facetAtmosphere: ['lively', 'trendy'], facetOccasion: ['friends', 'celebration'],
    facetPriceTier: 3, googleRating: 3.5, distanceM: 3000,
  },

  // === Family restaurant ===
  {
    id: 'v-family-1', name: 'Samikitno', category: 'restaurant',
    tags: ['food', 'restaurant'],
    facetCuisine: ['georgian'], facetFormat: ['family'],
    facetAtmosphere: ['family_friendly', 'traditional', 'casual'], facetOccasion: ['family_outing'],
    facetPriceTier: 2, googleRating: 4.3, distanceM: 600,
  },

  // === Park (non-food) ===
  {
    id: 'v-park-1', name: 'Mtatsminda Park', category: 'park',
    tags: ['outdoor', 'park'],
    facetCuisine: null, facetFormat: null,
    facetAtmosphere: ['outdoorsy', 'family_friendly', 'scenic'], facetOccasion: ['family_outing', 'exploring'],
    facetPriceTier: 1, googleRating: 4.4, distanceM: 2000,
  },

  // === Museum ===
  {
    id: 'v-museum-1', name: 'National Museum', category: 'museum',
    tags: ['culture', 'museum'],
    facetCuisine: null, facetFormat: null,
    facetAtmosphere: ['cultural', 'quiet'], facetOccasion: ['exploring', 'solo'],
    facetPriceTier: 1, googleRating: 4.5, distanceM: 1500,
  },

  // === Bar with live music ===
  {
    id: 'v-bar-music', name: 'Dzveli Ubani Jazz', category: 'bar',
    tags: ['bar', 'nightlife', 'food'],
    facetCuisine: null, facetFormat: ['bar'],
    facetAtmosphere: ['lively', 'live_music', 'cozy'], facetOccasion: ['friends', 'date'],
    facetPriceTier: 3, googleRating: 4.5, distanceM: 700,
  },

  // === Bakery (cheap, morning) ===
  {
    id: 'v-bakery-1', name: 'Tone Bread', category: 'bakery',
    tags: ['food', 'bakery'],
    facetCuisine: null, facetFormat: ['bakery'],
    facetAtmosphere: ['casual', 'traditional'], facetOccasion: ['quick_stop'],
    facetPriceTier: 1, googleRating: 4.1, distanceM: 150,
  },

  // === Spa ===
  {
    id: 'v-spa-1', name: 'Royal Bath', category: 'spa',
    tags: ['bath', 'spa'],
    facetCuisine: null, facetFormat: null,
    facetAtmosphere: ['quiet', 'romantic', 'traditional'], facetOccasion: ['date', 'solo'],
    facetPriceTier: 3, googleRating: 4.3, distanceM: 1800,
  },

  // === Rare cuisine (sushi — high IDF ~7.0) ===
  {
    id: 'v-rare-1', name: 'Sushi House', category: 'restaurant',
    tags: ['food', 'restaurant'],
    facetCuisine: ['sushi'], facetFormat: ['restaurant'],
    facetAtmosphere: ['quiet', 'upscale'], facetOccasion: ['date'],
    facetPriceTier: 4, googleRating: 4.4, distanceM: 1100,
  },

  // === Common cuisine (georgian — low IDF ~2.8) ===
  {
    id: 'v-common-1', name: 'Khinkali House', category: 'restaurant',
    tags: ['food', 'restaurant'],
    facetCuisine: ['georgian'], facetFormat: ['restaurant'],
    facetAtmosphere: ['casual', 'traditional'], facetOccasion: ['friends', 'family_outing'],
    facetPriceTier: 2, googleRating: 4.2, distanceM: 400,
  },
];

/**
 * Pre-computed IDF values for test facets.
 * Based on real catalog: 3,168 venues, 131 facets.
 */
export const TEST_IDF: Record<string, number> = {
  // Cuisine
  'cuisine:georgian': 2.83,
  'cuisine:burgers': 5.07,
  'cuisine:sushi': 6.68,

  // Format
  'format:fine_dining': 6.37,
  'format:fast_food': 3.24,
  'format:wine_bar': 4.27,
  'format:cafe': 2.29,
  'format:club': 4.48,
  'format:family': 4.73,
  'format:bar': 2.56,
  'format:bakery': 3.32,
  'format:restaurant': 1.25,

  // Atmosphere
  'atmosphere:upscale': 4.50,
  'atmosphere:romantic': 3.80,
  'atmosphere:cozy': 3.20,
  'atmosphere:live_music': 3.60,
  'atmosphere:casual': 2.50,
  'atmosphere:family_friendly': 2.70,
  'atmosphere:lively': 3.10,
  'atmosphere:trendy': 3.90,
  'atmosphere:cultural': 3.40,
  'atmosphere:traditional': 2.90,
  'atmosphere:work_friendly': 4.20,
  'atmosphere:quiet': 3.50,
  'atmosphere:outdoorsy': 3.70,
  'atmosphere:scenic': 4.10,

  // Occasion
  'occasion:date': 3.20,
  'occasion:celebration': 4.00,
  'occasion:friends': 2.80,
  'occasion:family_outing': 3.50,
  'occasion:quick_stop': 3.10,
  'occasion:solo': 3.60,
  'occasion:exploring': 3.40,

  // Price
  'price:1': 2.50,
  'price:2': 3.00,
  'price:3': 2.80,
  'price:4': 4.20,
  'price:5': 5.50,
};

/**
 * Extract facets from a test venue (same format as TasteProfileService).
 */
export function extractTestFacets(v: TestVenue): Array<{ type: string; value: string }> {
  const facets: Array<{ type: string; value: string }> = [];
  for (const c of v.facetCuisine ?? []) facets.push({ type: 'cuisine', value: c });
  for (const f of v.facetFormat ?? []) facets.push({ type: 'format', value: f });
  for (const a of v.facetAtmosphere ?? []) facets.push({ type: 'atmosphere', value: a });
  for (const o of v.facetOccasion ?? []) facets.push({ type: 'occasion', value: o });
  return facets;
}
