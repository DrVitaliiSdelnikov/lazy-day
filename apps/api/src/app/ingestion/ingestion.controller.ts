import { Controller, Post, Get, Query, Param, Body, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OsmImportService } from './osm-import.service';
import { GoogleEnrichmentService } from './google-enrichment.service';
import { EventIngestionService } from './event-ingestion.service';
import { FacetMapperService } from './facet-mapper.service';
import { AdminGuard } from '../guards/admin.guard';

@Controller('admin/ingestion')
@UseGuards(AdminGuard)
export class IngestionController {
  constructor(
    private readonly osmImport: OsmImportService,
    private readonly googleEnrich: GoogleEnrichmentService,
    private readonly eventIngestion: EventIngestionService,
    private readonly facetMapper: FacetMapperService,
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

  @Post('events/import')
  async importEvents(@Body() body: { events: any[] }) {
    return this.eventIngestion.importEvents(body.events);
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

  @Post('map-facets')
  async mapFacets() {
    return this.facetMapper.mapAll();
  }

  @Post('recalculate-idf')
  async recalculateIdf() {
    return this.facetMapper.recalculateIdf();
  }

  @Get('events/sources')
  async listEventSources() {
    return this.eventIngestion.listSources();
  }

  /** Temporary: import enrichment data from local DB. Matches by coords. Remove after osm_id migration. */
  @Post('import-enrichment')
  async importEnrichment(@Body() body: { records: any[] }) {
    let updated = 0, notFound = 0;

    for (const r of body.records) {
      const res = await this.dataSource.query(
        `UPDATE venues SET
          google_place_id = COALESCE($1, google_place_id)
        WHERE ABS(lat - $2) < 0.0000001 AND ABS(lng - $3) < 0.0000001
          AND google_place_id IS NULL`,
        [r.google_place_id, r.lat, r.lng],
      );
      if (res[1] > 0) {
        // Now update the linked place
        await this.dataSource.query(
          `UPDATE places SET
            google_rating = COALESCE($1, google_rating),
            google_rating_count = COALESCE($2, google_rating_count),
            opening_hours = COALESCE($3, opening_hours),
            attributes = COALESCE($4, attributes),
            google_types = COALESCE($5, google_types),
            photos = COALESCE($6, photos)
          WHERE venue_id = (
            SELECT id FROM venues
            WHERE ABS(lat - $7) < 0.0000001 AND ABS(lng - $8) < 0.0000001
            LIMIT 1
          ) AND google_rating IS NULL`,
          [r.google_rating, r.google_rating_count,
           r.opening_hours ? JSON.stringify(r.opening_hours) : null,
           r.attributes ? JSON.stringify(r.attributes) : null,
           r.google_types, r.photos, r.lat, r.lng],
        );
        updated++;
      } else {
        notFound++;
      }
    }

    return { updated, notFound, total: body.records.length };
  }
}
