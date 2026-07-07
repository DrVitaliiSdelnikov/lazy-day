import { Logger } from '@nestjs/common';
import { EventSourceAdapter, NormalizedEvent } from './types';

const YOLO_AJAX_URL = 'https://yolo.ge/en/ajax/posters';

/**
 * Parser for YOLO.ge — Tbilisi experience/event platform.
 * Uses their internal AJAX endpoint which returns HTML cards.
 * robots.txt: Allow: / (fully open).
 */
export class YoloGeAdapter implements EventSourceAdapter {
  readonly sourceName = 'yolo.ge';
  private readonly logger = new Logger(YoloGeAdapter.name);

  async fetch(): Promise<NormalizedEvent[]> {
    const response = await globalThis.fetch(YOLO_AJAX_URL, {
      headers: {
        'User-Agent': 'LazyDay/1.0 (leisure discovery app)',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      throw new Error(`yolo.ge ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const html: string = data.html ?? '';
    const totalItems: number = data.totalItems ?? 0;

    this.logger.log(`YOLO.ge: ${totalItems} total items, parsing HTML...`);
    return this.parse(html);
  }

  private parse(html: string): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];
    const now = new Date();

    // Split into card blocks by the card class
    const cards = html.split(/products-actions__item"/);

    for (const card of cards) {
      if (!card.includes('item_title')) continue;

      // Strip HTML tags → clean lines
      const clean = card.replace(/<[^>]+>/g, '\n');
      const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l && l.length > 1);

      // Extract link from data-js-link attribute
      const linkMatch = card.match(/data-js-link="([^"]+)"/);
      const link = linkMatch ? linkMatch[1] : undefined;

      // Parse lines: [Category, Title, Date, Venue, "from", Price, Currency, ...]
      // Find category, title, date, venue by position
      let category = '';
      let title = '';
      let dateStr = '';
      let venue = '';
      let price: number | undefined;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Date pattern: DD.MM.YYYY or DD.MM.YYYY - DD.MM.YYYY
        if (/^\d{2}\.\d{2}\.\d{4}/.test(line)) {
          dateStr = line;
          // Title is the line before date
          if (i > 0 && !title) title = lines[i - 1];
          // Category is the line before title
          if (i > 1 && !category) category = lines[i - 2];
          // Venue is the line after date
          if (i + 1 < lines.length) venue = lines[i + 1];
          continue;
        }

        // Price: just a number after "from"
        if (/^\d+$/.test(line) && i > 0 && lines[i - 1].includes('from')) {
          price = parseInt(line);
        }
      }

      if (!title || !dateStr) continue;

      // Parse start date
      const startsAt = this.parseDate(dateStr);
      if (!startsAt || startsAt < now) continue;

      // Parse end date (if range)
      let endsAt: Date | undefined;
      const rangeMatch = dateStr.match(/- (\d{2}\.\d{2}\.\d{4})/);
      if (rangeMatch) {
        endsAt = this.parseSingleDate(rangeMatch[1]) ?? undefined;
      }

      // Classify
      const mappedCategory = this.mapCategory(category);
      const tags = this.extractTags(category, title);

      events.push({
        title: this.cleanHtml(title),
        titleEn: this.cleanHtml(title),
        startsAt,
        endsAt,
        venueName: this.cleanHtml(venue) || 'Tbilisi',
        category: mappedCategory,
        tags,
        priceMin: price,
        currency: 'GEL',
        ticketUrl: link,
        source: this.sourceName,
        sourceEventId: `yolo-${this.hashString(title + dateStr)}`,
      });
    }

    this.logger.log(`Parsed ${events.length} upcoming events from YOLO.ge`);
    return events;
  }

  private parseDate(dateStr: string): Date | null {
    // Format: "08.07.2026" or "08.07.2026 - 18.07.2026"
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!match) return null;
    return this.parseSingleDate(`${match[1]}.${match[2]}.${match[3]}`);
  }

  private parseSingleDate(dateStr: string): Date | null {
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!match) return null;
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = parseInt(match[3]);
    return new Date(year, month, day, 10, 0); // default 10:00
  }

  private mapCategory(raw: string): string {
    const lower = raw.toLowerCase();
    if (lower.includes('concert') || lower.includes('music')) return 'music';
    if (lower.includes('theatre') || lower.includes('theater')) return 'theater';
    if (lower.includes('exhibit') || lower.includes('art')) return 'exhibition';
    if (lower.includes('festival')) return 'festival';
    if (lower.includes('sport')) return 'sports';
    if (lower.includes('excursion') || lower.includes('tour')) return 'entertainment';
    if (lower.includes('education') || lower.includes('workshop')) return 'workshop';
    if (lower.includes('gastro') || lower.includes('food') || lower.includes('wine')) return 'market';
    if (lower.includes('kid') || lower.includes('child')) return 'family';
    if (lower.includes('night') || lower.includes('party') || lower.includes('club')) return 'music';
    return 'entertainment';
  }

  private extractTags(category: string, title: string): string[] {
    const text = `${category} ${title}`.toLowerCase();
    const tags: string[] = [];
    if (/concert|music|live/i.test(text)) tags.push('music');
    if (/night|party|club/i.test(text)) tags.push('nightlife');
    if (/tour|excursion|hike/i.test(text)) tags.push('outdoor');
    if (/sport|fitness|climb/i.test(text)) tags.push('sports');
    if (/exhibit|art|gallery/i.test(text)) tags.push('culture', 'exhibition');
    if (/theatre|theater/i.test(text)) tags.push('culture', 'theater');
    if (/food|wine|gastro/i.test(text)) tags.push('food');
    if (/kid|child|family/i.test(text)) tags.push('family');
    if (/workshop|education|class/i.test(text)) tags.push('culture');
    return [...new Set(tags)].slice(0, 5);
  }

  private cleanHtml(s: string): string {
    return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  }

  private hashString(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
