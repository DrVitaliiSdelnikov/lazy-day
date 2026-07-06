import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from '../database/entities/place.entity';
import { Event } from '../database/entities/event.entity';

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
  ) {}

  async getCard(type: string, id: string) {
    if (type === 'place') {
      const place = await this.placeRepo.findOne({
        where: { id },
        relations: { venue: true },
      });
      if (!place) throw new NotFoundException(`Place ${id} not found`);
      return place;
    }

    if (type === 'event') {
      const event = await this.eventRepo.findOne({
        where: { id },
        relations: { venue: true },
      });
      if (!event) throw new NotFoundException(`Event ${id} not found`);
      return event;
    }

    throw new NotFoundException(`Unknown card type: ${type}`);
  }
}
