import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DiscoverRequestDto } from './dto/discover-request.dto';
import { checkOpenStatus, getOpenLabel } from './opening-hours';

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
  gym: ['gym', 'sports', 'wellness'],
  sports: ['gym', 'sports', 'climbing', 'karting', 'paintball', 'trampoline'],
  shopping: ['shopping', 'mall'],
  entertainment: ['entertainment', 'cinema', 'club', 'bowling', 'escape_room', 'gaming', 'arcade'],
  family: ['family', 'playground', 'park', 'trampoline', 'water_park'],
  active: ['sports', 'climbing', 'karting', 'paintball', 'trampoline', 'gym'],
};

/**
 * Company context modifiers — boost/penalty tags per group type.
 * Applied as multiplier to interestScore after base calculation.
 * See docs/research/company-context-strategy.md for rationale.
 */
const COMPANY_MODIFIERS: Record<string, { boost: string[]; penalty: string[] }> = {
  solo: { boost: [], penalty: [] },
  couple: {
    boost: ['viewpoint', 'restaurant', 'cafe', 'bar', 'park', 'garden', 'attraction'],
    penalty: ['playground', 'family'],
  },
  family: {
    boost: ['park', 'playground', 'family', 'museum', 'swimming', 'outdoor'],
    penalty: ['nightlife', 'bar', 'club'],
  },
  friends: {
    boost: ['bar', 'restaurant', 'nightlife', 'club', 'entertainment', 'sports'],
    penalty: [],
  },
};

/**
 * Pet-friendly modifier — applied independently on top of company modifier.
 * Boosts outdoor venues, penalizes strictly indoor ones.
 */
const PET_MODIFIER = {
  boost: ['outdoor', 'park', 'garden', 'viewpoint', 'playground'],
  penalty: ['museum', 'cinema', 'mall', 'theater', 'gallery', 'library'],
};

