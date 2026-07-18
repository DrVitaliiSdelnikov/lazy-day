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

  /** Sync enrichment data from local DB by osm_id (stable key). Replaces coord-based import-enrichment. */
  @Post('sync-by-osm')
  async syncByOsm(@Body() body: { records: any[] }) {
    let updated = 0, notFound = 0;

    for (const r of body.records) {
      if (!r.osm_id || !r.osm_type) { notFound++; continue; }

      // Find venue by osm_id
      const venues = await this.dataSource.query(
        'SELECT id FROM venues WHERE osm_id = $1 AND osm_type = $2 LIMIT 1',
        [r.osm_id, r.osm_type],
      );
      if (venues.length === 0) { notFound++; continue; }
      const venueId = venues[0].id;

      // Update venue
      await this.dataSource.query(`
        UPDATE venues SET
          google_place_id = COALESCE($1, google_place_id)
        WHERE id = $2`,
        [r.google_place_id, venueId],
      );

      // Update place
      await this.dataSource.query(`
        UPDATE places SET
          google_rating = COALESCE($1, google_rating),
          google_rating_count = COALESCE($2, google_rating_count),
          opening_hours = COALESCE($3, opening_hours),
          attributes = COALESCE($4, attributes),
          google_types = COALESCE($5, google_types),
          photos = COALESCE($6, photos),
          facet_cuisine = COALESCE($7, facet_cuisine),
          facet_format = COALESCE($8, facet_format),
          facet_price_tier = COALESCE($9, facet_price_tier),
          facet_price_conf = COALESCE($10, facet_price_conf),
          enriched_at = NOW()
        WHERE venue_id = $11`,
        [
          r.google_rating, r.google_rating_count,
          r.opening_hours ? JSON.stringify(r.opening_hours) : null,
          r.attributes ? JSON.stringify(r.attributes) : null,
          r.google_types, r.photos,
          r.facet_cuisine, r.facet_format,
          r.facet_price_tier, r.facet_price_conf,
          venueId,
        ],
      );
      updated++;
    }

    return { updated, notFound, total: body.records.length };
  }
}
