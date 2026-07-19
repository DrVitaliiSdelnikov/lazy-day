import { Module } from '@nestjs/common';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { ImpressionService } from './impression.service';

@Module({
  controllers: [RecommendationController],
  providers: [RecommendationService, ImpressionService],
  exports: [ImpressionService],
})
export class RecommendationModule {}
