import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const db = await this.checkDb();
    const events = await this.checkEventSources();

    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      events,
      uptime: process.uptime(),
    };
  }

  private async checkDb(): Promise<'ok' | 'down'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkEventSources(): Promise<Record<string, { last48h: number; status: string }>> {
    try {
      const rows: { source: string; cnt: string }[] = await this.dataSource.query(
        `SELECT source, COUNT(*) as cnt FROM events
         WHERE created_at > NOW() - INTERVAL '48 hours'
         GROUP BY source`,
      );
      const sources = ['opera_ge', 'google_events', 'yolo_ge'];
      const result: Record<string, { last48h: number; status: string }> = {};
      for (const s of sources) {
        const count = parseInt(rows.find(r => r.source === s)?.cnt ?? '0', 10);
        result[s] = { last48h: count, status: count > 0 ? 'ok' : 'stale' };
      }
      return result;
    } catch {
      return {};
    }
  }
}
