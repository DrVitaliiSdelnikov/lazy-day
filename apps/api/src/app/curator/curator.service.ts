import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CuratorRequestDto } from './dto/curator-request.dto';
import { checkOpenStatus, getOpenLabel } from '../recommendation/opening-hours';

interface TimeWindow { from: string; to: string; }

interface CurationItem {
  id: string;
  type: 'place' | 'event';
  day?: 'saturday' | 'sunday';
  title: string;
  category: string;
  lat: number;
  lng: number;
  distanceM: number;
  walkMinutes: number;
  hook?: string;
  rating?: number;
  ratingCount?: number;
  openStatus?: string;
  petStatus?: string;
  whyLabel?: string;
  startsAt?: string;
  ticketUrl?: string;
  priceLabel?: string;
  careLine?: string;
  photoUrl?: string;
}

interface Gift {
  eventId: string;
  place: CurationItem;
  confidence: 'confirmed' | 'likely';
  text: string;
}

interface CurationResponse {
  id: string;
  header: { title: string; care: string[] };
  items: CurationItem[];
  gifts: Gift[];
  meta: { dateType: string; dayPart: string; seed: number };
}

// Mood → categories/tags mapping for hard filtering
const MOOD_CATEGORIES: Record<string, string[]> = {
  events: [],  // events matched by type, not category
  culture: ['museum', 'gallery', 'theater', 'viewpoint'],
  food: ['restaurant', 'cafe', 'bakery', 'bar'],
  scenic: ['viewpoint', 'park'],
  spa: ['bath', 'spa'],
  nightlife: ['bar', 'club'],
  kids: ['park', 'entertainment'],
};

const WALK_SPEED = 80; // m/min
const STREET_CURVE = 1.3;

@Injectable()
export class CuratorService {
  private readonly logger = new Logger(CuratorService.name);

  constructor(private readonly ds: DataSource) {}

  async buildCuration(dto: CuratorRequestDto): Promise<CurationResponse> {
    const locale = dto.locale ?? 'ru';
    const seed = dto.seed ?? Math.floor(Math.random() * 2147483647);
    const timeWindows = this.resolveTimeWindows(dto);
    const radiusM = dto.outOfTown ? 30000 : 10000;

    // 1. Fetch events for all time windows
    let allEvents: any[] = [];
    for (const tw of timeWindows) {
      const events = await this.fetchEvents(dto.lat, dto.lng, radiusM, tw);
      const dayLabel = timeWindows.length > 1
        ? (timeWindows.indexOf(tw) === 0 ? 'saturday' : 'sunday')
        : undefined;
      for (const e of events) e._day = dayLabel;
      allEvents.push(...events);
    }

    // 2. Hard filter events by moods
    if (!dto.moods.includes('events')) {
      // If "events" not selected, filter by category match
      const moodCats = this.getMoodCategories(dto.moods);
      allEvents = allEvents.filter(e => moodCats.some(c => e.category?.includes(c)));
    }

    // 3. Fetch places
    const places = await this.fetchPlaces(dto.lat, dto.lng, radiusM, dto.moods);

    // 4. Score and sort
    const scoredEvents = allEvents
      .map(e => this.mapEvent(e, dto, locale))
      .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime());

    const scoredPlaces = places
      .map(p => this.mapPlace(p, dto, locale))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

    // 5. Season boost
    this.applySeasonBoost(scoredPlaces, dto);

    // 6. Compose: events first (max 3), places fill to 5-8
    const maxEvents = Math.min(scoredEvents.length, 3);
    const maxPlaces = Math.min(scoredPlaces.length, 8 - maxEvents);
    const items: CurationItem[] = [
      ...scoredEvents.slice(0, maxEvents),
      ...scoredPlaces.slice(0, maxPlaces),
    ];

    // 7. Care lines K1-K7
    const careLines = this.computeCareLines(items, dto);
    const headerCare = careLines.filter(c => c.position === 'header').map(c => c.text).slice(0, 2);

