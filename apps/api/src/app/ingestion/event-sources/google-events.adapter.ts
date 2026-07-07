import { Logger } from '@nestjs/common';
import { EventSourceAdapter, NormalizedEvent } from './types';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

/**
 * Google Events adapter via SerpApi.
 * One query per city → dozens of structured events from ALL sources
 * Google indexes (TKT.ge, biletebi.ge, venue sites, etc.).
 *
 * Scales to any city without per-city parser code.
 */
export class GoogleEventsAdapter implements EventSourceAdapter {
  readonly sourceName = 'google_events';
  private readonly logger = new Logger(GoogleEventsAdapter.name);

  constructor(
    private readonly apiKey: string,
    private readonly query: string = 'events in Tbilisi',
    private readonly hl: string = 'en',
  ) {}

  async fetch(): Promise<NormalizedEvent[]> {
    const allEvents: NormalizedEvent[] = [];

    // Fetch multiple queries to broaden coverage
    const queries = [
      this.query,
      this.query.replace('events', 'concerts'),
      this.query.replace('events', 'exhibitions'),
    ];

    for (const q of queries) {
      try {
        const events = await this.fetchQuery(q);
        allEvents.push(...events);
      } catch (err: any) {
        this.logger.warn(`Query "${q}" failed: ${err?.message}`);
      }
      // Rate limit between queries
      await new Promise((r) => setTimeout(r, 500));
    }

    // Dedup by title + date
    const seen = new Set<string>();
    const deduped = allEvents.filter((e) => {
      const key = `${e.title.toLowerCase()}|${e.startsAt.toISOString().slice(0, 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    this.logger.log(`Google Events: ${allEvents.length} raw → ${deduped.length} deduped`);
    return deduped;
  }

  private async fetchQuery(query: string): Promise<NormalizedEvent[]> {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set('engine', 'google_events');
    url.searchParams.set('q', query);
    url.searchParams.set('hl', this.hl);
    url.searchParams.set('api_key', this.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`SerpApi ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const results = data.events_results ?? [];

    return results.map((e: any) => this.normalize(e)).filter(Boolean) as NormalizedEvent[];
  }

  private normalize(e: any): NormalizedEvent | null {
    const title = e.title;
    if (!title) return null;

    const startsAt = this.parseDate(e.date);
    if (!startsAt) return null;

    // Skip past events
    if (startsAt < new Date()) return null;

    const venue = e.venue?.name;
    const address = e.address?.join(', ');
    const ticketLink = e.ticket_info?.[0]?.link;
    const thumbnail = e.thumbnail;

    // Classify category
    const category = this.classifyCategory(title, e.description);
    const tags = this.extractTags(title, e.description, venue);

    return {
      title,
      titleEn: title,
      startsAt,
      venueName: venue ?? address ?? 'Tbilisi',
      venueAddress: address,
      category,
      tags,
      ticketUrl: ticketLink,
      posterUrl: thumbnail,
      source: this.sourceName,
      sourceEventId: `gevt-${this.hashString(title + startsAt.toISOString())}`,
      currency: 'GEL',
    };
  }

  private parseDate(dateObj: any): Date | null {
    if (!dateObj) return null;

    // SerpApi date format: { start_date: "Jul 10", when: "Thu, Jul 10, 8 PM – 11 PM" }
    const when = dateObj.when || '';
    const startDate = dateObj.start_date || '';

    // Try to parse "when" first — more precise
    // Format: "Thu, Jul 10, 8 PM – 11 PM" or "Jul 10, 2026, 8:00 PM"
    const year = new Date().getFullYear();

    // Extract date and time from "when"
    const whenMatch = when.match(/(\w+),?\s+(\w+)\s+(\d+),?\s*(\d+)?\s*(?::(\d+))?\s*(AM|PM)?/i);
    if (whenMatch) {
      const monthStr = whenMatch[2];
      const day = parseInt(whenMatch[3]);
      let hour = parseInt(whenMatch[4] || '19');
      const minute = parseInt(whenMatch[5] || '0');
      const ampm = whenMatch[6];

      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }

      const month = this.parseMonth(monthStr);
      if (month === -1) return null;

      // Determine year
      const now = new Date();
      let eventYear = year;
      const candidate = new Date(eventYear, month, day, hour, minute);
      if (candidate < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
        eventYear++;
      }

      return new Date(eventYear, month, day, hour, minute);
    }

    // Fallback: parse start_date "Jul 10"
    const sdMatch = startDate.match(/(\w+)\s+(\d+)/);
    if (sdMatch) {
      const month = this.parseMonth(sdMatch[1]);
      const day = parseInt(sdMatch[2]);
      if (month === -1) return null;
      return new Date(year, month, day, 20, 0); // default 20:00
    }

    return null;
  }

  private parseMonth(m: string): number {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    return months[m.toLowerCase().slice(0, 3)] ?? -1;
  }

  private classifyCategory(title: string, description?: string): string {
    const text = `${title} ${description || ''}`.toLowerCase();
    if (/concert|live|gig|tour|dj|set|club\s*night|electronic/i.test(text)) return 'music';
    if (/exhibiti|gallery|art\s*show|museum/i.test(text)) return 'exhibition';
    if (/theatre|theater|play|opera|ballet|perform/i.test(text)) return 'theater';
    if (/festival|fest\b/i.test(text)) return 'festival';
    if (/workshop|class|masterclass|seminar|webinar/i.test(text)) return 'workshop';
    if (/comedy|stand.up|improv/i.test(text)) return 'entertainment';
    if (/sport|match|game|tournament|race/i.test(text)) return 'sports';
    if (/market|fair|bazaar/i.test(text)) return 'market';
    if (/kid|child|family/i.test(text)) return 'family';
    return 'entertainment';
  }

  private extractTags(title: string, description?: string, venue?: string): string[] {
    const text = `${title} ${description || ''} ${venue || ''}`.toLowerCase();
    const tags: string[] = [];

    if (/concert|live|music|dj|set|electronic|techno|house/i.test(text)) tags.push('music');
    if (/club|night|party|dance/i.test(text)) tags.push('nightlife');
    if (/exhibiti|gallery|art/i.test(text)) tags.push('culture', 'exhibition');
    if (/theatre|theater|play|opera|ballet/i.test(text)) tags.push('culture', 'theater');
    if (/festival|fest\b/i.test(text)) tags.push('entertainment', 'festival');
    if (/outdoor|park|garden/i.test(text)) tags.push('outdoor');
    if (/food|gastro|wine|dinner/i.test(text)) tags.push('food');
    if (/kid|child|family/i.test(text)) tags.push('family');
    if (/free|бесплатно/i.test(text)) tags.push('free');

    return [...new Set(tags)].slice(0, 5);
  }

  private hashString(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
