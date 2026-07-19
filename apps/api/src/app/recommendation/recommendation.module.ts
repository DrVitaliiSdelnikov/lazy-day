import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { ImpressionService } from './impression.service';
import { TasteProfileService } from './taste-profile.service';
import { Place } from '../database/entities/place.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Place])],
  controllers: [RecommendationController],
  providers: [RecommendationService, ImpressionService, TasteProfileService],
  exports: [ImpressionService, TasteProfileService],
})
export class RecommendationModule {}
