import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OsmImportService } from './osm-import.service';
import { GoogleEnrichmentService } from './google-enrichment.service';
import { EventIngestionService } from './event-ingestion.service';
import { EventCronService } from './event-cron.service';
import { FacetMapperService } from './facet-mapper.service';
import { IngestionController } from './ingestion.controller';
import { Venue } from '../database/entities/venue.entity';
import { Place } from '../database/entities/place.entity';
import { Event } from '../database/entities/event.entity';
import { SourceItem } from '../database/entities/source-item.entity';
import { SourceRef } from '../database/entities/source-ref.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, Place, Event, SourceItem, SourceRef])],
  controllers: [IngestionController],
  providers: [OsmImportService, GoogleEnrichmentService, EventIngestionService, EventCronService, FacetMapperService],
  exports: [OsmImportService, GoogleEnrichmentService, EventIngestionService, FacetMapperService],
})
export class IngestionModule {}
