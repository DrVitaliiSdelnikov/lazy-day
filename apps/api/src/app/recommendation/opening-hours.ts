/**
 * Lightweight OSM opening_hours parser.
 * Covers ~95% of real data in our DB: 24/7, simple ranges, day prefixes,
 * semicolon-separated rules, comma-separated time ranges, overnight spans.
 *
 * Full OSM opening_hours spec is very complex (PH, week numbers, etc.)
 * — this parser handles common patterns and returns 'unknown' for the rest.
 */

const DAY_MAP: Record<string, number> = {
  Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0,
};

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface TimeRange {
  openMin: number;  // minutes from midnight (e.g. 600 = 10:00)
  closeMin: number; // can be > 1440 for overnight (e.g. 1560 = 02:00 next day)
}

interface DayRule {
  days: number[];       // 0=Su, 1=Mo, ..., 6=Sa
  ranges: TimeRange[];
}

/**
 * Check if a venue is open at the given date/time.
 * Returns: 'open' | 'closed' | 'unknown'
 */
export function checkOpenStatus(
  openingHours: { raw?: string } | null | undefined,
  at: Date,
): 'open' | 'closed' | 'unknown' {
  if (!openingHours?.raw) return 'unknown';

  const raw = openingHours.raw.trim();
  if (raw === '24/7') return 'open';
  if (raw.toLowerCase() === 'closed' || raw.toLowerCase() === 'off') return 'closed';

  const rules = parseRules(raw);
  if (rules.length === 0) return 'unknown';

  const dayOfWeek = at.getDay(); // 0=Su
  const minuteOfDay = at.getHours() * 60 + at.getMinutes();

  // Check rules for current day
  for (const rule of rules) {
    if (!rule.days.includes(dayOfWeek)) continue;
    for (const range of rule.ranges) {
      if (range.closeMin > 1440) {
        // Overnight: open from openMin today until closeMin-1440 tomorrow
        if (minuteOfDay >= range.openMin) return 'open';
      } else {
        if (minuteOfDay >= range.openMin && minuteOfDay < range.closeMin) return 'open';
      }
    }
  }

  // Check if we're in the overnight portion of yesterday's rule
  const yesterday = (dayOfWeek + 6) % 7;
  for (const rule of rules) {
    if (!rule.days.includes(yesterday)) continue;
    for (const range of rule.ranges) {
      if (range.closeMin > 1440) {
        const overnightEnd = range.closeMin - 1440;
        if (minuteOfDay < overnightEnd) return 'open';
      }
    }
  }

  // We found rules for this day but no range matched → closed
  const hasRuleForToday = rules.some((r) => r.days.includes(dayOfWeek));
  const hasRuleForYesterday = rules.some((r) => r.days.includes(yesterday));
  if (hasRuleForToday || hasRuleForYesterday) return 'closed';

  return 'unknown';
}

/**
 * Get a human-readable open status label.
 */
export function getOpenLabel(
  status: 'open' | 'closed' | 'unknown',
  locale: string,
): string | undefined {
  if (status === 'unknown') return undefined;
  if (locale === 'ru') return status === 'open' ? 'Открыто' : 'Закрыто';
  if (locale === 'ka') return status === 'open' ? 'ღიაა' : 'დახურულია';
  return status === 'open' ? 'Open' : 'Closed';
}

// ---------------------------------------------------------------------------
// Parser internals
// ---------------------------------------------------------------------------

function parseRules(raw: string): DayRule[] {
  // Split by semicolons: "Mo-Fr 09:00-22:00; Sa-Su 10:00-22:00"
  const parts = raw.split(';').map((s) => s.trim()).filter(Boolean);
  const rules: DayRule[] = [];

  for (const part of parts) {
    const rule = parseOneRule(part);
    if (rule) rules.push(rule);
  }

  return rules;
}

function parseOneRule(part: string): DayRule | null {
  // Patterns:
  // "10:00-22:00"                    → all days
  // "Mo-Su 10:00-22:00"             → day range + time
  // "Mo-Fr 09:00-14:00,16:00-21:00" → day range + multiple time ranges
  // "Tu-Su 10:00-18:00"             → specific day range
  // "PH off" / "PH -1 day ..." → skip (public holidays)

  if (part.includes('PH')) return null;

  // Try to split into day-part and time-part
  const dayTimeMatch = part.match(/^([A-Za-z, -]+)\s+(.+)$/);

  let days: number[];
  let timeStr: string;

  if (dayTimeMatch) {
    days = parseDays(dayTimeMatch[1]);
    timeStr = dayTimeMatch[2];
    if (days.length === 0) return null;
  } else {
    // No day prefix → assume all days
    days = [0, 1, 2, 3, 4, 5, 6];
    timeStr = part;
  }

  const ranges = parseTimeRanges(timeStr);
  if (ranges.length === 0) return null;

  return { days, ranges };
}

function parseDays(dayStr: string): number[] {
  const days: number[] = [];

  // Handle comma-separated: "Mo,We,Fr"
  const segments = dayStr.split(',').map((s) => s.trim());

  for (const seg of segments) {
    // Range: "Mo-Fr"
    const rangeMatch = seg.match(/^(\w{2})-(\w{2})$/);
    if (rangeMatch) {
      const start = DAY_MAP[rangeMatch[1]];
      const end = DAY_MAP[rangeMatch[2]];
      if (start == null || end == null) return [];
      // Expand range (handles Mo-Su wrapping)
      let d = start;
      for (let i = 0; i < 7; i++) {
        days.push(d);
        if (d === end) break;
        d = (d + 1) % 7;
      }
    } else {
      // Single day: "Mo"
      const d = DAY_MAP[seg];
      if (d != null) days.push(d);
    }
  }

  return [...new Set(days)];
}

function parseTimeRanges(timeStr: string): TimeRange[] {
  // "09:00-22:00" or "09:00-14:00,16:00-21:00"
  const parts = timeStr.split(',').map((s) => s.trim());
  const ranges: TimeRange[] = [];

  for (const part of parts) {
    const match = part.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!match) continue;

    const openMin = parseInt(match[1]) * 60 + parseInt(match[2]);
    let closeMin = parseInt(match[3]) * 60 + parseInt(match[4]);

    // Handle overnight: "18:00-02:00" → closeMin = 26*60 = 1560
    if (closeMin <= openMin) {
      closeMin += 1440;
    }
    // Handle "24:00" or "00:00" as end-of-day
    if (closeMin === openMin && closeMin === 0) {
      closeMin = 1440;
    }

    ranges.push({ openMin, closeMin });
  }

  return ranges;
}
