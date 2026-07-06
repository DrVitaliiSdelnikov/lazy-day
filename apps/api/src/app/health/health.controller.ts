import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const db = await this.checkDb();

    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
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
}
