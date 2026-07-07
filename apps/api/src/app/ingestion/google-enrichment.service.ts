import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Venue } from '../database/entities/venue.entity';
import { Place } from '../database/entities/place.entity';

/**
 * Google Places API enrichment service.
 * Matches existing OSM venues to Google Places and enriches with:
 * - Phase 2 (Pro, free): types, businessStatus, primaryType, accessibilityOptions
 * - Phase 3 (Enterprise, ~$40): regularOpeningHours, rating
 * - Phase 4 (Atmosphere, ~$80): allowsDogs, goodForChildren, outdoorSeating
 *
 * See docs/research/google-places-api-integration.md for full plan.
 */

const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';

interface EnrichmentResult {
  matched: number;
  enriched: number;
  skipped: number;
  errors: number;
}

@Injectable()
export class GoogleEnrichmentService {
  private readonly logger = new Logger(GoogleEnrichmentService.name);

  constructor(
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
  ) {}

  /**
   * Enrich venues that don't have a google_place_id yet.
   * Phase 2: match by name + location → store place_id + types.
   */
  async enrichPro(limit = 100): Promise<EnrichmentResult> {
    const apiKey = process.env['GOOGLE_PLACES_API_KEY'];
    if (!apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY not set — skipping enrichment');
      return { matched: 0, enriched: 0, skipped: 0, errors: 0 };
    }

    const venues = await this.venueRepo.find({
      where: { googlePlaceId: IsNull() },
      take: limit,
      order: { createdAt: 'ASC' },
    });

    this.logger.log(`Pro enrichment: ${venues.length} venues to process`);

    let matched = 0, enriched = 0, skipped = 0, errors = 0;

    for (const venue of venues) {
      try {
        const placeId = await this.matchVenue(venue, apiKey);
        if (!placeId) { skipped++; continue; }

        venue.googlePlaceId = placeId;
        await this.venueRepo.save(venue);
        matched++;

        const details = await this.fetchProDetails(placeId, apiKey);
        if (details) {
          await this.applyProDetails(venue.id, details);
          enriched++;
        }

        // Rate limit: 100ms between calls
        await this.sleep(100);
      } catch (err: any) {
        errors++;
        if (errors <= 5) {
          this.logger.warn(`Error enriching venue ${venue.id} "${venue.name}": ${err?.message}`);
        }
        // If getting rate limited, back off
        if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
          this.logger.warn('Rate limited — backing off 5s');
          await this.sleep(5000);
        }
      }
    }

    this.logger.log(`Pro enrichment done: ${matched} matched, ${enriched} enriched, ${skipped} skipped, ${errors} errors`);
    return { matched, enriched, skipped, errors };
  }

  /**
   * Match a venue to a Google Place by name + location.
   * Uses Text Search with location bias.
   */
  private async matchVenue(venue: Venue, apiKey: string): Promise<string | null> {
    const response = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
      },
      body: JSON.stringify({
        textQuery: venue.name,
        locationBias: {
          circle: {
            center: { latitude: venue.lat, longitude: venue.lng },
            radius: 100.0,
          },
        },
        maxResultCount: 1,
        languageCode: 'ka',
      }),
    });

    if (!response.ok) {
      throw new Error(`Text Search ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const place = data.places?.[0];
    if (!place?.id) return null;

    // Verify distance < 200m
    const loc = place.location;
    if (loc) {
      const dist = this.haversineM(venue.lat, venue.lng, loc.latitude, loc.longitude);
      if (dist > 200) {
        this.logger.debug(`Skipping ${venue.name}: Google match ${dist.toFixed(0)}m away`);
        return null;
      }
    }

    return place.id;
  }

  /**
   * Fetch Pro-tier details: types, businessStatus, primaryType, accessibilityOptions.
   */
  private async fetchProDetails(placeId: string, apiKey: string): Promise<any | null> {
    const response = await fetch(`${GOOGLE_PLACES_BASE}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'types,businessStatus,primaryType,primaryTypeDisplayName,accessibilityOptions',
      },
    });

    if (!response.ok) return null;
    return response.json();
  }

  /**
   * Apply Pro details to the place record.
   */
  private async applyProDetails(venueId: string, details: any): Promise<void> {
    const place = await this.placeRepo.findOne({ where: { venueId } });
    if (!place) return;

    if (details.types) {
      place.googleTypes = details.types;
    }

    if (details.businessStatus === 'CLOSED_PERMANENTLY') {
      place.status = 'permanently_closed';
    } else if (details.businessStatus === 'CLOSED_TEMPORARILY') {
      place.status = 'closed';
    }

    if (details.accessibilityOptions) {
      place.attributes = {
        ...place.attributes,
        wheelchairAccessibleEntrance: details.accessibilityOptions.wheelchairAccessibleEntrance,
        wheelchairAccessibleParking: details.accessibilityOptions.wheelchairAccessibleParking,
      };
    }

    await this.placeRepo.save(place);
  }

  // TODO: Phase 3 — enrichEnterprise() for opening hours + rating
  // TODO: Phase 4 — enrichAtmosphere() for allowsDogs, goodForChildren, outdoorSeating

  private haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
