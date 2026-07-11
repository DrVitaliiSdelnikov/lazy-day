import { Controller, Get, Param, Query } from '@nestjs/common';
import { CardsService } from './cards.service';

@Controller('cards')
export class CardsController {
  constructor(private readonly service: CardsService) {}

  @Get(':type/:id')
  getCard(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.service.getCard(type, id, lat ? Number(lat) : undefined, lng ? Number(lng) : undefined);
  }
}
