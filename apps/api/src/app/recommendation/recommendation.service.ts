import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DiscoverRequestDto } from './dto/discover-request.dto';

const WEIGHTS = {
  interestMatch: 0.45,
  distanceDecay: 0.25,
  timeFit: 0.15,
  cardQuality: 0.10,
  sourceConfidence: 0.05,
};

const WALK_SPEED_M_PER_MIN = 80;
const STREET_CURVE_FACTOR = 1.3;

/** Minimum relevant results before adaptive radius expansion kicks in. */
const MIN_RELEVANT_RESULTS = 5;
/** Maximum radius expansion attempts (each multiplies by 1.5). */
const MAX_RADIUS_EXPANSIONS = 2;

/**
 * Maps user-facing interest names to DB tag vocabulary.
 * User sends "nature" -> we match against [outdoor, park, garden, viewpoint].
 * See docs/scoring.md and docs/data-quality.md for details.
 */
const INTEREST_SYNONYMS: Record<string, string[]> = {
  nature: ['outdoor', 'park', 'garden', 'viewpoint'],
  spa: ['bath', 'swimming'],
  bath: ['bath'],
  food: ['food', 'restaurant', 'cafe', 'bakery'],
  nightlife: ['nightlife', 'bar', 'club'],
  culture: ['culture', 'museum', 'gallery', 'theater'],
  sports: ['gym', 'sports'],
  shopping: ['shopping', 'mall'],
  entertainment: ['entertainment', 'cinema', 'club'],
  family: ['family', 'playground', 'park'],
};

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
  status?: string;
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

