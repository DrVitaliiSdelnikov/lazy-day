import { Logger } from '@nestjs/common';
import { EventSourceAdapter, NormalizedEvent } from './types';

const PLAYBILL_URL = 'https://opera.ge/eng/playbill';
const VENUE_NAME = 'Tbilisi Opera and Ballet State Theatre';

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parser for opera.ge playbill page.
 *
 * HTML structure (after stripping tags):
 *   2025/2026 active        ← current season marker
 *   Opera                   ← type (Opera / Ballet)
 *   13                      ← day
 *   Sep /                   ← month abbreviation
 *   Sat                     ← weekday
 *   Abesalom and Eteri      ← title
 *   19:00                   ← time
 *   MORE INFO               ← skip
 *   TICKETS                 ← skip
 */
export class OperaGeAdapter implements EventSourceAdapter {
  readonly sourceName = 'opera.ge';
  private readonly logger = new Logger(OperaGeAdapter.name);

  async fetch(): Promise<NormalizedEvent[]> {
    const response = await globalThis.fetch(PLAYBILL_URL, {
      headers: { 'User-Agent': 'LazyDay/1.0 (leisure discovery app)' },
    });

    if (!response.ok) {
      throw new Error(`opera.ge ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parse(html);
  }

  private parse(html: string): NormalizedEvent[] {
    // Find current season year from HTML class attributes (e.g., "2025/2026 active")
    const seasonMatch = html.match(/(\d{4})\/(\d{4})[^"]*active/);
    const seasonStartYear = seasonMatch ? parseInt(seasonMatch[1]) : new Date().getFullYear() - 1;
    const seasonMarker = `${seasonStartYear}/${seasonStartYear + 1}`;

    // Strip HTML tags, get clean lines
    const clean = html.replace(/<[^>]+>/g, '\n');
    const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

    // Start from beginning — we filter by date (skip past events)
    const startIdx = 0;

    const events: NormalizedEvent[] = [];
    const now = new Date();
    let currentType = 'Opera';

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];

      // Track category (Opera / Ballet)
      if (line === 'Opera' || line === 'Ballet') {
        currentType = line;
        continue;
      }

      // Skip season headers
      if (/^\d{4}\/\d{4}$/.test(line)) continue;

      // Look for day number (1-31)
      if (/^\d{1,2}$/.test(line)) {
        const day = parseInt(line);
        if (day < 1 || day > 31) continue;

        // Next line should be "Mon /" or "Sep /" etc
        const monthLine = lines[i + 1];
        if (!monthLine) continue;

        const monthMatch = monthLine.match(/^(\w{3})\s*\//i);
        if (!monthMatch) continue;

        const month = MONTH_MAP[monthMatch[1].toLowerCase()];
        if (month === undefined) continue;

        // Skip weekday line
        // Next should be title
        let titleIdx = i + 3;
        // Sometimes there's a weekday line (Sat, Sun, etc)
        if (lines[i + 2] && /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i.test(lines[i + 2])) {
          titleIdx = i + 3;
        } else {
          titleIdx = i + 2;
        }

        const title = lines[titleIdx];
        if (!title || title === 'MORE INFO' || title === 'TICKETS' || /^\d{1,2}:\d{2}$/.test(title)) continue;

        // Find time - look ahead for HH:MM pattern
        let time = '19:00';
        for (let j = titleIdx + 1; j < titleIdx + 5 && j < lines.length; j++) {
          if (/^\d{1,2}:\d{2}$/.test(lines[j])) {
            time = lines[j];
            break;
          }
        }

        // Determine year
        let year: number;
        if (month >= 8) {
          year = seasonStartYear; // Sep-Dec = first year of season
        } else {
          year = seasonStartYear + 1; // Jan-Jul = second year of season
        }

        const [hours, minutes] = time.split(':').map(Number);
        const startsAt = new Date(year, month, day, hours, minutes);

        // Skip past events
        if (startsAt < now) continue;

        const endsAt = new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

        const isBalletType = currentType === 'Ballet' || /ballet/i.test(title);
        const tags = isBalletType
          ? ['culture', 'theater', 'ballet']
          : ['culture', 'theater', 'opera'];

        // Find playbillinner ID near this position in original HTML
        const titlePos = html.indexOf(title, Math.max(0, html.indexOf(`>${day}<`) - 500));
        const idMatch = html.slice(Math.max(0, titlePos - 500), titlePos + 200)
          .match(/playbillinner\/(\d+)/);
        const eventId = idMatch ? idMatch[1] : `${day}-${month}-${year}`;

        events.push({
          title,
          titleEn: title,
          startsAt,
          endsAt,
          venueName: VENUE_NAME,
          category: 'theater',
          tags,
          ticketUrl: idMatch
            ? `https://opera.ge/eng/playbillinner/${idMatch[1]}/cast`
            : undefined,
          source: this.sourceName,
          sourceEventId: `opera-${eventId}-${year}${String(month + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`,
          currency: 'GEL',
        });
      }
    }

    this.logger.log(`Parsed ${events.length} upcoming events from opera.ge (season ${seasonMarker})`);
    return events;
  }
}
