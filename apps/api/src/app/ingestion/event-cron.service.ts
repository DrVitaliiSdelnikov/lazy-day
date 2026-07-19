import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { EventIngestionService } from './event-ingestion.service';

/**
 * Daily cron jobs:
 * - 02:00 UTC: event refresh (all sources, mark past, health alerts)
 * - 03:00 UTC (Sunday): enrichment refresh (stale Google data, 30-day TTL)
 * - 05:00 UTC: impression_agg prune (>30 days) + decay (>14 days)
 * - GC: empty anonymous users (>90 days)
 */
@Injectable()
export class EventCronService {
  private readonly logger = new Logger(EventCronService.name);

  constructor(
    private readonly eventIngestion: EventIngestionService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * A3: Weekly enrichment refresh for stale Google data.
   * Re-fetches Enterprise details (rating, hours, priceLevel) for venues
   * where enriched_at > 30 days. Uses existing googlePlaceId (Place Details, not Text Search).
   * Budget: ~200 venues/week × $20/1K = ~$4/month.
   */
  @Cron('0 3 * * 0') // Sunday 03:00 UTC = 07:00 Tbilisi
  async weeklyEnrichmentRefresh() {
    const apiKey = process.env['GOOGLE_PLACES_API_KEY'];
    if (!apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY not set — skipping enrichment refresh');
      return;
    }

    this.logger.log('Weekly enrichment refresh starting...');

    const stale = await this.dataSource.query(`
      SELECT v.id as venue_id, v.google_place_id
      FROM venues v
      JOIN places p ON p.venue_id = v.id
      WHERE v.google_place_id IS NOT NULL
        AND (p.enriched_at IS NULL OR p.enriched_at < NOW() - INTERVAL '30 days')
      ORDER BY p.enriched_at ASC NULLS FIRST
      LIMIT 200
    `);

    this.logger.log(`Found ${stale.length} stale venues to refresh`);

    let refreshed = 0, errors = 0;
    for (const row of stale) {
      try {
        const response = await fetch(`https://places.googleapis.com/v1/places/${row.google_place_id}`, {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'regularOpeningHours,rating,userRatingCount,priceLevel',
          },
        });

        if (!response.ok) {
          errors++;
          continue;
        }

        const details = await response.json();

        const updates: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        if (details.rating != null) {
          updates.push(`google_rating = $${paramIdx++}`);
          params.push(details.rating);
        }
        if (details.userRatingCount != null) {
          updates.push(`google_rating_count = $${paramIdx++}`);
          params.push(details.userRatingCount);
        }
        if (details.regularOpeningHours) {
          updates.push(`opening_hours = $${paramIdx++}`);
          params.push(JSON.stringify(details.regularOpeningHours));
        }
        if (details.priceLevel != null) {
          const PRICE_MAP: Record<string, number> = {
            PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1,
            PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
          };
          updates.push(`price_level = $${paramIdx++}`);
          params.push(typeof details.priceLevel === 'string' ? PRICE_MAP[details.priceLevel] ?? null : details.priceLevel);
        }

        if (updates.length > 0) {
          updates.push(`enriched_at = NOW()`);
          params.push(row.venue_id);
          await this.dataSource.query(
            `UPDATE places SET ${updates.join(', ')} WHERE venue_id = $${paramIdx}`,
            params,
          );
          refreshed++;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 100));
      } catch (err: any) {
        errors++;
        if (errors <= 3) this.logger.warn(`Refresh error for ${row.google_place_id}: ${err?.message}`);
      }
    }