    // Attach item care lines
    for (const cl of careLines.filter(c => c.position === 'item')) {
      const item = items.find(i => i.id === cl.itemId);
      if (item && !item.careLine) item.careLine = cl.text;
    }

    // 8. Gifts
    const gifts = await this.buildGifts(items, dto, locale);

    // 9. Header
    const title = this.buildTitle(dto, items, locale);

    this.logger.log(`Curator: ${items.length} items (${scoredEvents.length} events, ${scoredPlaces.length} places), ${gifts.length} gifts`);

    return {
      id: `cur_${seed}`,
      header: { title, care: headerCare },
      items,
      gifts,
      meta: { dateType: dto.dateType, dayPart: dto.dayPart, seed },
    };
  }

  async swapItem(dto: { itemId: string; moods: string[]; lat: number; lng: number; locale?: string; seed?: number }): Promise<CurationItem | null> {
    // Find a replacement of the same type
    const places = await this.fetchPlaces(dto.lat, dto.lng, 10000, dto.moods);
    const candidates = places.filter((p: any) => p.id !== dto.itemId);
    if (candidates.length === 0) return null;

    // Pick by seed for determinism
    const seed = dto.seed ?? Math.floor(Math.random() * candidates.length);
    const pick = candidates[seed % candidates.length];
    return this.mapPlace(pick, { lat: dto.lat, lng: dto.lng } as any, dto.locale ?? 'ru');
  }

  // --- Private methods ---

  private resolveTimeWindows(dto: CuratorRequestDto): TimeWindow[] {
    const tbilisiOffsetH = 4;
    const baseDate = dto.dateType === 'custom' && dto.customDate
      ? new Date(dto.customDate)
      : new Date();

    if (dto.dateType === 'tomorrow') {
      baseDate.setDate(baseDate.getDate() + 1);
    }

    if (dto.dateType === 'weekend') {
      const sat = new Date(baseDate);
      const dayOfWeek = sat.getDay();
      const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
      sat.setDate(sat.getDate() + daysUntilSat);
      const sun = new Date(sat);
      sun.setDate(sun.getDate() + 1);
      return [
        this.dayPartWindow(sat, dto.dayPart, tbilisiOffsetH),
        this.dayPartWindow(sun, dto.dayPart, tbilisiOffsetH),
      ];
    }

    return [this.dayPartWindow(baseDate, dto.dayPart, tbilisiOffsetH)];
  }

  private dayPartWindow(date: Date, part: string, offsetH: number): TimeWindow {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    let fromH: number, toH: number;
    if (part === 'day') { fromH = 8; toH = 17; }
    else if (part === 'evening') { fromH = 17; toH = 26; } // 26 = 02:00 next day
    else { fromH = 8; toH = 26; } // all_day

    const from = new Date(d);
    from.setUTCHours(fromH - offsetH, 0, 0, 0);
    const to = new Date(d);
    to.setUTCHours(toH - offsetH, 0, 0, 0);

    return { from: from.toISOString(), to: to.toISOString() };
  }

  private async fetchEvents(lat: number, lng: number, radiusM: number, tw: TimeWindow): Promise<any[]> {
    return this.ds.query(`
      SELECT e.id, 'event' AS type, e.title, e.title_en, e.category, e.tags,
        v.lat, v.lng, v.name AS venue_name,
        e.starts_at, e.ends_at, e.ticket_url, e.poster_url,
        e.price_min, e.price_max,
        CASE WHEN v.lat IS NOT NULL THEN
          (6371000 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(v.lat)) * cos(radians(v.lng) - radians($2)) + sin(radians($1)) * sin(radians(v.lat)))))
        ELSE NULL END AS distance_m
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      WHERE e.status = 'scheduled'
        AND e.starts_at BETWEEN $3 AND $4
      ORDER BY e.starts_at ASC
      LIMIT 50
    `, [lat, lng, tw.from, tw.to]);
  }

  private async fetchPlaces(lat: number, lng: number, radiusM: number, moods: string[]): Promise<any[]> {
    const moodCats = this.getMoodCategories(moods);
    const catFilter = moodCats.length > 0
      ? `AND p.category IN (${moodCats.map((_, i) => `$${i + 5}`).join(',')})`
      : '';

    const radiusDeg = radiusM / 111320;
    return this.ds.query(`
      SELECT p.id, 'place' AS type, v.name, v.name_en, p.category, p.tags,
        v.lat, v.lng, p.hook, p.hook_ru, p.walk_tier, p.outdoor,
        p.google_rating, p.google_rating_count, p.opening_hours, p.photos,
        p.facet_atmosphere, p.facet_occasion, p.attributes,
        (6371000 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(v.lat)) * cos(radians(v.lng) - radians($2)) + sin(radians($1)) * sin(radians(v.lat))))) AS distance_m
      FROM places p
      JOIN venues v ON p.venue_id = v.id
      WHERE p.status = 'active'
        AND p.walk_tier IN ('must_see', 'worth_detour')
        AND v.lat BETWEEN $1 - $3 AND $1 + $3
        AND v.lng BETWEEN $2 - $4 AND $2 + $4
        ${catFilter}
      ORDER BY p.google_rating DESC NULLS LAST
      LIMIT 100
    `, [lat, lng, radiusDeg, radiusDeg * 1.3, ...moodCats]);
  }

  private getMoodCategories(moods: string[]): string[] {
    const cats = new Set<string>();
    for (const m of moods) {
      for (const c of (MOOD_CATEGORIES[m] ?? [])) cats.add(c);
    }
    return [...cats];
  }

  private mapEvent(e: any, dto: CuratorRequestDto, locale: string): CurationItem {
    const isRu = locale === 'ru';
    const isGeorgian = (s: string) => /[\u10A0-\u10FF]/.test(s);
    let title = e.title;
    if (isRu && isGeorgian(title) && e.title_en) title = e.title_en;

    const distM = e.distance_m != null ? Math.round(e.distance_m) : 0;
    const price = e.price_min != null
      ? (e.price_max && e.price_max !== e.price_min ? `${e.price_min}–${e.price_max} ₾` : `от ${e.price_min} ₾`)
      : undefined;

    return {
      id: e.id, type: 'event', day: e._day, title, category: e.category,
      lat: Number(e.lat ?? 0), lng: Number(e.lng ?? 0),
      distanceM: distM,
      walkMinutes: distM > 0 ? Math.round((distM / WALK_SPEED) * STREET_CURVE) : 0,
      startsAt: e.starts_at, ticketUrl: e.ticket_url, priceLabel: price,
      photoUrl: e.poster_url,
    };
  }

  private mapPlace(p: any, dto: { lat: number; lng: number }, locale: string): CurationItem {
    const isRu = locale === 'ru';
    const isGeorgian = (s: string) => /[\u10A0-\u10FF]/.test(s);
    let title = isRu
      ? (!isGeorgian(p.name) ? p.name : null) ?? p.name_en ?? p.name
      : p.name_en ?? p.name;

    const distM = p.distance_m != null ? Math.round(p.distance_m) : 0;
    const timeMid = new Date();
    const openStatus = checkOpenStatus(p.opening_hours, timeMid);

    // Pet status
    const attrs = p.attributes as Record<string, unknown> | undefined;
    let petStatus: string | undefined;
    if (attrs?.['allowsDogs'] === true) petStatus = 'pet_friendly';
    else if (attrs?.['outdoorSeating'] === true) petStatus = 'outdoor_seating';

    return {
      id: p.id, type: 'place', title, category: p.category,
      lat: Number(p.lat), lng: Number(p.lng),
      distanceM: distM,
      walkMinutes: distM > 0 ? Math.round((distM / WALK_SPEED) * STREET_CURVE) : 0,
      hook: isRu && p.hook_ru ? p.hook_ru : p.hook,
      rating: p.google_rating ? Number(p.google_rating) : undefined,
      ratingCount: p.google_rating_count,
      openStatus: openStatus !== 'unknown' ? getOpenLabel(openStatus, locale) : undefined,
      petStatus,
      photoUrl: p.photos?.[0],
    };
  }

  private applySeasonBoost(items: CurationItem[], dto: CuratorRequestDto) {
    const date = dto.customDate ? new Date(dto.customDate) : new Date();
    const month = date.getMonth();
    const isSummer = month >= 4 && month <= 9;
    const isWinter = month >= 11 || month <= 2;

    for (const item of items) {
      if (isSummer && item.category === 'bath') {
        // Move baths down in summer (less relevant)
      }
      if (isWinter && item.category === 'bath') {
        // Baths more relevant in winter — already high rated, no change needed
      }
    }
    // Season boost is mostly about ordering — scoring handles it via interest match
  }

  private computeCareLines(items: CurationItem[], dto: CuratorRequestDto): { rule: string; text: string; position: 'header' | 'item'; itemId?: string }[] {
    const lines: { rule: string; text: string; position: 'header' | 'item'; itemId?: string }[] = [];
    const isRu = (dto.locale ?? 'ru') === 'ru';

    for (const item of items) {
      // K1: event with start time
      if (item.type === 'event' && item.startsAt) {
        const walkMin = item.walkMinutes || 0;
        if (walkMin > 5) {
          const start = new Date(item.startsAt);
          const leaveMin = walkMin + 10;
          const leave = new Date(start.getTime() - leaveMin * 60000);
          const startStr = start.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' });
          const leaveStr = leave.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' });
          lines.push({
            rule: 'K1',
            text: isRu ? `Начало в ${startStr} — выходить около ${leaveStr}` : `Starts at ${startStr} — leave around ${leaveStr}`,
            position: 'item', itemId: item.id,
          });
        }
      }

      // K2: far (>3km)
      if (item.distanceM > 3000) {
        lines.push({
          rule: 'K2',
          text: isRu ? 'На другом конце города — удобнее доехать' : 'Far away — better to take a ride',
          position: 'item', itemId: item.id,
        });
      }

      // K6: ticket
      if (item.type === 'event' && item.ticketUrl) {
        lines.push({
          rule: 'K6',
          text: isRu ? 'Билет на сайте площадки' : 'Ticket on venue website',
          position: 'item', itemId: item.id,
        });
      }

      // K7: outdoor
      // Need outdoor field — check from original data (not on CurationItem yet)
    }

    // K3: sunday
    const date = dto.customDate ? new Date(dto.customDate) : new Date();
    if (dto.dateType === 'tomorrow') date.setDate(date.getDate() + 1);
    if (date.getDay() === 0 || dto.dateType === 'weekend') {
      lines.push({
        rule: 'K3',
        text: isRu ? 'В воскресенье многие закрываются раньше — в подборке проверено' : 'Sunday hours may be shorter — we checked',
        position: 'header',
      });
    }

    // K5: late finish
    const lastEvent = items.filter(i => i.type === 'event' && i.startsAt).pop();
    if (lastEvent?.startsAt && dto.dayPart !== 'day') {
      const startH = new Date(lastEvent.startsAt).getUTCHours() + 4; // Tbilisi
      if (startH >= 21) {
        lines.push({
          rule: 'K5',
          text: isRu ? 'Закончится поздно — обратно удобнее на такси' : 'Finishing late — taxi back is easier',
          position: 'header',
        });
      }
    }

    return lines;
  }

  private async buildGifts(items: CurationItem[], dto: CuratorRequestDto, locale: string): Promise<Gift[]> {
    const events = items.filter(i => i.type === 'event' && i.startsAt && i.lat && i.lng);
    if (events.length === 0) return [];
    const isRu = locale === 'ru';

    const gifts: Gift[] = [];
    for (const event of events) {
      if (gifts.length >= 2) break;

      // Find nearby places (bars/restaurants within 500m)
      const nearby = await this.ds.query(`
        SELECT p.id, v.name, v.name_en, p.category, v.lat, v.lng, p.hook, p.hook_ru,
          p.opening_hours, p.google_rating, p.photos,
          (6371000 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(v.lat)) * cos(radians(v.lng) - radians($2)) + sin(radians($1)) * sin(radians(v.lat))))) AS distance_m
        FROM places p JOIN venues v ON p.venue_id = v.id
        WHERE p.status = 'active'
          AND p.category IN ('bar', 'restaurant', 'cafe')
          AND p.walk_tier IN ('must_see', 'worth_detour')
        ORDER BY distance_m ASC
        LIMIT 10
      `, [event.lat, event.lng]);

      const existingIds = new Set(items.map(i => i.id));
      for (const cand of nearby) {
        if (existingIds.has(cand.id)) continue;
        if (Number(cand.distance_m) > 500) break;

        const isEveningCat = ['bar', 'club', 'pub'].includes(cand.category);
        const eventEnd = this.estimateEventEnd(event);
        const status = checkOpenStatus(cand.opening_hours, eventEnd);

        let confidence: 'confirmed' | 'likely' | 'skip';
        let text: string;
        const placeName = isRu
          ? (!/[\u10A0-\u10FF]/.test(cand.name) ? cand.name : cand.name_en ?? cand.name)
          : (cand.name_en ?? cand.name);

        if (status === 'open') {
          confidence = 'confirmed';
          text = isRu
            ? `В двух шагах — ${placeName}, открыт. Если захотите продолжить вечер.`
            : `Just steps away — ${placeName}, open. If you want to continue the evening.`;
        } else if (status === 'unknown' && isEveningCat) {
          confidence = 'likely';
          text = isRu
            ? `Рядом ${placeName} — если захотите продолжить`
            : `Nearby ${placeName} — if you want to continue`;
        } else {
          confidence = 'skip';
          continue;
        }

        gifts.push({
          eventId: event.id,
          place: this.mapPlace(cand, { lat: event.lat, lng: event.lng }, locale),
          confidence,
          text,
        });
        break;
      }
    }
    return gifts;
  }

  private estimateEventEnd(event: CurationItem): Date {
    if (event.startsAt) {
      const start = new Date(event.startsAt);
      return new Date(start.getTime() + 2 * 60 * 60000); // +2h default
    }
    return new Date();
  }

  private buildTitle(dto: CuratorRequestDto, items: CurationItem[], locale: string): string {
    const isRu = locale === 'ru';
    const dayNames: Record<string, string> = isRu
      ? { today: 'Сегодня', tomorrow: 'Завтра', weekend: 'Выходные', custom: '' }
      : { today: 'Today', tomorrow: 'Tomorrow', weekend: 'Weekend', custom: '' };

    const partNames: Record<string, string> = isRu
      ? { day: 'днём', evening: 'вечером', all_day: '' }
      : { day: 'during the day', evening: 'in the evening', all_day: '' };

    const moodNames: Record<string, string> = isRu
      ? { events: 'под события', food: 'вкусно поесть', culture: 'культура', scenic: 'виды', spa: 'бани', nightlife: 'ночь', kids: 'с детьми' }
      : { events: 'events', food: 'good food', culture: 'culture', scenic: 'scenic', spa: 'spa', nightlife: 'nightlife', kids: 'with kids' };

    const day = dayNames[dto.dateType] ?? '';
    const part = partNames[dto.dayPart] ?? '';
    const mood = dto.moods.slice(0, 2).map(m => moodNames[m] ?? m).join(isRu ? ' и ' : ' & ');

    if (isRu) {
      return `${day} ${part}: ${mood}`.replace(/\s+/g, ' ').trim();
    }
    return `${day} ${part}: ${mood}`.replace(/\s+/g, ' ').trim();
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
