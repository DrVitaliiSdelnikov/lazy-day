import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from '../database/entities/place.entity';

/**
 * Maps existing Google types[] and price_level to facet fields.
 * Phase A.A9 — runs BEFORE Gemini enrichment, uses free structured data.
 *
 * Does NOT overwrite facets already set (Gemini or manual).
 */

const CUISINE_MAP: Record<string, string> = {
  eastern_european_restaurant: 'georgian',
  pizza_restaurant: 'pizza',
  asian_restaurant: 'asian',
  american_restaurant: 'american',
  italian_restaurant: 'italian',
  halal_restaurant: 'halal',
  middle_eastern_restaurant: 'middle_eastern',
  indian_restaurant: 'indian',
  japanese_restaurant: 'japanese',
  thai_restaurant: 'thai',
  chinese_restaurant: 'chinese',
  turkish_restaurant: 'turkish',
  korean_restaurant: 'korean',
  mexican_restaurant: 'mexican',
  french_restaurant: 'french',
  mediterranean_restaurant: 'mediterranean',
  seafood_restaurant: 'seafood',
  vegetarian_restaurant: 'vegetarian',
  vegan_restaurant: 'vegan',
  sushi_restaurant: 'sushi',
  steak_house: 'steak',
  falafel_restaurant: 'falafel',
  shawarma_restaurant: 'shawarma',
  kebab_shop: 'kebab',
  dumpling_restaurant: 'dumplings',
  barbecue_restaurant: 'bbq',
  greek_restaurant: 'greek',
  persian_restaurant: 'persian',
  lebanese_restaurant: 'lebanese',
  ukrainian_restaurant: 'ukrainian',
  russian_restaurant: 'russian',
  vietnamese_restaurant: 'vietnamese',
  african_restaurant: 'african',
  spanish_restaurant: 'spanish',
  indonesian_restaurant: 'indonesian',
  asian_fusion_restaurant: 'asian_fusion',
  fusion_restaurant: 'fusion',
  hamburger_restaurant: 'burgers',
  gyro_restaurant: 'gyro',
  taco_restaurant: 'tacos',
  burrito_restaurant: 'burritos',
  hot_dog_restaurant: 'hot_dogs',
  hot_pot_restaurant: 'hot_pot',
  chicken_restaurant: 'chicken',
  soup_restaurant: 'soup',
  basque_restaurant: 'basque',
  irish_restaurant: 'irish',
  hawaiian_restaurant: 'hawaiian',
  oyster_bar_restaurant: 'oyster',
  tapas_restaurant: 'tapas',
  chinese_noodle_restaurant: 'chinese_noodles',
  pakistani_restaurant: 'pakistani',
  israeli_restaurant: 'israeli',
};

const FORMAT_MAP: Record<string, string> = {
  fine_dining_restaurant: 'fine_dining',
  fast_food_restaurant: 'fast_food',
  family_restaurant: 'family',
  breakfast_restaurant: 'breakfast',
  brunch_restaurant: 'brunch',
  buffet_restaurant: 'buffet',
  bistro: 'bistro',
  gastropub: 'gastropub',
  diner: 'diner',
  cafeteria: 'cafeteria',
  food_court: 'food_court',
  cafe: 'cafe',
  coffee_shop: 'coffee_shop',
  tea_house: 'tea_house',
  bakery: 'bakery',
  bar: 'bar',
  pub: 'pub',
  wine_bar: 'wine_bar',
  cocktail_bar: 'cocktail_bar',
  sports_bar: 'sports_bar',
  hookah_bar: 'hookah',
  lounge_bar: 'lounge',
  beer_garden: 'beer_garden',
  brewery: 'brewery',
  winery: 'winery',
  irish_pub: 'irish_pub',
  bar_and_grill: 'bar_and_grill',
  night_club: 'club',
  karaoke: 'karaoke',
  dessert_shop: 'dessert',
  dessert_restaurant: 'dessert',
  ice_cream_shop: 'ice_cream',
  donut_shop: 'donut',
  pastry_shop: 'pastry',
  cake_shop: 'cake',
  candy_store: 'candy',
  chocolate_shop: 'chocolate',
  sandwich_shop: 'sandwich',
  snack_bar: 'snack',
  coffee_roastery: 'coffee_roastery',
  coffee_stand: 'coffee_stand',
  internet_cafe: 'internet_cafe',
  dog_cafe: 'dog_cafe',
  cat_cafe: 'cat_cafe',
};

@Injectable()
export class FacetMapperService {
  private readonly logger = new Logger(FacetMapperService.name);

  constructor(
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
  ) {}

  /**
   * Map Google types[] → facet_cuisine, facet_format.
   * Map price_level → facet_price_tier + conf.
   * Does NOT overwrite existing facets.
   */
  async mapAll(): Promise<{ mapped: number; skipped: number; cuisineSet: number; formatSet: number; priceSet: number }> {
    const places = await this.placeRepo.find();
    let mapped = 0, skipped = 0, cuisineSet = 0, formatSet = 0, priceSet = 0;

    for (const place of places) {
      const types: string[] = place.googleTypes ?? [];
      let changed = false;

      // Cuisine (only if not already set)
      if (!place.facetCuisine?.length) {
        const cuisines = types
          .map(t => CUISINE_MAP[t])
          .filter((v): v is string => !!v);
        if (cuisines.length > 0) {
          place.facetCuisine = [...new Set(cuisines)];
          cuisineSet++;
          changed = true;
        }
      }

      // Format (only if not already set)
      if (!place.facetFormat?.length) {
        const formats = types
          .map(t => FORMAT_MAP[t])
          .filter((v): v is string => !!v);
        if (formats.length > 0) {
          place.facetFormat = [...new Set(formats)];
          formatSet++;
          changed = true;
        }
      }

      // Price tier from price_level (only if not already set)
      if (place.facetPriceTier == null && place.priceLevel != null) {
        place.facetPriceTier = place.priceLevel + 1;  // 0-4 → 1-5
        place.facetPriceConf = 0.9;  // high confidence from Google
        priceSet++;
        changed = true;
      }

      if (changed) {
        await this.placeRepo.save(place);
        mapped++;
      } else {
        skipped++;
      }
    }

    this.logger.log(`Facet mapping done: ${mapped} mapped, ${skipped} skipped. cuisine=${cuisineSet}, format=${formatSet}, price=${priceSet}`);
    return { mapped, skipped, cuisineSet, formatSet, priceSet };
  }
}
