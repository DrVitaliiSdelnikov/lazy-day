import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from '../database/entities/place.entity';
import { Venue } from '../database/entities/venue.entity';

/**
 * A8: Gemini-based facet enrichment.
 * Fills facet_atmosphere, facet_occasion, and gaps in cuisine/format/price.
 * Also fills "plan your day" schema fields (duration, time_of_day, role, anchor).
 *
 * Uses gemini-flash-lite-latest for cost efficiency (~$0.05-0.20/1K tokens).
 * Does NOT overwrite facets already set by Google types mapping (A9).
 */

const GEMINI_MODEL = 'gemini-flash-lite-latest';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const SYSTEM_PROMPT = `You are a venue classifier for a Tbilisi leisure discovery app.

TAXONOMY (use ONLY these values):

atmosphere (pick 1-4): cozy, lively, romantic, quiet, trendy, traditional, outdoorsy, family_friendly, work_friendly, date_worthy, group_friendly, upscale, casual, cultural, scenic, live_music, instagram_worthy

occasion (pick 1-3): date, family_outing, solo, work, friends, celebration, quick_stop, exploring

price_tier (1-5): 1=cheap, 2=below_average, 3=average, 4=above_average, 5=high

venue_role: meal | activity | shopping | drink | sight
anchor_vs_filler: anchor | filler
typical_duration_min: estimated visit duration in minutes (15, 30, 45, 60, 90, 120, 180)
time_of_day_fit: array from [morning, midday, afternoon, evening, late]

RULES:
- If data is insufficient to determine a field, output "unknown". Do NOT guess.
- Do NOT override existing cuisine/format if provided as "existing_*".
- Georgian names: interpret in context of Tbilisi venues.
- Output ONLY valid JSON, no markdown, no explanation.`;

interface GeminiResult {
  atmosphere: string[] | 'unknown';
  occasion: string[] | 'unknown';
  price_tier: number | 'unknown';
  price_tier_confidence: number;
  cuisine: string | 'unknown';
  format: string | 'unknown';
  venue_role: string;
  anchor_vs_filler: string;
  typical_duration_min: number;
  time_of_day_fit: string[];
}

@Injectable()
export class GeminiEnrichmentService {
  private readonly logger = new Logger(GeminiEnrichmentService.name);

  constructor(
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
  ) {}

  async enrichBatch(limit = 100): Promise<{ enriched: number; skipped: number; errors: number }> {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — skipping');
      return { enriched: 0, skipped: 0, errors: 0 };
    }

    // Find places without atmosphere (not yet Gemini-enriched)
    const places = await this.placeRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.venue', 'v')
      .where('p.facetAtmosphere IS NULL')
      .orderBy('p.createdAt', 'ASC')
      .take(limit)
      .getMany();

    this.logger.log(`Gemini enrichment: ${places.length} places to process`);

    let enriched = 0, skipped = 0, errors = 0;

    for (const place of places) {
      try {
        const result = await this.classifyVenue(place, apiKey);
        if (!result) { skipped++; continue; }

        this.applyResult(place, result);
        await this.placeRepo.save(place);
        enriched++;

        // Rate limit: 200ms between calls
        await new Promise(r => setTimeout(r, 200));
      } catch (err: any) {
        errors++;
        if (errors <= 5) {
          this.logger.warn(`Gemini error for "${place.venue?.name}": ${err?.message}`);
        }
        if (err?.message?.includes('429')) {
          this.logger.warn('Rate limited — backing off 5s');
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    this.logger.log(`Gemini enrichment done: ${enriched} enriched, ${skipped} skipped, ${errors} errors`);
    return { enriched, skipped, errors };
  }

  private async classifyVenue(place: Place, apiKey: string): Promise<GeminiResult | null> {
    const v = place.venue;
    if (!v) return null;

    const venueData = [
      `name: ${v.name}`,
      v.nameEn ? `name_en: ${v.nameEn}` : null,
      `category: ${place.category}`,
      place.googleTypes?.length ? `google_types: ${place.googleTypes.join(', ')}` : null,
      place.facetCuisine?.length ? `existing_cuisine: ${place.facetCuisine.join(', ')}` : 'existing_cuisine: none',
      place.facetFormat?.length ? `existing_format: ${place.facetFormat.join(', ')}` : 'existing_format: none',
      place.facetPriceTier ? `existing_price_tier: ${place.facetPriceTier}` : 'existing_price_tier: none',
      place.googleRating ? `rating: ${place.googleRating}` : null,
      place.googleRatingCount ? `rating_count: ${place.googleRatingCount}` : null,
      place.attributes && Object.keys(place.attributes).length > 0
        ? `attributes: ${JSON.stringify(place.attributes)}` : null,
      place.tags?.length ? `tags: ${place.tags.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    const response = await fetch(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${SYSTEM_PROMPT}\n\nVENUE DATA:\n${venueData}\n\nOutput JSON:` }],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 300,
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    // Parse JSON (strip markdown code fences if present)
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      this.logger.debug(`Invalid JSON from Gemini for "${v.name}": ${clean.slice(0, 100)}`);
      return null;
    }
  }

  private applyResult(place: Place, result: GeminiResult): void {
    // Atmosphere — always from Gemini (no structured source)
    if (result.atmosphere && result.atmosphere !== 'unknown' && Array.isArray(result.atmosphere)) {
      place.facetAtmosphere = result.atmosphere;
    } else {
      place.facetAtmosphere = [];  // mark as processed (empty, not null)
    }

    // Occasion
    if (result.occasion && result.occasion !== 'unknown' && Array.isArray(result.occasion)) {
      place.facetOccasion = result.occasion;
    }

    // Cuisine — only fill gaps
    if (!place.facetCuisine?.length && result.cuisine && result.cuisine !== 'unknown') {
      place.facetCuisine = [result.cuisine];
    }

    // Format — only fill gaps
    if (!place.facetFormat?.length && result.format && result.format !== 'unknown') {
      place.facetFormat = [result.format];
    }

    // Price tier — only if no Google price_level
    if (place.facetPriceTier == null && result.price_tier && result.price_tier !== 'unknown') {
      place.facetPriceTier = result.price_tier as number;
      place.facetPriceConf = result.price_tier_confidence ?? 0.5;
    }

    // "Plan your day" fields
    if (result.typical_duration_min) place.typicalDurationMin = result.typical_duration_min;
    if (result.time_of_day_fit?.length) place.timeOfDayFit = result.time_of_day_fit;
    if (result.venue_role) place.venueRole = result.venue_role;
    if (result.anchor_vs_filler) place.anchorVsFiller = result.anchor_vs_filler;
  }
}
