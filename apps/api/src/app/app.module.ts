import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { HealthModule } from './health/health.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { CardsModule } from './cards/cards.module';
import { FeedbackModule } from './feedback/feedback.module';
import { MetaModule } from './meta/meta.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { Venue } from './database/entities/venue.entity';
import { Place } from './database/entities/place.entity';
import { Event } from './database/entities/event.entity';
import { SourceItem } from './database/entities/source-item.entity';
import { SourceRef } from './database/entities/source-ref.entity';
import { Interaction } from './database/entities/interaction.entity';
import { RecommendationLog } from './database/entities/recommendation-log.entity';
import { DedupCandidate } from './database/entities/dedup-candidate.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url:
        process.env['DATABASE_URL'] ||
        'postgresql://lazyday:lazyday_dev@localhost:5434/lazyday',
      entities: [
        Venue,
        Place,
        Event,
        SourceItem,
        SourceRef,
        Interaction,
        RecommendationLog,
        DedupCandidate,
      ],
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
      logging: process.env['NODE_ENV'] === 'development',
    }),
    HealthModule,
    RecommendationModule,
    CardsModule,
    FeedbackModule,
    MetaModule,
    IngestionModule,
  ],
})
export class AppModule {}
