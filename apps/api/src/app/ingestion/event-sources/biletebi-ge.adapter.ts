import { Logger } from '@nestjs/common';
import { EventSourceAdapter, NormalizedEvent } from './types';

const BASE_URL = 'https://biletebi.ge';
const GOOGLEBOT_UA = 'Googlebot/2.1 (+http://www.google.com/bot.html)';

// Categories to scrape → LazyDay category mapping.
// Only categories that include event dates in the listing page.
// museum/sport/tourism/education show no dates in listing — skipped (need per-event fetches).
const CATEGORIES: Array<{ slug: string; category: string; tags: string[] }> = [
  { slug: 'concerts', category: 'music',   tags: ['music', 'concert'] },
  { slug: 'theatres', category: 'theater', tags: ['culture', 'theater'] },
];

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parser for biletebi.ge — Georgian ticketing platform.
 *
 * Biletebi.ge (Next.js App Router) renders full HTML for Googlebot/crawlers.
 * Data is in data-testid attributes: event_card_{title|date|location|price}_{type}_{slug}
 *
 * Date format in HTML: "Wed, 15 Jul, 22:00" (no year — inferred from context)
 * robots.txt: scanning allowed, AI training blocked — we only read event listings.
 */
export class BiletebiGeAdapter implements EventSourceAdapter {
  readonly sourceName = 'biletebi.ge';
  private readonly logger = new Logger(BiletebiGeAdapter.name);

  async fetch(): Promise<NormalizedEvent[]> {
    const all: NormalizedEvent[] = [];

    for (const cat of CATEGORIES) {
      try {
        const events = await this.fetchCategory(cat.slug, cat.category, cat.tags);
        all.push(...events);
        this.logger.log(`biletebi.ge/${cat.slug}: ${events.length} events`);
      } catch (err: any) {
        this.logger.warn(`biletebi.ge/${cat.slug} failed: ${err?.message}`);
      }
    }

    this.logger.log(`biletebi.ge total: ${all.length} upcoming events`);
    return all;
  }

  private async fetchCategory(
    categorySlug: string,
    category: string,
    baseTags: string[],
  ): Promise<NormalizedEvent[]> {
    const url = `${BASE_URL}/en/${categorySlug}`;
    const response = await globalThis.fetch(url, {
      headers: { 'User-Agent': GOOGLEBOT_UA },
    });

    if (!response.ok) {
      throw new Error(`biletebi.ge HTTP ${response.status} for ${categorySlug}`);
    }

    const html = await response.text();
    return this.parseCategory(html, categorySlug, category, baseTags);
  }

