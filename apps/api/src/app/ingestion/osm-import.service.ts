import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Venue } from '../database/entities/venue.entity';
import { Place } from '../database/entities/place.entity';
import { SourceItem } from '../database/entities/source-item.entity';
import { SourceRef } from '../database/entities/source-ref.entity';
import { mapOsmCategory } from './osm-category-map';
import { createHash } from 'crypto';

/** Known chain venues in Tbilisi — name substring match (lowercased, no apostrophes) */
const KNOWN_CHAINS: { match: string; key: string }[] = [
  // Fast food
  { match: 'mcdonalds', key: 'mcdonalds' },
  { match: 'მაკდონალდ', key: 'mcdonalds' },
  { match: 'kfc', key: 'kfc' },
  { match: 'wendys', key: 'wendys' },
  { match: 'ვენდის', key: 'wendys' },
  { match: 'subway', key: 'subway' },
  { match: 'საბვეი', key: 'subway' },
  { match: 'dunkin', key: 'dunkin' },
  { match: 'დანკინ', key: 'dunkin' },
  { match: 'burger king', key: 'burger_king' },
  { match: 'dominos', key: 'dominos' },
  { match: 'papa johns', key: 'papa_johns' },
  // Coffee
  { match: 'starbucks', key: 'starbucks' },
  { match: 'სტარბაქს', key: 'starbucks' },
  { match: 'costa coffee', key: 'costa_coffee' },
  { match: 'coffeesta', key: 'coffeesta' },
  { match: 'entrée', key: 'entree' },
  { match: 'entree', key: 'entree' },
  // Local chains
  { match: 'psp', key: 'psp' },
  { match: 'libre', key: 'libre' },
  { match: 'purpur', key: 'purpur' },
  // Pharmacy
  { match: 'aversi', key: 'aversi' },
  { match: 'ავერსი', key: 'aversi' },
  { match: 'gpc', key: 'gpc' },
  // Grocery (shouldn't be in feed but flag anyway)
  { match: 'carrefour', key: 'carrefour' },
  { match: 'spar', key: 'spar' },
  { match: 'nikora', key: 'nikora' },
  { match: 'ნიკორა', key: 'nikora' },
  { match: 'ori nabiji', key: 'ori_nabiji' },
  { match: 'goodwill', key: 'goodwill' },
  { match: 'agrohub', key: 'agrohub' },
  { match: 'fresco', key: 'fresco' },
];

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Tbilisi bbox expanded: [41.62, 44.65, 41.82, 45.05]
// Includes: Lilo, Patara Lilo, Orkhevi, Rustavi road, Dighomi, Tskneti
const OVERPASS_QUERY = `
[out:json][timeout:120];
(
  nwr["amenity"~"restaurant|cafe|bar|pub|fast_food|theatre|cinema|museum|library|arts_centre|nightclub|public_bath"](41.62,44.65,41.82,45.05);
  nwr["tourism"~"museum|gallery|viewpoint|attraction|artwork"](41.62,44.65,41.82,45.05);
  nwr["leisure"~"park|garden|sports_centre|swimming_pool|playground|fitness_centre|bowling_alley|escape_game|amusement_arcade|water_park|trampoline_park"](41.62,44.65,41.82,45.05);
  nwr["sport"~"climbing|karting|paintball|go"](41.62,44.65,41.82,45.05);
  nwr["shop"~"mall|department_store|bakery"](41.62,44.65,41.82,45.05);
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

  /** Batch translate Georgian venue names → English via Google Translate API */
  async translateGeorgianNames(): Promise<{ found: number; translated: number; errors: number }> {
    const key = process.env['GOOGLE_TRANSLATE_KEY'];
    if (!key) return { found: 0, translated: 0, errors: -1 };

    // Find venues with Georgian name and no name_en
    const all = await this.dataSource.query(`SELECT id, name FROM venues WHERE name_en IS NULL`);
    const venues = all.filter((r: any) => /[\u10A0-\u10FF]/.test(r.name));
    this.logger.log(`Translate: found ${venues.length} Georgian-only venues`);

    let translated = 0;
    let errors = 0;
    const BATCH = 50;

    for (let i = 0; i < venues.length; i += BATCH) {
      const batch = venues.slice(i, i + BATCH);
      try {
        const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: batch.map((v: any) => v.name), source: 'ka', target: 'en', format: 'text' }),
        });
        if (!res.ok) { errors++; continue; }
        const data = await res.json();
        const results = data.data.translations;

        for (let j = 0; j < batch.length; j++) {
          const tr = results[j]?.translatedText;
          if (tr && tr !== batch[j].name) {
            await this.dataSource.query(`UPDATE venues SET name_en = $1 WHERE id = $2`, [tr, batch[j].id]);
            translated++;
          }
        }
        this.logger.log(`  Batch ${Math.floor(i / BATCH) + 1}: ${results.length} translated`);
      } catch (e: any) {
        this.logger.error(`  Batch error: ${e.message}`);
        errors++;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    this.logger.log(`Translate done: ${translated} translated, ${errors} errors`);
    return { found: venues.length, translated, errors };
  }

  /** One-time fix: flag known chains by venue name matching */
  async fixChainFlags(): Promise<{ updated: number }> {
    let totalUpdated = 0;

    for (const chain of KNOWN_CHAINS) {
      const result = await this.dataSource.query(
        `UPDATE places SET is_chain = true, chain_key = $1
         FROM venues v
         WHERE places.venue_id = v.id
           AND places.is_chain = false
           AND LOWER(v.name) LIKE $2`,
        [chain.key, `%${chain.match}%`],
      );
      totalUpdated += result?.[1] ?? 0;
    }

    // Also flag by brand in source_items
    const brandResult = await this.dataSource.query(
      `UPDATE places SET is_chain = true
       FROM source_refs sr, source_items si
       WHERE sr.entity_type = 'venue'
         AND sr.entity_id = places.venue_id
         AND sr.source = 'osm'
         AND si.source = 'osm'
         AND si.external_id = sr.external_id
         AND places.is_chain = false
         AND (si.raw_payload->'tags'->>'brand:wikidata' IS NOT NULL
           OR si.raw_payload->'tags'->>'brand' IS NOT NULL)`,
    );
    totalUpdated += brandResult?.[1] ?? 0;

    this.logger.log(`Fixed chain flags: ${totalUpdated} places updated`);
    return { updated: totalUpdated };
  }

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

    // Detect chain venues: OSM brand tags + known chain list
    const brandChain = !!(tags['brand:wikidata'] || tags['brand']);
    const nameNorm = name.toLowerCase().replace(/[''`]/g, '');
    const knownChain = KNOWN_CHAINS.find(c => nameNorm.includes(c.match));
    const isChain = brandChain || !!knownChain;
    const chainKey = knownChain?.key
      || tags['brand']?.toLowerCase().replace(/[^a-z0-9]/g, '_')
      || undefined;

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
        existingPlace.isChain = isChain;
        if (chainKey) existingPlace.chainKey = chainKey;
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
          isChain,
          chainKey,
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
