import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackController } from './feedback.controller';
import { UserFeedbackController } from './user-feedback.controller';
import { FeedbackService } from './feedback.service';
import { Interaction } from '../database/entities/interaction.entity';
import { InteractionEvent } from '../database/entities/interaction-event.entity';
import { Feedback } from '../database/entities/feedback.entity';
import { RecommendationModule } from '../recommendation/recommendation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Interaction, InteractionEvent, Feedback]),
    RecommendationModule,
  ],
  controllers: [FeedbackController, UserFeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
