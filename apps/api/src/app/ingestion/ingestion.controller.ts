import { Controller, Post } from '@nestjs/common';
import { OsmImportService } from './osm-import.service';

@Controller('admin/ingestion')
export class IngestionController {
  constructor(private readonly osmImport: OsmImportService) {}

  @Post('osm')
  async triggerOsmImport() {
    return this.osmImport.importFromOverpass();
  }
}
