import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { Interaction } from '../database/entities/interaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Interaction])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
