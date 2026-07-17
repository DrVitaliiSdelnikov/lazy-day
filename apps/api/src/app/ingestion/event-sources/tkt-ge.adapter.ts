import { Logger } from '@nestjs/common';
import { EventSourceAdapter, NormalizedEvent } from './types';

const BASE_URL = 'https://tkt.ge';
const GATEWAY_URL = 'https://gateway.tkt.ge';
const API_KEY = '7d8d34d1-e9af-4897-9f0f-5c36c179be77';
const IMAGE_CDN = `${BASE_URL}/api/image`;

/**
 * Categories to scrape → LazyDay category mapping.
 * API key is public — baked into tkt.ge frontend JS bundle.
 * robots.txt: content pages allowed, checkout/search blocked.
 * We only read event listings.
 *
 * Full category list: gateway.tkt.ge/Categories?api_key=...
 *   1=კინო(cinema, empty)  2=მუსიკა/კონცერტი  5=სპორტი
 *  16=თეატრი  17=საბავშვო(kids)  18=ოპერა
 *  71=სთენდაფი(standup)  73=მასტერკლასი  75=ფესტივალი
 */
const CATEGORIES: Array<{ id: number; category: string; tags: string[] }> = [
  { id: 2,  category: 'music',         tags: ['music', 'concert', 'entertainment'] },
  { id: 5,  category: 'sports',        tags: ['sports', 'outdoor'] },
  { id: 16, category: 'theater',       tags: ['culture', 'theater', 'entertainment'] },
  { id: 17, category: 'family',        tags: ['family', 'entertainment'] },
  { id: 18, category: 'theater',       tags: ['culture', 'theater'] },
  { id: 71, category: 'entertainment', tags: ['entertainment', 'comedy'] },
  { id: 73, category: 'culture',       tags: ['culture', 'workshop'] },
  { id: 75, category: 'entertainment', tags: ['entertainment', 'festival', 'outdoor'] },
];

/**
 * Adapter for tkt.ge — largest Georgian ticketing platform.
 *
 * API: gateway.tkt.ge/Shows/List?categoryId={id}&api_key={key}
 * Response: { shows: Show[] }
 *
 * Key fields:
 *   showId, name, fromDate (ISO|null), minPrice, isSoldOut,
 *   mobileImage (UUID.jpeg), slug, tags (JSON-serialized string),
 *   venues[0].name, venues[0].eventInfos[0].eventDate
 */
export class TktGeAdapter implements EventSourceAdapter {
  readonly sourceName = 'tkt.ge';
  private readonly logger = new Logger(TktGeAdapter.name);

  async fetch(): Promise<NormalizedEvent[]> {
    const all: NormalizedEvent[] = [];

    for (const cat of CATEGORIES) {
      try {
        const events = await this.fetchCategory(cat.id, cat.category, cat.tags);
        all.push(...events);
        this.logger.log(`tkt.ge/cat${cat.id}: ${events.length} events`);
      } catch (err: any) {
        this.logger.warn(`tkt.ge/cat${cat.id} failed: ${err?.message}`);
      }
    }

    this.logger.log(`tkt.ge total: ${all.length} upcoming events`);
    return all;
  }

  private async fetchCategory(
    categoryId: number,
    category: string,
    baseTags: string[],
  ): Promise<NormalizedEvent[]> {
    const url = `${GATEWAY_URL}/Shows/List?categoryId=${categoryId}&api_key=${API_KEY}`;
    const response = await globalThis.fetch(url, {
      headers: {
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
      },
    });

    if (!response.ok) {
      throw new Error(`tkt.ge HTTP ${response.status} for categoryId=${categoryId}`);
    }

    const data = await response.json();
    return this.parseShows(data.shows ?? [], category, baseTags);
  }

  private parseShows(
    shows: any[],
    category: string,
    baseTags: string[],
  ): NormalizedEvent[] {
    const now = new Date();
    const events: NormalizedEvent[] = [];

    for (const show of shows) {
      if (show.isSoldOut) continue;

      // Date: fromDate preferred, fallback to first venue eventInfo date
      const rawDate =
        show.fromDate ??
        show.venues?.[0]?.eventInfos?.[0]?.eventDate ??
        null;

      if (!rawDate) continue;

      const startsAt = new Date(rawDate);
      if (isNaN(startsAt.getTime()) || startsAt <= now) continue;

      const title = (show.name ?? '').trim();
      if (!title) continue;

      const venue = show.venues?.[0]?.name ?? '';
      const slug = show.slug ?? String(show.showId);

      events.push({
        title,
        titleEn: title,
        startsAt,
        venueName: venue || 'Tbilisi',
        category,
        tags: this.enrichTags(baseTags, title, show.tags),
        priceMin: show.minPrice ?? undefined,
        currency: 'GEL',
        ticketUrl: `${BASE_URL}/en/show/${show.showId}/${slug}`,
        posterUrl: show.mobileImage
          ? `${IMAGE_CDN}/${show.mobileImage}`
          : undefined,
        source: this.sourceName,
        sourceEventId: `tkt-${show.showId}`,
      });
    }

    return events;
  }

  /**
   * Enrich tags using title keywords.
   * tkt.ge `tags` field is a JSON-serialized string[] of title words + city names —
   * not useful for category mapping, only used for Batumi detection.
   */
  private enrichTags(base: string[], title: string, rawTagsStr: string): string[] {
    const tags = [...base];
    const t = title.toLowerCase();

    if (/jazz/.test(t))                      tags.push('culture');
    if (/festival|ფესტ/.test(t))             tags.push('festival', 'entertainment');
    if (/night|party|dj\s|disco/.test(t))    tags.push('nightlife');
    if (/club|კლუბი/.test(t))               tags.push('nightlife');
    if (/kid|child|bav|ბავ/.test(t))        tags.push('family');
    if (/stand.?up|comedy|კომედ/.test(t))   tags.push('entertainment');
    if (/theater|theatre|თეატ/.test(t))     tags.push('culture', 'theater');
    if (/ballet|opera|ოპ/.test(t))          tags.push('culture', 'theater');
    if (/exhibit|გამოფ/.test(t))            tags.push('culture', 'exhibition');
    if (/hike|trek|походи|ლაშქ/.test(t))   tags.push('outdoor');

    return [...new Set(tags)].slice(0, 6);
  }
}
