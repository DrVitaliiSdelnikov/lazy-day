import { Controller, Post, Query } from '@nestjs/common';
import { OsmImportService } from './osm-import.service';
import { GoogleEnrichmentService } from './google-enrichment.service';

@Controller('admin/ingestion')
export class IngestionController {
  constructor(
    private readonly osmImport: OsmImportService,
    private readonly googleEnrich: GoogleEnrichmentService,
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
}