interface CandidateRow {
  id: string;
  type: 'place' | 'event';
  title: string;
  title_en?: string;
  title_ka?: string;
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
  attributes?: Record<string, unknown>;
  google_types?: string[];
  google_rating?: number;
  google_rating_count?: number;
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

/**
 * Localized explanation labels.
 */
const EXPLANATION_LABELS: Record<string, Record<string, string>> = {
  open_now: { ru: 'Сейчас открыто', en: 'Open now', ka: 'ახლა ღიაა' },
  free: { ru: 'Бесплатно', en: 'Free', ka: 'უფასო' },
  budget_fit: { ru: 'В бюджете', en: 'Within budget', ka: 'ბიუჯეტში' },
  highly_rated: { ru: 'Высокий рейтинг', en: 'Highly rated', ka: 'მაღალი რეიტინგი' },
  pet_friendly: { ru: 'Можно с питомцем', en: 'Pet friendly', ka: 'შინაურ ცხოველებთან ერთად' },
  company_couple: { ru: 'Подходит для пары', en: 'Great for couples', ka: 'წყვილისთვის' },
  company_family: { ru: 'Для всей семьи', en: 'Family friendly', ka: 'ოჯახისთვის' },
  company_friends: { ru: 'Отлично с друзьями', en: 'Great with friends', ka: 'მეგობრებთან ერთად' },
};

function l(key: string, locale: string): string {
  return EXPLANATION_LABELS[key]?.[locale] ?? EXPLANATION_LABELS[key]?.['en'] ?? key;
}

function lInterest(interest: string, locale: string): string {
  const map: Record<string, Record<string, string>> = {
    nature: { ru: 'природа', en: 'nature', ka: 'ბუნება' },
    bath: { ru: 'бани', en: 'baths', ka: 'აბანოები' },
    spa: { ru: 'спа', en: 'spa', ka: 'სპა' },
    food: { ru: 'еда', en: 'food', ka: 'საჭმელი' },
    nightlife: { ru: 'ночная жизнь', en: 'nightlife', ka: 'ღამის ცხოვრება' },
    culture: { ru: 'культура', en: 'culture', ka: 'კულტურა' },
    sports: { ru: 'спорт', en: 'sports', ka: 'სპორტი' },
    shopping: { ru: 'шоппинг', en: 'shopping', ka: 'შოპინგი' },
    entertainment: { ru: 'развлечения', en: 'entertainment', ka: 'გართობა' },
    family: { ru: 'семья', en: 'family', ka: 'ოჯახი' },
  };
  return map[interest]?.[locale] ?? interest;
}

function lWalkTime(minutes: number, locale: string): string {
  if (locale === 'ka') return `${minutes} წთ ფეხით`;
  if (locale === 'en') return `${minutes} min walk`;
  return `${minutes} мин пешком`;
}

function lMatchesInterest(interest: string, locale: string): string {
  const name = lInterest(interest, locale);
  if (locale === 'ka') return `მოგწონს: ${name}`;
  if (locale === 'en') return `You like: ${name}`;
  return `Тебе нравится: ${name}`;
}

function lStartsIn(minutes: number, locale: string): string {
  if (locale === 'ka') return `იწყება ${minutes} წთ-ში`;
  if (locale === 'en') return `Starts in ${minutes} min`;
  return `Начало через ${minutes} мин`;
}

function lAlsoHas(tag: string, locale: string): string {
  if (locale === 'ka') return `ასევე: ${tag}`;
  if (locale === 'en') return `Also: ${tag}`;
  return `Также: ${tag}`;
}

/** Weight threshold: interests >= this are "I want this" (hard filter). */
const STRICT_INTEREST_THRESHOLD = 0.7;
/** Weight threshold: interests >= this contribute to scoring. Below = ignored. */
const MIN_INTEREST_THRESHOLD = 0.3;

/** Candidate enriched with dynamic category classification. */
interface ScoredCandidate extends CandidateRow {
  score: number;
  interestScore: number;
  /** Tags that matched user interests — these are why the venue is relevant. */
  primaryTags: string[];
  /** Tags that did NOT match — secondary traits of the venue. */
  secondaryTags: string[];
  /** Whether this candidate matched at least one strict interest (weight >= 0.7). */
  hasStrictMatch: boolean;
  /** Company modifier applied: 'boosted' | 'penalized' | null. */
  companyFit: 'boosted' | 'penalized' | null;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async discover(dto: DiscoverRequestDto) {
    const baseRadiusM = dto.radiusM ?? 5000;
    const hiddenIds = dto.hiddenIds ?? [];
    const interests = dto.profile.interests;
    // Build expanded interest->tag maps once for the entire request
    // Only interests with weight >= 0.3 are included; below = "neutral", ignored
    const expandedWeights = interests
      ? this.buildExpandedWeights(interests)
      : new Map<string, number>();
    const hasInterests = expandedWeights.size > 0;
    const hasStrictInterests = hasInterests &&
      [...expandedWeights.values()].some((w) => w >= STRICT_INTEREST_THRESHOLD);

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

      // Interest hard filter:
      // - If strict interests exist (weight >= 0.7): venue must match at least one strict tag
      // - If only soft interests (all < 0.7): no hard filter, just scoring
      if (hasStrictInterests) {
        scored = scored.filter((c) => c.hasStrictMatch);
      } else if (hasInterests) {
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
    const timeMid = new Date((new Date(dto.timeWindow.from).getTime() + new Date(dto.timeWindow.to).getTime()) / 2);

    const cards = diversified.slice(0, 30).map((c) => {
      const openStatus = c.type === 'place'
        ? checkOpenStatus(c.opening_hours, timeMid)
        : undefined;

      // Resolve title by locale: en → name_en, ka → name_ka, ru → name (default)
      const title = dto.locale === 'en' ? (c.title_en ?? c.title)
        : dto.locale === 'ka' ? (c.title_ka ?? c.title)
        : c.title;

      return {
        id: c.id,
        type: c.type,
        title,
        category: c.category,
        lat: c.lat,
        lng: c.lng,
        distanceM: Math.round(c.distance_m),
        walkMinutes: Math.round((c.distance_m / WALK_SPEED_M_PER_MIN) * STREET_CURVE_FACTOR),
        explanations: this.generateExplanations(c, dto, expandedWeights),
        source: 'canonical',
        address: c.address,
        rating: c.google_rating ? Number(c.google_rating) : c.rating ? Number(c.rating) : undefined,
        ratingCount: c.google_rating_count ?? c.rating_count,
        primaryTags: c.primaryTags.length > 0 ? c.primaryTags : undefined,
        secondaryTags: c.secondaryTags.length > 0 ? c.secondaryTags : undefined,
        openStatus: getOpenLabel(openStatus ?? 'unknown', dto.locale),
        startsAt: c.starts_at,
        endsAt: c.ends_at,
        venueName: c.venue_name,
        ticketUrl: c.ticket_url,
        priceLabel: this.formatPrice(c),
        photoUrl: c.photos?.[0],
      };
    });

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
  /**
   * Build expanded tag->weight map from user interests + synonyms.
   * Only includes interests with weight >= MIN_INTEREST_THRESHOLD (0.3).
   * Below that threshold = "neutral", effectively ignored.
   */
  private buildExpandedWeights(interests: Record<string, number>): Map<string, number> {
    const expanded = new Map<string, number>();
    for (const [interest, weight] of Object.entries(interests)) {
      if (weight < MIN_INTEREST_THRESHOLD) continue;
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

    let hasStrictMatch = false;

    for (const tag of tags) {
      const weight = expandedWeights.get(tag);
      if (weight != null && weight > 0) {
        primaryTags.push(tag);
        matchScores.push(weight);
        if (weight >= STRICT_INTEREST_THRESHOLD) hasStrictMatch = true;
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

    // Company context modifier — use Google attributes when available, fallback to tag proxy
    let companyFit: 'boosted' | 'penalized' | null = null;
    const company = dto.profile.company;
    const attrs = c.attributes as Record<string, unknown> | undefined;

    if (company && COMPANY_MODIFIERS[company]) {
      const mod = COMPANY_MODIFIERS[company];

      // Fact-based: family + goodForChildren attribute
      if (company === 'family' && attrs?.['goodForChildren'] !== undefined) {
        if (attrs['goodForChildren'] === true) {
          interestScore = Math.min(1.0, interestScore * 1.3);
          companyFit = 'boosted';
        } else {
          interestScore = interestScore * 0.3;
          companyFit = 'penalized';
        }
      } else {
        // Tag-based fallback
        const hasBoostedTag = tags.some((t) => mod.boost.includes(t));
        const hasPenaltyTag = tags.some((t) => mod.penalty.includes(t));

        if (hasPenaltyTag) {
          interestScore = interestScore * 0.3;
          companyFit = 'penalized';
        }
        if (hasBoostedTag) {
          interestScore = Math.min(1.0, interestScore * 1.3);
          companyFit = companyFit === 'penalized' ? 'penalized' : 'boosted';
        }
      }
    }

    // Pet modifier — use Google attributes when available, fallback to tag proxy
    if (dto.profile.hasPet) {
      const attrs = c.attributes as Record<string, unknown> | undefined;
      if (attrs?.['allowsDogs'] === true) {
        interestScore = Math.min(1.0, interestScore * 1.5);
        if (companyFit !== 'penalized') companyFit = 'boosted';
      } else if (attrs?.['allowsDogs'] === false && attrs?.['outdoorSeating'] !== true) {
        // No dogs allowed AND no outdoor seating → strong penalty
        interestScore = interestScore * 0.1;
        if (!companyFit) companyFit = 'penalized';
      } else if (attrs?.['allowsDogs'] === false && attrs?.['outdoorSeating'] === true) {
        // No dogs inside but has terrace → mild, neutral-ish
        interestScore = interestScore * 0.7;
      } else {
        // No Google data — fallback to tag proxy
        const hasPetBoost = tags.some((t) => PET_MODIFIER.boost.includes(t));
        const hasPetPenalty = tags.some((t) => PET_MODIFIER.penalty.includes(t));

        if (hasPetPenalty) {
          interestScore = interestScore * 0.3;
          if (!companyFit) companyFit = 'penalized';
        }
        if (hasPetBoost) {
          interestScore = Math.min(1.0, interestScore * 1.3);
          if (companyFit !== 'penalized') companyFit = 'boosted';
        }
      }
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
      companyFit,
      hasStrictMatch,
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
        p.id, 'place' AS type, v.name AS title, v.name_en AS title_en, v.name_ka AS title_ka,
        p.category, p.tags,
        v.lat, v.lng,
        ST_Distance(
          ST_MakePoint(v.lng, v.lat)::geography,
          ST_MakePoint($2, $1)::geography
        ) AS distance_m,
        v.address, p.rating, p.rating_count, p.indoor, p.price_level,
        p.quality_score, p.status, p.attributes, p.google_types, p.google_rating,
        p.google_rating_count, p.opening_hours, p.photos, v.website
      FROM places p
      JOIN venues v ON p.venue_id = v.id
      WHERE p.status = 'active'
        AND ST_DWithin(
          ST_MakePoint(v.lng, v.lat)::geography,
          ST_MakePoint($2, $1)::geography,
          $3
        )
      ORDER BY distance_m
      LIMIT $4`,
      [lat, lng, radiusM, radiusM > 5000 ? 1000 : 500],
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

    // Places: check opening_hours against time window midpoint
    if (c.opening_hours) {
      const mid = new Date((new Date(timeWindow.from).getTime() + new Date(timeWindow.to).getTime()) / 2);
      const status = checkOpenStatus(c.opening_hours, mid);
      if (status === 'closed') return 0.0; // hard zero — will be filtered if interests are set
      if (status === 'open') return 1.0;
    }

    return 0.8; // unknown hours — neutral
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
    const locale = dto.locale;

    // Time-sensitive
    if (c.type === 'event' && c.starts_at) {
      const minutesUntil = (new Date(c.starts_at).getTime() - Date.now()) / 60000;
      if (minutesUntil > 0 && minutesUntil <= 120) {
        explanations.push({ type: 'starts_in', label: lStartsIn(Math.round(minutesUntil), locale), priority: 1 });
      }
    }

    // Open status
    if (c.type === 'place' && c.opening_hours) {
      const timeMid = new Date((new Date(dto.timeWindow.from).getTime() + new Date(dto.timeWindow.to).getTime()) / 2);
      const status = checkOpenStatus(c.opening_hours, timeMid);
      if (status === 'open') {
        explanations.push({ type: 'open_now', label: l('open_now', locale), priority: 1 });
      }
    }

    // Walk time
    if (c.distance_m <= 2000) {
      const walkMin = Math.round((c.distance_m / WALK_SPEED_M_PER_MIN) * STREET_CURVE_FACTOR);
      explanations.push({ type: 'walk_time', label: lWalkTime(walkMin, locale), priority: 2 });
    }

    // Price
    if (c.price_level === 0 || (c.price_min != null && c.price_min === 0)) {
      explanations.push({ type: 'free', label: l('free', locale), priority: 3 });
    } else if (dto.profile.budgetMax != null && c.price_min != null && c.price_min <= dto.profile.budgetMax) {
      explanations.push({ type: 'budget_fit', label: l('budget_fit', locale), priority: 3 });
    }

    // Interest match
    if (c.primaryTags.length > 0) {
      const interests = dto.profile.interests ?? {};
      const matchedInterest = Object.keys(interests).find((interest) => {
        const synonyms = INTEREST_SYNONYMS[interest] ?? [interest];
        return c.primaryTags.some((t) => synonyms.includes(t) || t === interest);
      });
      if (matchedInterest) {
        explanations.push({ type: 'matches_interest', label: lMatchesInterest(matchedInterest, locale), priority: 4 });
      }
    }

    // Company fit
    if (c.companyFit === 'boosted' && dto.profile.company) {
      const key = `company_${dto.profile.company}`;
      if (EXPLANATION_LABELS[key]) {
        explanations.push({ type: 'company_fit', label: l(key, locale), priority: 4 });
      }
    }

    // Pet-friendly
    if (dto.profile.hasPet && c.companyFit === 'boosted') {
      const attrs = c.attributes as Record<string, unknown> | undefined;
      const hasPetBoostTag = (c.tags ?? []).some((t) => PET_MODIFIER.boost.includes(t));
      if (attrs?.['allowsDogs'] === true || hasPetBoostTag) {
        explanations.push({ type: 'pet_friendly', label: l('pet_friendly', locale), priority: 4 });
      }
    }

    // Secondary tags hint
    if (c.secondaryTags.length > 0 && c.primaryTags.length > 0) {
      const humanReadable = c.secondaryTags
        .filter((t) => ['food', 'cafe', 'restaurant', 'bar', 'bath', 'swimming', 'gym'].includes(t))
        .slice(0, 1);
      if (humanReadable.length > 0) {
        explanations.push({ type: 'also_has', label: lAlsoHas(humanReadable[0], locale), priority: 6 });
      }
    }

    // Quality
    const rating = c.google_rating ? Number(c.google_rating) : c.rating ? Number(c.rating) : 0;
    if (rating >= 4.5) {
      explanations.push({ type: 'highly_rated', label: l('highly_rated', locale), priority: 5 });
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
