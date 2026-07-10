import { Body, Controller, Headers, Post } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { InteractionDto } from './dto/interaction.dto';
import { BatchEventsDto } from './dto/batch-events.dto';

@Controller('interactions')
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Post()
  log(
    @Headers('x-device-id') deviceId: string,
    @Body() dto: InteractionDto,
  ) {
    return this.service.log(deviceId, dto);
  }

  @Post('batch')
  batch(
    @Headers('x-device-id') deviceId: string,
    @Body() dto: BatchEventsDto,
  ) {
    return this.service.logBatch(deviceId, dto);
  }
}
