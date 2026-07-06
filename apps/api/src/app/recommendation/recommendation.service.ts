import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DiscoverRequestDto } from './dto/discover-request.dto';

const WEIGHTS = {
  interestMatch: 0.35,
  distanceDecay: 0.25,
  timeFit: 0.20,
  cardQuality: 0.10,
  sourceConfidence: 0.05,
  noveltyPenalty: 0.05,
};

const WALK_SPEED_M_PER_MIN = 80;
const STREET_CURVE_FACTOR = 1.3;
const RANKING_VERSION = 'v1.0';

interface CandidateRow {
  id: string;
  type: 'place' | 'event';
  title: string;
  category: string;
  tags: string[];
  lat: number;
  lng: number;
  distance_m: number;
  address?: string;
  rating?: number;
  rating_count?: number;
  indoor?: boolean;
  price_level?: number;
  quality_score: number;
  opening_hours?: Record<string, unknown>;
  photos?: string[];
  website?: string;
  // event-specific
  starts_at?: string;
  ends_at?: string;
  venue_name?: string;
  ticket_url?: string;
  price_min?: number;
  price_max?: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async discover(dto: DiscoverRequestDto) {
    const radiusM = dto.radiusM ?? 5000;
    const hiddenIds = dto.hiddenIds ?? [];

    // 1. Candidate retrieval via PostGIS
    const [places, events] = await Promise.all([
      this.fetchPlaces(dto.lat, dto.lng, radiusM),
      this.fetchEvents(dto.lat, dto.lng, radiusM, dto.timeWindow),
    ]);

    // 2. Merge candidates
    let candidates: CandidateRow[] = [...places, ...events];

    // 3. Hard filters
    candidates = candidates.filter((c) => {
      if (hiddenIds.includes(c.id)) return false;
      if (dto.profile.budgetMax != null) {
        if (c.price_min != null && c.price_min > dto.profile.budgetMax) return false;
        if (c.price_level != null && c.price_level > this.budgetToLevel(dto.profile.budgetMax)) return false;
      }
      return true;
    });

    // 4. Score
    const scored = candidates.map((c) => ({
      ...c,
      score: this.score(c, dto, radiusM),
    }));

    // 5. Sort + diversity
    scored.sort((a, b) => b.score - a.score);
    const diversified = this.applyDiversity(scored);

    // 6. Explanations
    const cards = diversified.slice(0, 30).map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      category: c.category,
      lat: c.lat,
      lng: c.lng,
      distanceM: Math.round(c.distance_m),
      walkMinutes: Math.round((c.distance_m / WALK_SPEED_M_PER_MIN) * STREET_CURVE_FACTOR),
      explanations: this.generateExplanations(c, dto),
      source: 'canonical',
      address: c.address,
      rating: c.rating ? Number(c.rating) : undefined,
      ratingCount: c.rating_count,
      startsAt: c.starts_at,
      endsAt: c.ends_at,
      venueName: c.venue_name,
      ticketUrl: c.ticket_url,
      priceLabel: this.formatPrice(c),
      openStatus: c.opening_hours ? undefined : undefined, // TODO: parse opening_hours
      photoUrl: c.photos?.[0],
    }));

    const sessionId = crypto.randomUUID();

    this.logger.log(
      `Discover: ${candidates.length} candidates → ${cards.length} cards (radius=${radiusM}m)`,
    );

    return { sessionId, cards, hasMore: diversified.length > 30 };
  }

  async more(sessionId: string) {
    // TODO: Redis session cache pagination
    return { sessionId, cards: [], hasMore: false };
  }

  private async fetchPlaces(lat: number, lng: number, radiusM: number): Promise<CandidateRow[]> {
    const rows = await this.dataSource.query(
      `SELECT
        p.id, 'place' AS type, v.name AS title, p.category, p.tags,
        v.lat, v.lng,
        ST_Distance(
          ST_MakePoint(v.lng, v.lat)::geography,
          ST_MakePoint($2, $1)::geography
        ) AS distance_m,
        v.address, p.rating, p.rating_count, p.indoor, p.price_level,
        p.quality_score, p.opening_hours, p.photos, v.website
      FROM places p
      JOIN venues v ON p.venue_id = v.id
      WHERE ST_DWithin(
        ST_MakePoint(v.lng, v.lat)::geography,
        ST_MakePoint($2, $1)::geography,
        $3
      )
      ORDER BY distance_m
      LIMIT 200`,
      [lat, lng, radiusM],
    );
    return rows;
  }

  private async fetchEvents(
    lat: number,
    lng: number,
    radiusM: number,
    timeWindow: { from: string; to: string },
  ): Promise<CandidateRow[]> {
    const rows = await this.dataSource.query(
      `SELECT
        e.id, 'event' AS type, e.title, e.category, e.tags,
        v.lat, v.lng,
        ST_Distance(
          ST_MakePoint(v.lng, v.lat)::geography,
          ST_MakePoint($2, $1)::geography
        ) AS distance_m,
        v.address, v.name AS venue_name,
        e.starts_at, e.ends_at, e.ticket_url,
        e.price_min, e.price_max, e.quality_score
      FROM events e
      JOIN venues v ON e.venue_id = v.id
      WHERE e.status = 'scheduled'
        AND e.starts_at BETWEEN $4 AND $5
        AND ST_DWithin(
          ST_MakePoint(v.lng, v.lat)::geography,
          ST_MakePoint($2, $1)::geography,
          $3
        )
      ORDER BY e.starts_at
      LIMIT 100`,
      [lat, lng, radiusM, timeWindow.from, timeWindow.to],
    );
    return rows;
  }

  private score(c: CandidateRow, dto: DiscoverRequestDto, radiusM: number): number {
    const interest = this.interestMatch(c, dto.profile.interests);
    const distance = Math.max(0, 1 - c.distance_m / radiusM);
    const time = this.timeFit(c, dto.timeWindow);
    const quality = Number(c.quality_score) || 0.5;
    const source = 0.6; // OSM default

    return (
      WEIGHTS.interestMatch * interest +
      WEIGHTS.distanceDecay * distance +
      WEIGHTS.timeFit * time +
      WEIGHTS.cardQuality * quality +
      WEIGHTS.sourceConfidence * source
    );
  }

  private interestMatch(c: CandidateRow, interests: Record<string, number>): number {
    if (!interests || Object.keys(interests).length === 0) return 0.5;

    const tags = c.tags ?? [];
    const matches = tags
      .map((t) => interests[t] ?? 0)
      .filter((w) => w > 0);

    if (matches.length === 0) return 0.1; // serendipity floor
    matches.sort((a, b) => b - a);
    return matches.length >= 2
      ? (matches[0] + matches[1]) / 2
      : matches[0];
  }

  private timeFit(c: CandidateRow, timeWindow: { from: string; to: string }): number {
    if (c.type === 'event' && c.starts_at) {
      const start = new Date(c.starts_at).getTime();
      const from = new Date(timeWindow.from).getTime();
      const to = new Date(timeWindow.to).getTime();
      const mid = (from + to) / 2;
      if (start <= mid) return 1.0;
      if (start <= to) return 0.7;
      return 0.3;
    }
    // Places: assume open for now (TODO: parse opening_hours)
    return 0.8;
  }

  private applyDiversity(
    scored: (CandidateRow & { score: number })[],
  ): (CandidateRow & { score: number })[] {
    if (scored.length <= 3) return scored;

    const result: (CandidateRow & { score: number })[] = [];
    const used = new Set<string>();
    const chainCount = new Map<string, number>();

    for (const card of scored) {
      // Chain cap: ≤1 per chain in top 20
      if ((card as any).chain_key && result.length < 20) {
        const count = chainCount.get((card as any).chain_key) ?? 0;
        if (count >= 1) continue;
        chainCount.set((card as any).chain_key, count + 1);
      }

      // Category spread: ≤2 same category consecutive
      if (result.length >= 2) {
        const prev1 = result[result.length - 1].category;
        const prev2 = result[result.length - 2].category;
        if (prev1 === card.category && prev2 === card.category) {
          // defer — add at end
          continue;
        }
      }

      result.push(card);
    }

    return result;
  }

  private generateExplanations(
    c: CandidateRow & { score: number },
    dto: DiscoverRequestDto,
  ): { type: string; label: string }[] {
    const explanations: { type: string; label: string; priority: number }[] = [];

    // Time-sensitive (highest priority)
    if (c.type === 'event' && c.starts_at) {
      const minutesUntil = (new Date(c.starts_at).getTime() - Date.now()) / 60000;
      if (minutesUntil > 0 && minutesUntil <= 120) {
        explanations.push({
          type: 'starts_in',
          label: `Начало через ${Math.round(minutesUntil)} мин`,
          priority: 1,
        });
      }
    }

    // Context
    if (c.distance_m <= 2000) {
      const walkMin = Math.round((c.distance_m / WALK_SPEED_M_PER_MIN) * STREET_CURVE_FACTOR);
      explanations.push({ type: 'walk_time', label: `${walkMin} мин пешком`, priority: 2 });
    }

    // Relevance
    if (c.price_level === 0 || (c.price_min != null && c.price_min === 0)) {
      explanations.push({ type: 'free', label: 'Бесплатно', priority: 3 });
    } else if (dto.profile.budgetMax != null && c.price_min != null && c.price_min <= dto.profile.budgetMax) {
      explanations.push({ type: 'budget_fit', label: 'В бюджете', priority: 3 });
    }

    const tags = c.tags ?? [];
    const interests = dto.profile.interests ?? {};
    const matchedTag = tags.find((t) => (interests[t] ?? 0) > 0.3);
    if (matchedTag) {
      explanations.push({
        type: 'matches_interest',
        label: `Тебе нравится: ${matchedTag}`,
        priority: 4,
      });
    }

    // Quality
    if (c.rating && Number(c.rating) >= 4.5) {
      explanations.push({ type: 'highly_rated', label: 'Высокий рейтинг', priority: 5 });
    }

    // Sort by priority, take top 3
    explanations.sort((a, b) => a.priority - b.priority);
    return explanations.slice(0, 3).map(({ type, label }) => ({ type, label }));
  }

  private budgetToLevel(budgetMax: number): number {
    if (budgetMax <= 10) return 1;
    if (budgetMax <= 30) return 2;
    if (budgetMax <= 60) return 3;
    return 4;
  }

  private formatPrice(c: CandidateRow): string | undefined {
    if (c.price_min != null) {
      if (c.price_min === 0) return 'Бесплатно';
      if (c.price_max != null && c.price_max !== c.price_min) {
        return `${c.price_min}–${c.price_max} GEL`;
      }
      return `${c.price_min} GEL`;
    }
    if (c.price_level != null) {
      return ['Бесплатно', '$', '$$', '$$$', '$$$$'][c.price_level] ?? undefined;
    }
    return undefined;
  }
}
