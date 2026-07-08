import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { EventIngestionService } from './event-ingestion.service';

/**
 * Daily event refresh cron.
 * Runs all enabled event sources once per day at 06:00 Tbilisi time (02:00 UTC).
 * Also marks past events as 'past'.
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
  }
}
