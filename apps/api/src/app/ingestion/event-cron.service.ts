import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { EventIngestionService } from './event-ingestion.service';

/**
 * Daily event refresh cron.
 * Runs all enabled event sources once per day at 06:00 Tbilisi time (02:00 UTC).
 * Also marks past events as 'past'.
 * After run: checks source freshness, alerts via Telegram if stale.
 */
@Injectable()
export class EventCronService {
  private readonly logger = new Logger(EventCronService.name);

  constructor(
    private readonly eventIngestion: EventIngestionService,
    private readonly dataSource: DataSource,
  ) {}

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
