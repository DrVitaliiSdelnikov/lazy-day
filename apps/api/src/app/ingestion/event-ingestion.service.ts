import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Event } from '../database/entities/event.entity';
import { Venue } from '../database/entities/venue.entity';
import { NormalizedEvent, EventSourceAdapter } from './event-sources/types';
import { OperaGeAdapter } from './event-sources/opera-ge.adapter';
import { GoogleEventsAdapter } from './event-sources/google-events.adapter';
import { YoloGeAdapter } from './event-sources/yolo-ge.adapter';
import { BiletebiGeAdapter } from './event-sources/biletebi-ge.adapter';
import { TktGeAdapter } from './event-sources/tkt-ge.adapter';

interface IngestionResult {
  source: string;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

@Injectable()
export class EventIngestionService {
  private readonly logger = new Logger(EventIngestionService.name);
  private readonly adapters: Map<string, EventSourceAdapter>;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
  ) {
    // Register adapters
    const serpApiKey = process.env['SERPAPI_KEY'] || '';
    this.adapters = new Map<string, EventSourceAdapter>([
      ['opera.ge', new OperaGeAdapter()],
      ['google_events', new GoogleEventsAdapter(serpApiKey, 'events in Tbilisi', 'en')],
      ['yolo.ge', new YoloGeAdapter()],
      ['biletebi.ge', new BiletebiGeAdapter()],
      ['tkt.ge', new TktGeAdapter()],
    ]);
  }

  /**
   * Run all enabled sources.
   */
  async runAll(): Promise<IngestionResult[]> {
    const sources = await this.dataSource.query(
      `SELECT name FROM event_sources WHERE enabled = true ORDER BY name`,
    );

    const results: IngestionResult[] = [];
    for (const { name } of sources) {
      const adapter = this.adapters.get(name);
      if (!adapter) {
        this.logger.warn(`No adapter registered for source: ${name}`);
        continue;
      }
      const result = await this.runSource(adapter);
      results.push(result);

      // Update source stats
      await this.dataSource.query(
        `UPDATE event_sources SET last_fetched_at = NOW(), last_event_count = $1 WHERE name = $2`,
        [result.inserted + result.updated, name],
      );
    }

    return results;
  }

  /**
   * Run a single source by name.
   */
  async runByName(sourceName: string): Promise<IngestionResult> {
    const adapter = this.adapters.get(sourceName);
    if (!adapter) {
      throw new Error(`Unknown source: ${sourceName}. Available: ${[...this.adapters.keys()].join(', ')}`);
    }

    const result = await this.runSource(adapter);

    await this.dataSource.query(
      `UPDATE event_sources SET last_fetched_at = NOW(), last_event_count = $1 WHERE name = $2`,
      [result.inserted + result.updated, sourceName],
    );

    return result;
  }

  /**
   * List all sources with stats.
   */
  async listSources() {
    return this.dataSource.query(
      `SELECT name, url, adapter_type, last_fetched_at, last_event_count, enabled
       FROM event_sources ORDER BY name`,
    );
  }

  private async runSource(adapter: EventSourceAdapter): Promise<IngestionResult> {
    const sourceName = adapter.sourceName;
    this.logger.log(`Fetching events from ${sourceName}...`);

    let normalized: NormalizedEvent[];
    try {
      normalized = await adapter.fetch();
    } catch (err: any) {
      this.logger.error(`Failed to fetch from ${sourceName}: ${err?.message}`);
      return { source: sourceName, fetched: 0, inserted: 0, updated: 0, skipped: 0, errors: 1 };
    }

    this.logger.log(`${sourceName}: ${normalized.length} events fetched, processing...`);

    let inserted = 0, updated = 0, skipped = 0, errors = 0;

    for (const ne of normalized) {
      try {
        const result = await this.upsertEvent(ne);
        if (result === 'inserted') inserted++;
        else if (result === 'updated') updated++;
        else skipped++;
      } catch (err: any) {
        errors++;
        if (errors <= 3) {
          this.logger.warn(`Error processing event "${ne.title}": ${err?.message}`);
        }
      }
    }

    this.logger.log(`${sourceName} done: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errors} errors`);
    return { source: sourceName, fetched: normalized.length, inserted, updated, skipped, errors };
  }

  private async upsertEvent(ne: NormalizedEvent): Promise<'inserted' | 'updated' | 'skipped'> {
    // Check for existing event (dedup)
    const existing = await this.eventRepo.findOne({
      where: {
        source: ne.source,
        sourceEventId: ne.sourceEventId,
      },
    });

    if (existing) {
      // Update if changed
      let changed = false;
      if (existing.title !== ne.title) { existing.title = ne.title; changed = true; }
      if (ne.titleEn && existing.titleEn !== ne.titleEn) { existing.titleEn = ne.titleEn; changed = true; }
      if (ne.ticketUrl && existing.ticketUrl !== ne.ticketUrl) { existing.ticketUrl = ne.ticketUrl; changed = true; }
      if (ne.priceMin != null && existing.priceMin !== ne.priceMin) { existing.priceMin = ne.priceMin; changed = true; }
      existing.lastVerifiedAt = new Date();

      if (changed) {
        await this.eventRepo.save(existing);
        return 'updated';
      }
      return 'skipped';
    }

    // Match venue
    const venueId = await this.matchVenue(ne.venueName);

    // Insert new event
    await this.eventRepo.save(
      this.eventRepo.create({
        title: ne.title,
        titleEn: ne.titleEn,
        titleKa: ne.titleKa,
        description: ne.description,
        startsAt: ne.startsAt,
        endsAt: ne.endsAt,
        timezone: 'Asia/Tbilisi',
        category: ne.category,
        tags: ne.tags,
        priceMin: ne.priceMin,
        priceMax: ne.priceMax,
        currency: ne.currency ?? 'GEL',
        ticketUrl: ne.ticketUrl,
        posterUrl: ne.posterUrl,
        source: ne.source,
        sourceEventId: ne.sourceEventId,
        venueId: venueId ?? undefined,
        status: 'scheduled',
        qualityScore: 0.7,
      }),
    );

    return 'inserted';
  }

  /**
   * Match venue by name. Simple exact match for now.
   * TODO: fuzzy matching, geocoding, manual whitelist from event_sources.config.
   */
  private async matchVenue(venueName: string): Promise<string | null> {
    if (!venueName) return null;

    // Exact match (case-insensitive)
    const venue = await this.venueRepo
      .createQueryBuilder('v')
      .where('LOWER(v.name) = LOWER(:name)', { name: venueName })
      .orWhere('LOWER(v.nameEn) = LOWER(:name)', { name: venueName })
      .getOne();

    if (venue) return venue.id;

    // Partial match — venue name contains search term or vice versa
    const partial = await this.venueRepo
      .createQueryBuilder('v')
      .where('LOWER(v.name) LIKE LOWER(:pattern)', { pattern: `%${venueName.slice(0, 20)}%` })
      .getOne();

    if (partial) return partial.id;

    this.logger.debug(`No venue match for: "${venueName}"`);
    return null;
  }
}
