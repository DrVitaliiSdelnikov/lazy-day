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

  async getCard(type: string, id: string, userLat?: number, userLng?: number, locale = 'ru') {
    if (type === 'place') {
      const place = await this.placeRepo.findOne({
        where: { id },
        relations: { venue: true },
      });
      if (!place) throw new NotFoundException(`Place ${id} not found`);
      return this.mapPlace(place, userLat, userLng, locale);
    }

    if (type === 'event') {
      const event = await this.eventRepo.findOne({
        where: { id },
        relations: { venue: true },
      });
      if (!event) throw new NotFoundException(`Event ${id} not found`);
      return this.mapEvent(event, userLat, userLng, locale);
    }

    throw new NotFoundException(`Unknown card type: ${type}`);
  }

  /** Smart title fallback — same logic as recommendation service */
  private resolveTitle(name: string, nameEn?: string, nameKa?: string, locale = 'ru'): string {
    const isGeorgian = (s: string) => /[\u10A0-\u10FF]/.test(s);
    if (locale === 'ka') return nameKa ?? name;
    if (locale === 'en') return nameEn ?? (isGeorgian(name) ? nameEn ?? name : name);
    // ru: prefer non-Georgian
    return (!isGeorgian(name) ? name : null) ?? nameEn ?? name;
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private mapPlace(p: Place, userLat?: number, userLng?: number, locale = 'ru') {
    const v = p.venue;
    const vLat = v?.lat ?? 0;
    const vLng = v?.lng ?? 0;
    const distanceM = (userLat != null && userLng != null) ? Math.round(this.haversineDistance(userLat, userLng, vLat, vLng)) : 0;
    const walkMinutes = distanceM > 0 ? Math.round((distanceM / 80) * 1.3) : 0;
    return {
      id: p.id,
      type: 'place' as const,
      title: this.resolveTitle(v?.name ?? '', v?.nameEn, v?.nameKa, locale),
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

  private mapEvent(e: Event, userLat?: number, userLng?: number, locale = 'ru') {
    const v = e.venue;
    const vLat = v?.lat ?? 0;
    const vLng = v?.lng ?? 0;
    const distanceM = (userLat != null && userLng != null) ? Math.round(this.haversineDistance(userLat, userLng, vLat, vLng)) : 0;
    const walkMinutes = distanceM > 0 ? Math.round((distanceM / 80) * 1.3) : 0;
    return {
      id: e.id,
      type: 'event' as const,
      title: this.resolveTitle(e.title, e.titleEn, e.titleKa, locale),
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
      priceLabel: this.formatEventPrice(e.priceMin, e.priceMax, e.currency),
      posterUrl: e.posterUrl
        ? (e.posterUrl.includes('static.biletebi.ge')
          ? `/v1/cards/img-proxy?url=${encodeURIComponent(e.posterUrl)}`
          : e.posterUrl)
        : undefined,
      address: v?.address,
      description: e.description,
    };
  }

  private formatEventPrice(min?: number, max?: number, currency = 'GEL'): string | undefined {
    if (min == null) return undefined;
    if (min === 0) return 'Бесплатно';
    if (max != null && max !== min) return `${min}–${max} ${currency}`;
    return `${min} ${currency}`;
  }
}
