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

  async getCard(type: string, id: string, userLat?: number, userLng?: number) {
    if (type === 'place') {
      const place = await this.placeRepo.findOne({
        where: { id },
        relations: { venue: true },
      });
      if (!place) throw new NotFoundException(`Place ${id} not found`);
      return this.mapPlace(place, userLat, userLng);
    }

    if (type === 'event') {
      const event = await this.eventRepo.findOne({
        where: { id },
        relations: { venue: true },
      });
      if (!event) throw new NotFoundException(`Event ${id} not found`);
      return this.mapEvent(event, userLat, userLng);
    }

    throw new NotFoundException(`Unknown card type: ${type}`);
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private mapPlace(p: Place, userLat?: number, userLng?: number) {
    const v = p.venue;
    const vLat = v?.lat ?? 0;
    const vLng = v?.lng ?? 0;
    const distanceM = (userLat != null && userLng != null) ? Math.round(this.haversineDistance(userLat, userLng, vLat, vLng)) : 0;
    const walkMinutes = distanceM > 0 ? Math.round((distanceM / 80) * 1.3) : 0;
    return {
      id: p.id,
      type: 'place' as const,
      title: v?.name ?? '',
      category: p.category,
      lat: vLat,
      lng: vLng,
      distanceM,
      walkMinutes,
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

  private mapEvent(e: Event, userLat?: number, userLng?: number) {
    const v = e.venue;
    const vLat = v?.lat ?? 0;
    const vLng = v?.lng ?? 0;
    const distanceM = (userLat != null && userLng != null) ? Math.round(this.haversineDistance(userLat, userLng, vLat, vLng)) : 0;
    const walkMinutes = distanceM > 0 ? Math.round((distanceM / 80) * 1.3) : 0;
    return {
      id: e.id,
      type: 'event' as const,
      title: e.title,
      category: e.category,
      lat: vLat,
      lng: vLng,
      distanceM,
      walkMinutes,
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
