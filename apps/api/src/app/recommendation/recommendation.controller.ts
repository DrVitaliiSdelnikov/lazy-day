import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { DiscoverRequestDto } from './dto/discover-request.dto';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly service: RecommendationService) {}

  @Post()
  discover(@Body() dto: DiscoverRequestDto) {
    return this.service.discover(dto);
  }

  @Get(':sessionId/more')
  more(@Param('sessionId') sessionId: string) {
    return this.service.more(sessionId);
  }
}