/** Candidate enriched with dynamic category classification. */
interface ScoredCandidate extends CandidateRow {
  score: number;
  interestScore: number;
  /** Tags that matched user interests — these are why the venue is relevant. */
  primaryTags: string[];
  /** Tags that did NOT match — secondary traits of the venue. */
  secondaryTags: string[];
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async discover(dto: DiscoverRequestDto) {
    const baseRadiusM = dto.radiusM ?? 5000;
    const hiddenIds = dto.hiddenIds ?? [];
    const interests = dto.profile.interests;
    const hasInterests = interests && Object.keys(interests).length > 0;

    // Build expanded interest->tag map once for the entire request
    const expandedWeights = hasInterests
      ? this.buildExpandedWeights(interests)
      : new Map<string, number>();

    // Adaptive radius: expand if too few relevant results
    let radiusM = baseRadiusM;
    let scored: ScoredCandidate[] = [];

    for (let attempt = 0; attempt <= MAX_RADIUS_EXPANSIONS; attempt++) {
      const [places, events] = await Promise.all([
        this.fetchPlaces(dto.lat, dto.lng, radiusM),
        this.fetchEvents(dto.lat, dto.lng, radiusM, dto.timeWindow),
      ]);

      let candidates: CandidateRow[] = [...places, ...events];

      // Hard filters (hidden, budget)
      candidates = candidates.filter((c) => {
        if (hiddenIds.includes(c.id)) return false;
        if (dto.profile.budgetMax != null) {
          if (c.price_min != null && c.price_min > dto.profile.budgetMax) return false;
          if (c.price_level != null && c.price_level > this.budgetToLevel(dto.profile.budgetMax)) return false;
        }
        return true;
      });

      // Score + classify primary/secondary tags
      scored = candidates.map((c) => this.scoreCandidate(c, dto, radiusM, expandedWeights));

      // Interest hard filter: keep only candidates with at least one primary tag
      if (hasInterests) {
        scored = scored.filter((c) => c.primaryTags.length > 0);
      }

      // Enough results? Stop expanding.
      if (scored.length >= MIN_RELEVANT_RESULTS || !hasInterests) break;

      // Expand radius for next attempt
      radiusM = Math.round(radiusM * 1.5);
      this.logger.log(`Adaptive fill: only ${scored.length} relevant results, expanding radius to ${radiusM}m`);
    }

    // Sort + diversity
    scored.sort((a, b) => b.score - a.score);
    const diversified = this.applyDiversity(scored);

    // Build response cards
    const cards = diversified.slice(0, 30).map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      category: c.category,
      lat: c.lat,
      lng: c.lng,
      distanceM: Math.round(c.distance_m),
      walkMinutes: Math.round((c.distance_m / WALK_SPEED_M_PER_MIN) * STREET_CURVE_FACTOR),
      explanations: this.generateExplanations(c, dto, expandedWeights),
      source: 'canonical',
      address: c.address,
      rating: c.rating ? Number(c.rating) : undefined,
      ratingCount: c.rating_count,
      // Dynamic category info for the client
      primaryTags: c.primaryTags.length > 0 ? c.primaryTags : undefined,
      secondaryTags: c.secondaryTags.length > 0 ? c.secondaryTags : undefined,
      startsAt: c.starts_at,
      endsAt: c.ends_at,
      venueName: c.venue_name,
      ticketUrl: c.ticket_url,
      priceLabel: this.formatPrice(c),
      photoUrl: c.photos?.[0],
    }));

    const sessionId = crypto.randomUUID();

    this.logger.log(
      `Discover: ${scored.length} relevant → ${cards.length} cards (radius=${radiusM}m${radiusM !== baseRadiusM ? ', expanded' : ''})`,
    );

    return { sessionId, cards, hasMore: diversified.length > 30 };
  }

  async more(sessionId: string) {
    // TODO: Redis session cache pagination
    return { sessionId, cards: [], hasMore: false };
  }

  // ---------------------------------------------------------------------------
  // Scoring
  // ---------------------------------------------------------------------------

  /**
   * Build expanded tag->weight map from user interests + synonyms.
   * Called once per request, reused for all candidates.
   */
  private buildExpandedWeights(interests: Record<string, number>): Map<string, number> {
    const expanded = new Map<string, number>();
    for (const [interest, weight] of Object.entries(interests)) {
      if (weight <= 0) continue;
      expanded.set(interest, Math.max(expanded.get(interest) ?? 0, weight));
      const synonyms = INTEREST_SYNONYMS[interest];
      if (synonyms) {
        for (const syn of synonyms) {
          expanded.set(syn, Math.max(expanded.get(syn) ?? 0, weight));
        }
      }
    }
    return expanded;
  }

  /**
   * Score a candidate and classify its tags as primary (matching interests)
   * or secondary (not matching).
   *
   * Dynamic classification: the SAME venue can have different primary/secondary
   * tags depending on what the user asked for. A park with a café:
   *   - User asks "nature" → primary: [outdoor, park], secondary: [food, cafe]
   *   - User asks "food"   → primary: [food, cafe],    secondary: [outdoor, park]
   */
  private scoreCandidate(
    c: CandidateRow,
    dto: DiscoverRequestDto,
    radiusM: number,
    expandedWeights: Map<string, number>,
  ): ScoredCandidate {
    const tags = c.tags ?? [];
    const primaryTags: string[] = [];
    const secondaryTags: string[] = [];
    const matchScores: number[] = [];

    for (const tag of tags) {
      const weight = expandedWeights.get(tag);
      if (weight != null && weight > 0) {
        primaryTags.push(tag);
        matchScores.push(weight);
      } else {
        secondaryTags.push(tag);
      }
    }

    // Interest score: average of top 2 matching weights, or 0
    let interestScore: number;
    if (expandedWeights.size === 0) {
      interestScore = 0.5; // no interests specified
    } else if (matchScores.length === 0) {
      interestScore = 0.0;
    } else {
      matchScores.sort((a, b) => b - a);
      interestScore = matchScores.length >= 2
        ? (matchScores[0] + matchScores[1]) / 2
        : matchScores[0];
    }

    const distance = Math.max(0, 1 - c.distance_m / radiusM);
    const time = this.timeFit(c, dto.timeWindow);
    const quality = Number(c.quality_score) || 0.5;
    const source = 0.6;

    const score =
      WEIGHTS.interestMatch * interestScore +
      WEIGHTS.distanceDecay * distance +
      WEIGHTS.timeFit * time +
      WEIGHTS.cardQuality * quality +
      WEIGHTS.sourceConfidence * source;

    return {
      ...c,
      score,
      interestScore,
      primaryTags,
      secondaryTags,
    };
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

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
        p.quality_score, p.status, p.opening_hours, p.photos, v.website
      FROM places p
      JOIN venues v ON p.venue_id = v.id
      WHERE p.status = 'active'
        AND ST_DWithin(
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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
    return 0.8;
  }

  private applyDiversity(
    scored: ScoredCandidate[],
  ): ScoredCandidate[] {
    if (scored.length <= 3) return scored;

    const result: ScoredCandidate[] = [];
    const chainCount = new Map<string, number>();

    for (const card of scored) {
      if ((card as any).chain_key && result.length < 20) {
        const count = chainCount.get((card as any).chain_key) ?? 0;
        if (count >= 1) continue;
        chainCount.set((card as any).chain_key, count + 1);
      }

      if (result.length >= 2) {
        const prev1 = result[result.length - 1].category;
        const prev2 = result[result.length - 2].category;
        if (prev1 === card.category && prev2 === card.category) {
          continue;
        }
      }

      result.push(card);
    }

    return result;
  }

  private generateExplanations(
    c: ScoredCandidate,
    dto: DiscoverRequestDto,
    expandedWeights: Map<string, number>,
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

    // Walk time
    if (c.distance_m <= 2000) {
      const walkMin = Math.round((c.distance_m / WALK_SPEED_M_PER_MIN) * STREET_CURVE_FACTOR);
      explanations.push({ type: 'walk_time', label: `${walkMin} мин пешком`, priority: 2 });
    }

    // Price
    if (c.price_level === 0 || (c.price_min != null && c.price_min === 0)) {
      explanations.push({ type: 'free', label: 'Бесплатно', priority: 3 });
    } else if (dto.profile.budgetMax != null && c.price_min != null && c.price_min <= dto.profile.budgetMax) {
      explanations.push({ type: 'budget_fit', label: 'В бюджете', priority: 3 });
    }

    // Interest match — use primary tags for meaningful explanation
    if (c.primaryTags.length > 0) {
      // Find the user-facing interest name that caused the match
      const interests = dto.profile.interests ?? {};
      const matchedInterest = Object.keys(interests).find((interest) => {
        const synonyms = INTEREST_SYNONYMS[interest] ?? [interest];
        return c.primaryTags.some((t) => synonyms.includes(t) || t === interest);
      });
      if (matchedInterest) {
        explanations.push({
          type: 'matches_interest',
          label: `Тебе нравится: ${matchedInterest}`,
          priority: 4,
        });
      }
    }

    // Secondary tags hint — "also has: café"
    if (c.secondaryTags.length > 0 && c.primaryTags.length > 0) {
      const humanReadable = c.secondaryTags
        .filter((t) => ['food', 'cafe', 'restaurant', 'bar', 'bath', 'swimming', 'gym'].includes(t))
        .slice(0, 1);
      if (humanReadable.length > 0) {
        explanations.push({
          type: 'also_has',
          label: `Также: ${humanReadable[0]}`,
          priority: 6,
        });
      }
    }

    // Quality
    if (c.rating && Number(c.rating) >= 4.5) {
      explanations.push({ type: 'highly_rated', label: 'Высокий рейтинг', priority: 5 });
    }

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
