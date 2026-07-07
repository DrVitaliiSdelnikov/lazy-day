import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Venue } from '../database/entities/venue.entity';
import { Place } from '../database/entities/place.entity';
import { SourceItem } from '../database/entities/source-item.entity';
import { SourceRef } from '../database/entities/source-ref.entity';
import { mapOsmCategory } from './osm-category-map';
import { createHash } from 'crypto';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Tbilisi bbox: [41.64, 44.70, 41.80, 44.90]
const OVERPASS_QUERY = `
[out:json][timeout:120];
(
  nwr["amenity"~"restaurant|cafe|bar|pub|fast_food|theatre|cinema|museum|library|arts_centre|nightclub|public_bath"](41.64,44.70,41.80,44.90);
  nwr["tourism"~"museum|gallery|viewpoint|attraction|artwork"](41.64,44.70,41.80,44.90);
  nwr["leisure"~"park|garden|sports_centre|swimming_pool|playground"](41.64,44.70,41.80,44.90);
  nwr["shop"~"mall|department_store|bakery"](41.64,44.70,41.80,44.90);
);
out center;
`;

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

@Injectable()
export class OsmImportService {
  private readonly logger = new Logger(OsmImportService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    @InjectRepository(SourceItem) private readonly sourceItemRepo: Repository<SourceItem>,
    @InjectRepository(SourceRef) private readonly sourceRefRepo: Repository<SourceRef>,
  ) {}

  async importFromOverpass(): Promise<{ imported: number; skipped: number; errors: number }> {
    this.logger.log('Starting OSM import for Tbilisi...');

    const body = new URLSearchParams();
    body.set('data', OVERPASS_QUERY.trim());

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'LazyDay/1.0 (leisure discovery app)',
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Overpass API ${response.status}: ${errorBody.slice(0, 500)}`);
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data: OverpassResponse = await response.json();
    this.logger.log(`Fetched ${data.elements.length} elements from Overpass`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const el of data.elements) {
      try {
        const result = await this.processElement(el);
        if (result) imported++;
        else skipped++;
      } catch (err: any) {
        errors++;
        if (errors <= 3) {
          this.logger.warn(`Error processing OSM ${el.type}/${el.id}: ${err?.message ?? err}`);
        }
      }
    }

    this.logger.log(`OSM import done: ${imported} imported, ${skipped} skipped, ${errors} errors`);
    return { imported, skipped, errors };
  }

  private async processElement(el: OverpassElement): Promise<boolean> {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;

    if (!lat || !lon) return false;

    const name = tags['name'] || tags['name:en'] || tags['name:ka'];
    if (!name) return false;

    const mapped = mapOsmCategory(tags);
    if (!mapped) return false;

    // Detect closed/defunct venues from OSM tags
    const status = this.detectStatus(tags);

    const osmId = `${el.type}/${el.id}`;
    const contentHash = createHash('md5')
      .update(JSON.stringify({ name, lat, lon, tags }))
      .digest('hex');

    // Check if already imported with same content
    const existingSource = await this.sourceItemRepo.findOne({
      where: { source: 'osm' as any, externalId: osmId },
    });

    if (existingSource && existingSource.contentHash === contentHash) {
      return false; // no changes
    }

    // Upsert source_item
    if (existingSource) {
      existingSource.rawPayload = el as any;
      existingSource.contentHash = contentHash;
      existingSource.fetchedAt = new Date();
      await this.sourceItemRepo.save(existingSource);
    } else {
      await this.sourceItemRepo.save(
        this.sourceItemRepo.create({
          source: 'osm' as any,
          externalId: osmId,
          rawPayload: el as any,
          contentHash,
        }),
      );
    }

    // Find or create venue
    let venue: Venue;
    const existingRef = await this.sourceRefRepo.findOne({
      where: { entityType: 'venue' as any, source: 'osm' as any, externalId: osmId },
    });

    if (existingRef) {
      const existing = await this.venueRepo.findOne({ where: { id: existingRef.entityId } });
      if (!existing) return false;
      existing.name = name;
      existing.nameKa = tags['name:ka'];
      existing.nameEn = tags['name:en'];
      existing.lat = lat;
      existing.lng = lon;
      existing.address = tags['addr:street']
        ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}`
        : undefined;
      existing.website = tags['website'] || tags['contact:website'];
      existing.phone = tags['phone'] || tags['contact:phone'];
      venue = await this.venueRepo.save(existing);
    } else {
      venue = await this.venueRepo.save(
        this.venueRepo.create({
          name,
          nameKa: tags['name:ka'],
          nameEn: tags['name:en'],
          lat,
          lng: lon,
          address: tags['addr:street']
            ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}`
            : undefined,
          city: 'tbilisi',
          website: tags['website'] || tags['contact:website'],
          phone: tags['phone'] || tags['contact:phone'],
        }),
      );

      await this.sourceRefRepo.save(
        this.sourceRefRepo.create({
          entityType: 'venue' as any,
          entityId: venue.id,
          source: 'osm' as any,
          externalId: osmId,
        }),
      );
    }

    // Find or create place
    const existingPlaceRef = await this.sourceRefRepo.findOne({
      where: { entityType: 'place' as any, source: 'osm' as any, externalId: osmId },
    });

    if (existingPlaceRef) {
      const existingPlace = await this.placeRepo.findOne({ where: { id: existingPlaceRef.entityId } });
      if (existingPlace) {
        existingPlace.category = mapped.category;
        existingPlace.tags = mapped.tags;
        existingPlace.indoor = mapped.indoor;
        existingPlace.status = status;
        existingPlace.openingHours = tags['opening_hours']
          ? { raw: tags['opening_hours'] }
          : undefined;
        await this.placeRepo.save(existingPlace);
      }
    } else {
      const place = await this.placeRepo.save(
        this.placeRepo.create({
          venueId: venue.id,
          category: mapped.category,
          tags: mapped.tags,
          indoor: mapped.indoor,
          status,
          openingHours: tags['opening_hours']
            ? { raw: tags['opening_hours'] }
            : undefined,
          rating: tags['stars'] ? parseFloat(tags['stars']) : undefined,
        }),
      );

      await this.sourceRefRepo.save(
        this.sourceRefRepo.create({
          entityType: 'place' as any,
          entityId: place.id,
          source: 'osm' as any,
          externalId: osmId,
        }),
      );
    }

    return true;
  }

  /**
   * Detect venue status from OSM tags.
   * See docs/data-quality.md for tag patterns.
   */
  private detectStatus(tags: Record<string, string>): string {
    // disused:amenity, disused:shop, disused:leisure etc.
    const disusedKeys = Object.keys(tags).filter((k) => k.startsWith('disused:') || k.startsWith('demolished:'));
    if (disusedKeys.length > 0) return 'permanently_closed';

    // opening_hours explicitly set to closed/off
    const hours = tags['opening_hours']?.toLowerCase().trim();
    if (hours === 'closed' || hours === 'off') return 'permanently_closed';

    return 'active';
  }
}
