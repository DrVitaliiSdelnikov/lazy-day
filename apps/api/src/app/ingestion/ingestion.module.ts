import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OsmImportService } from './osm-import.service';
import { GoogleEnrichmentService } from './google-enrichment.service';
import { IngestionController } from './ingestion.controller';
import { Venue } from '../database/entities/venue.entity';
import { Place } from '../database/entities/place.entity';
import { SourceItem } from '../database/entities/source-item.entity';
import { SourceRef } from '../database/entities/source-ref.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, Place, SourceItem, SourceRef])],
  controllers: [IngestionController],
  providers: [OsmImportService, GoogleEnrichmentService],
  exports: [OsmImportService, GoogleEnrichmentService],
})
export class IngestionModule {}
