import { Controller, Post, Get, Query, Param, Body, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
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

  @Post('fix-chains')
  async fixChains() {
    return this.osmImport.fixChainFlags();
  }

  @Post('translate-names')
  async translateNames() {
    return this.osmImport.translateGeorgianNames();
  }

  @Get('events/sources')
  async listEventSources() {
    return this.eventIngestion.listSources();
  }

  /** Temporary: import enrichment data from local DB export. Remove after use. */
  @Post('import-enrichment')
  async importEnrichment(@Body() body: { venues: any[]; places: any[] }) {
    let venueUpdated = 0, placeUpdated = 0;

    for (const v of body.venues) {
      const r = await this.dataSource.query(
        `UPDATE venues SET google_place_id = $1 WHERE id = $2 AND google_place_id IS NULL`,
        [v.google_place_id, v.id],
      );
      if (r[1] > 0) venueUpdated++;
    }

    for (const p of body.places) {
      const r = await this.dataSource.query(
        `UPDATE places SET google_rating = $1, google_rating_count = $2,
         opening_hours = $3, attributes = $4, google_types = $5, photos = $6
         WHERE id = $7 AND google_rating IS NULL`,
        [p.google_rating, p.google_rating_count,
         p.opening_hours ? JSON.stringify(p.opening_hours) : null,
         p.attributes ? JSON.stringify(p.attributes) : null,
         p.google_types, p.photos, p.id],
      );
      if (r[1] > 0) placeUpdated++;
    }

    return { venueUpdated, placeUpdated, venueTotal: body.venues.length, placeTotal: body.places.length };
  }
}
