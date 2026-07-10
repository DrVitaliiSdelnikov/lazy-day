import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { Interaction } from '../database/entities/interaction.entity';
import { InteractionEvent } from '../database/entities/interaction-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Interaction, InteractionEvent])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