    this.logger.log(`Enrichment refresh done: ${refreshed} refreshed, ${errors} errors out of ${stale.length}`);
  }

  /**
   * F1: Daily impression_agg maintenance.
   * - Prune records older than 30 days
   * - Decay unengaged_count for records older than 14 days (honesty window)
   */
  @Cron('0 5 * * *') // 05:00 UTC daily
  async dailyImpressionMaintenance() {
    try {
      // Prune old
      const pruned = await this.dataSource.query(
        `DELETE FROM impression_agg WHERE last_shown_at < NOW() - INTERVAL '30 days'`,
      );
      const prunedCount = pruned?.[1] ?? 0;

      // Decay stale counters (outside 14-day window)
      const decayed = await this.dataSource.query(`
        UPDATE impression_agg
        SET unengaged_count = 0
        WHERE last_shown_at < NOW() - INTERVAL '14 days'
          AND unengaged_count > 0
          AND NOT engaged
      `);
      const decayedCount = decayed?.[1] ?? 0;

      // GC orphaned taste profiles (>90 days no update)
      const gcProfiles = await this.dataSource.query(
        `DELETE FROM user_taste_profile WHERE updated_at < NOW() - INTERVAL '90 days'`,
      );
      const gcCount = gcProfiles?.[1] ?? 0;

      if (prunedCount > 0 || decayedCount > 0 || gcCount > 0) {
        this.logger.log(`Impression maintenance: pruned=${prunedCount}, decayed=${decayedCount}, gcProfiles=${gcCount}`);
      }
    } catch (e: any) {
      this.logger.warn(`Impression maintenance failed: ${e?.message}`);
    }
  }

  @Cron('0 2 * * *') // 02:00 UTC = 06:00 Tbilisi
  async dailyEventRefresh() {
    this.logger.log('Daily event refresh starting...');

    // 1. Mark past events
    const pastResult = await this.dataSource.query(
      `UPDATE events SET status = 'past' WHERE status = 'scheduled' AND starts_at < NOW() RETURNING id`,
    );
    if (pastResult.length > 0) {
      this.logger.log(`Marked ${pastResult.length} events as past`);
    }

    // 2. Run all enabled sources
    let ingestionResults: any[] = [];
    try {
      ingestionResults = await this.eventIngestion.runAll();
      const total = ingestionResults.reduce((sum: number, r: any) => sum + r.inserted + r.updated, 0);
      this.logger.log(`Daily refresh done: ${total} events inserted/updated across ${ingestionResults.length} sources`);
    } catch (err: any) {
      this.logger.error(`Daily event refresh failed: ${err?.message}`);
    }

    // 3. Check source health and alert on failures
    await this.checkSourceHealth(ingestionResults);

    // 4. GC empty anonymous users (weekly — runs daily but only deletes old ones)
    await this.gcEmptyUsers();
  }

  /** Remove anonymous users with no activity after 90 days */
  private async gcEmptyUsers() {
    try {
      const result = await this.dataSource.query(`
        DELETE FROM users
        WHERE auth_provider IS NULL
          AND last_seen_at < NOW() - INTERVAL '90 days'
          AND saved_ids = '{}'
          AND hidden_ids = '{}'
          AND (profile = '{}' OR profile IS NULL)
        -- K2-lite guard: uncomment when match_sessions table exists
        -- AND id NOT IN (SELECT DISTINCT user_id FROM match_sessions WHERE status = 'active')
      `);
      const deleted = result?.[1] ?? 0;
      if (deleted > 0) {
        this.logger.log(`GC: removed ${deleted} empty anonymous users`);
      }
    } catch (e: any) {
      this.logger.warn(`GC failed: ${e?.message}`);
    }
  }

  /**
   * Check each event source for freshness using event_sources.last_fetched_at
   * and last_event_count (updated after every runAll run).
   * Alerts via Telegram if a source fetched 0 events or has errors.
   */
  async checkSourceHealth(
    ingestionResults: Array<{ source: string; fetched: number; inserted: number; updated: number; errors: number }> = [],
  ): Promise<Record<string, { fetched: number; status: string }>> {
    // Build a quick lookup from ingestion run results
    const resultBySource = new Map(ingestionResults.map((r) => [r.source, r]));

    // All enabled sources from DB
    const rows = await this.dataSource.query(
      `SELECT name, last_fetched_at, last_event_count FROM event_sources WHERE enabled = true ORDER BY name`,
    );

    const health: Record<string, { fetched: number; status: string }> = {};
    const failures: string[] = [];

    for (const row of rows) {
      const runResult = resultBySource.get(row.name);
      const fetched = runResult?.fetched ?? row.last_event_count ?? 0;
      const hasErrors = (runResult?.errors ?? 0) > 0;
      const stale = fetched === 0 || hasErrors;

      health[row.name] = { fetched, status: stale ? 'stale' : 'ok' };

      if (stale) {
        this.logger.error(
          `[EVENT ALERT] Source "${row.name}": fetched=${fetched}, errors=${runResult?.errors ?? 0}`,
        );
        failures.push(row.name);
      }
    }

    if (failures.length > 0) {
      await this.sendTelegramAlert(failures, ingestionResults);
    }

    return health;
  }

  private async sendTelegramAlert(
    failedSources: string[],
    allResults: Array<{ source: string; fetched: number; inserted: number; updated: number; errors: number }>,
  ) {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = process.env['TELEGRAM_CHAT_ID'];
    if (!token || !chatId) {
      this.logger.warn('Telegram alert skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
      return;
    }

    const lines = [
      `⚠️ *LaziGo — event ingestion alert*`,
      ``,
      `Failed sources: ${failedSources.map((s) => `\`${s}\``).join(', ')}`,
      ``,
      `*All source results:*`,
      ...allResults.map(
        (r) => `• \`${r.source}\`: fetched=${r.fetched} ins=${r.inserted} upd=${r.updated} err=${r.errors}`,
      ),
    ];

    const text = lines.join('\n');
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      });
      this.logger.log(`Telegram alert sent for: ${failedSources.join(', ')}`);
    } catch (err: any) {
      this.logger.error(`Telegram alert failed: ${err?.message}`);
    }
  }
}