  private parseCategory(
    html: string,
    categorySlug: string,
    category: string,
    baseTags: string[],
  ): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];
    const now = new Date();

    // Extract all event card title entries: data-testid="event_card_title_{type}_{slug}"
    const titleRe = /data-testid="event_card_title_([^_"]+)_([^"]+)"[^>]*>([^<]+)/g;
    let m: RegExpExecArray | null;

    while ((m = titleRe.exec(html)) !== null) {
      const eventType = m[1]; // Event, EventWithSitting, Stadium, Education
      const slug = m[2];
      const title = this.decodeHtml(m[3].trim());

      if (!title) continue;

      // Date: data-testid="event_card_date_{type}_{slug}">...<div ...>Wed, 15 Jul, 22:00</div>
      const dateRaw = this.extractDateText(html, eventType, slug);
      if (!dateRaw) continue;

      const startsAt = this.parseDate(dateRaw, now);
      if (!startsAt || startsAt < now) continue;

      // Location: data-testid="event_card_location_{type}_{slug}" ...>{venue}</
      const venue = this.extractTextAfterTestId(html, `event_card_location_${eventType}_${slug}`);

      // Price: data-testid="event_card_price_{type}_{slug}">...<span>{price} ₾</span>
      const price = this.extractPrice(html, eventType, slug);

      // Poster: alt="event  - {title}" src="..."
      const posterUrl = this.extractPoster(html, title);

      const ticketUrl = `${BASE_URL}/en/${categorySlug}/${slug}`;
      const sourceEventId = `biletebi-${categorySlug}-${slug}`;

      events.push({
        title,
        titleEn: title,
        startsAt,
        venueName: this.decodeHtml(venue) || 'Tbilisi',
        category,
        tags: this.enrichTags(baseTags, title, eventType, categorySlug),
        priceMin: price,
        currency: 'GEL',
        ticketUrl,
        posterUrl,
        source: this.sourceName,
        sourceEventId,
      });
    }

    return events;
  }

  /**
   * Extract date text from data-testid="event_card_date_{type}_{slug}">...<div ...>DATE</div>
   * The date is in the first plain text div inside the date container.
   */
  private extractDateText(html: string, type: string, slug: string): string | null {
    const testId = `event_card_date_${type}_${slug}`;
    const idx = html.indexOf(`data-testid="${testId}"`);
    if (idx === -1) return null;

    // Look for text matching "Wed, 15 Jul, 22:00" within next 300 chars
    const slice = html.slice(idx, idx + 400);
    const dateMatch = slice.match(/>\s*([A-Za-z]{3},\s*\d{1,2}\s+[A-Za-z]{3},\s*\d{2}:\d{2})\s*</);
    return dateMatch ? dateMatch[1] : null;
  }

  /**
   * Extract inner text after data-testid="...">{text}<
   */
  private extractTextAfterTestId(html: string, testId: string): string {
    const idx = html.indexOf(`data-testid="${testId}"`);
    if (idx === -1) return '';
    const slice = html.slice(idx, idx + 300);
    const m = slice.match(/>[^<>]{2,80}(?=<)/);
    return m ? m[0].slice(1).trim() : '';
  }

  /**
   * Extract numeric price from event_card_price block.
   * Format: "From </span><span ...><span>20 ₾</span>"
   */
  private extractPrice(html: string, type: string, slug: string): number | undefined {
    const testId = `event_card_price_${type}_${slug}`;
    const idx = html.indexOf(`data-testid="${testId}"`);
    if (idx === -1) return undefined;
    const slice = html.slice(idx, idx + 300);
    const m = slice.match(/>(\d+)\s*[₾₽$€]/);
    return m ? parseInt(m[1]) : undefined;
  }

  /**
   * Extract CDN poster URL: alt="event  - {title}" src="..."
   */
  private extractPoster(html: string, title: string): string | undefined {
    // Try 1: exact title match in alt attribute
    const safeTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 30);
    const re = new RegExp(`alt="event[^"]*${safeTitle}[^"]*"[^>]*src="([^"]+)"`, 'i');
    const m = html.match(re);
    if (m) return m[1];

    // Try 2: find cover image near the event slug in HTML
    const slugRe = new RegExp(`src="(https://static\\.biletebi\\.ge/[^"]*cover[^"]*)"`, 'i');
    const m2 = html.match(slugRe);
    if (m2) return m2[1];

    // Try 3: any static.biletebi.ge image
    const m3 = html.match(/src="(https:\/\/static\.biletebi\.ge\/[^"]+)"/);
    return m3 ? m3[1] : undefined;
  }

  /**
   * Parse "Wed, 15 Jul, 22:00" → Date
   * Year: infer — if date hasn't passed yet this calendar year, use current year; else next year.
   */
  private parseDate(raw: string, now: Date): Date | null {
    // "Wed, 15 Jul, 22:00" or "15 Jul, 22:00"
    const m = raw.match(/(\d{1,2})\s+([A-Za-z]{3}),?\s*(\d{2}):(\d{2})/);
    if (!m) return null;

    const day = parseInt(m[1]);
    const month = MONTH_MAP[m[2].toLowerCase()];
    const hours = parseInt(m[3]);
    const minutes = parseInt(m[4]);

    if (month === undefined) return null;

    const year = now.getFullYear();
    let date = new Date(year, month, day, hours, minutes);

    // If the date has already passed this year, push to next year
    if (date < now) {
      date = new Date(year + 1, month, day, hours, minutes);
    }

    return date;
  }

  /**
   * Enriches event tags with LazyDay interest-compatible bridge tags.
   *
   * Bridge map (biletebi category/title → LazyDay INTEREST_SYNONYMS keys):
   *   music/concert events  → entertainment (concerts are leisure entertainment)
   *   jazz                  → entertainment, culture
   *   theater               → culture, entertainment
   *   night/club/dj/party   → nightlife, entertainment
   *   festival              → entertainment
   *   family/children       → family
   *   stadium/outdoor       → outdoor, entertainment
   *   sports                → sports
   */
  private enrichTags(base: string[], title: string, eventType: string, categorySlug: string): string[] {
    const tags = [...base];
    const t = title.toLowerCase();

    // Category-level bridge
    if (categorySlug === 'concerts') tags.push('entertainment');
    if (categorySlug === 'theatres') tags.push('culture', 'entertainment');
    if (categorySlug === 'sport') tags.push('sports');
    if (categorySlug === 'sabavshvo') tags.push('family');

    // Title-level refinements
    if (/jazz/.test(t)) tags.push('culture');
    if (/concert|კონცერტი/.test(t)) tags.push('concert');
    if (/festival|ფესტ/.test(t)) tags.push('festival');
    if (/night|party|dj\s|disco/.test(t)) tags.push('nightlife');
    if (/club|კლუბი/.test(t)) tags.push('nightlife');
    if (/kid|child|bav|ბავ/.test(t)) tags.push('family');
    if (eventType === 'Stadium') tags.push('outdoor');

    return [...new Set(tags)].slice(0, 6);
  }

  private decodeHtml(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
}
