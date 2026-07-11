import { Controller, Post, Get, Query, Param, UseGuards } from '@nestjs/common';
import { OsmImportService } from './osm-import.service';
import { GoogleEnrichmentService } from './google-enrichment.service';
import { EventIngestionService } from './event-ingestion.service';
import { AdminGuard } from '../guards/admin.guard';

@Controller('admin/ingestion')
@UseGuards(AdminGuard)
export class IngestionController {
  constructor(
    private readonly osmImport: OsmImportService,
    private readonly googleEnrich: GoogleEnrichmentService,
    private readonly eventIngestion: EventIngestionService,
  ) {}

  @Post('osm')
  async triggerOsmImport() {
    return this.osmImport.importFromOverpass();
  }

  @Post('google-enrich')
  async triggerGoogleEnrichment(@Query('limit') limit?: string) {
    return this.googleEnrich.enrichPro(limit ? parseInt(limit, 10) : 100);
  }

  @Post('google-enrich-enterprise')
  async triggerGoogleEnterpriseEnrichment(@Query('limit') limit?: string) {
    return this.googleEnrich.enrichEnterprise(limit ? parseInt(limit, 10) : 100);
  }

  @Post('google-enrich-atmosphere')
  async triggerGoogleAtmosphereEnrichment(@Query('limit') limit?: string) {
    return this.googleEnrich.enrichAtmosphere(limit ? parseInt(limit, 10) : 100);
  }

  @Post('events/run')
  async triggerAllEventSources() {
    return this.eventIngestion.runAll();
  }

  @Post('events/source/:name')
  async triggerEventSource(@Param('name') name: string) {
    return this.eventIngestion.runByName(name);
  }

  @Get('events/sources')
  async listEventSources() {
    return this.eventIngestion.listSources();
  }
}
