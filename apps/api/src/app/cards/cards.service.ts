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
      return this.mapPlace(place);
    }

    if (type === 'event') {
      const event = await this.eventRepo.findOne({
        where: { id },
        relations: { venue: true },
      });
      if (!event) throw new NotFoundException(`Event ${id} not found`);
      return this.mapEvent(event);
    }

    throw new NotFoundException(`Unknown card type: ${type}`);
  }

  private mapPlace(p: Place) {
    const v = p.venue;
    return {
      id: p.id,
      type: 'place' as const,
      title: v?.name ?? '',
      category: p.category,
      lat: v?.lat ?? 0,
      lng: v?.lng ?? 0,
      distanceM: 0,
      walkMinutes: 0,
      explanations: [],
      source: 'canonical',
      address: v?.address,
      rating: p.rating ? Number(p.rating) : undefined,
      ratingCount: p.ratingCount,
      indoor: p.indoor,
      photos: p.photos,
      openingHours: p.openingHours,
      website: v?.website,
      phone: v?.phone,
    };
  }

  private mapEvent(e: Event) {
    const v = e.venue;
    return {
      id: e.id,
      type: 'event' as const,
      title: e.title,
      category: e.category,
      lat: v?.lat ?? 0,
      lng: v?.lng ?? 0,
      distanceM: 0,
      walkMinutes: 0,
      explanations: [],
      source: 'canonical',
      startsAt: e.startsAt?.toISOString(),
      endsAt: e.endsAt?.toISOString(),
      venueName: v?.name,
      ticketUrl: e.ticketUrl,
      address: v?.address,
      description: e.description,
    };
  }
}
