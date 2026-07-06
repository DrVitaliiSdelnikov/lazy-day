import { Controller, Get, Param } from '@nestjs/common';
import { CardsService } from './cards.service';

@Controller('cards')
export class CardsController {
  constructor(private readonly service: CardsService) {}

  @Get(':type/:id')
  getCard(@Param('type') type: string, @Param('id') id: string) {
    return this.service.getCard(type, id);
  }
}
