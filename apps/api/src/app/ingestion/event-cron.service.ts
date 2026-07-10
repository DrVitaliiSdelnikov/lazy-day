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
    try {
      const results = await this.eventIngestion.runAll();
      const total = results.reduce((sum, r) => sum + r.inserted + r.updated, 0);
      this.logger.log(`Daily refresh done: ${total} events inserted/updated across ${results.length} sources`);
    } catch (err: any) {
      this.logger.error(`Daily event refresh failed: ${err?.message}`);
    }

    // 3. Check source health
    await this.checkSourceHealth();
  }

  /** Check each event source for freshness. Alert if 0 events in 48h. */
  async checkSourceHealth(): Promise<Record<string, { count: number; status: string }>> {
    const sources = ['opera_ge', 'google_events', 'yolo_ge'];
    const result: Record<string, { count: number; status: string }> = {};

    for (const source of sources) {
      const rows = await this.dataSource.query(
        `SELECT COUNT(*) as cnt FROM events WHERE source = $1 AND created_at > NOW() - INTERVAL '48 hours'`,
        [source],
      );
      const count = parseInt(rows[0]?.cnt ?? '0', 10);
      const status = count > 0 ? 'ok' : 'stale';
      result[source] = { count, status };

      if (status === 'stale') {
        this.logger.error(`[EVENT ALERT] Source "${source}" returned 0 events in last 48h`);
        await this.sendTelegramAlert(source);
      }
    }

    return result;
  }

  private async sendTelegramAlert(source: string) {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = process.env['TELEGRAM_CHAT_ID'];
    if (!token || !chatId) {
      this.logger.warn('Telegram alert skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
      return;
    }

    const text = `⚠️ LaziGo: Event source "${source}" — 0 events in 48h. Check adapter.`;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (err: any) {
      this.logger.error(`Telegram alert failed: ${err?.message}`);
    }
  }
}
