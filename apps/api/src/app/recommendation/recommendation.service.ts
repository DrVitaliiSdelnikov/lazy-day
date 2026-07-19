import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DiscoverRequestDto } from './dto/discover-request.dto';
import { checkOpenStatus, getOpenLabel } from './opening-hours';
import { ImpressionService } from './impression.service';
import { TasteProfileService } from './taste-profile.service';

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
  nightlife: ['nightlife', 'bar', 'club', 'concert'],
  culture: ['culture', 'museum', 'gallery', 'theater'],
  gym: ['gym', 'wellness', 'sports'],
  sports: ['sports', 'climbing', 'karting', 'paintball', 'trampoline', 'bowling'],
  shopping: ['shopping', 'mall'],
  entertainment: ['entertainment', 'cinema', 'club', 'bowling', 'escape_room', 'gaming', 'arcade', 'water_park', 'music', 'concert', 'festival'],
  family: ['family', 'playground', 'park', 'trampoline', 'water_park', 'arcade'],
  active: ['sports', 'climbing', 'karting', 'paintball', 'trampoline', 'gym', 'bowling', 'escape_room', 'gaming', 'arcade', 'water_park'],
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
  google_place_id?: string;
  is_chain?: boolean;
  chain_key?: string;
  enriched_at?: string;
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
    active: { ru: 'активный отдых', en: 'active leisure', ka: 'აქტიური დასვენება' },
    gym: { ru: 'фитнес', en: 'fitness', ka: 'ფიტნესი' },
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

function lTag(tag: string, locale: string): string {
  const map: Record<string, Record<string, string>> = {
    food: { ru: 'еда', en: 'food', ka: 'საჭმელი' },
    cafe: { ru: 'кафе', en: 'café', ka: 'კაფე' },
    restaurant: { ru: 'ресторан', en: 'restaurant', ka: 'რესტორანი' },
    bar: { ru: 'бар', en: 'bar', ka: 'ბარი' },
    bath: { ru: 'бани', en: 'baths', ka: 'აბანოები' },
    swimming: { ru: 'бассейн', en: 'pool', ka: 'აუზი' },
    gym: { ru: 'фитнес', en: 'gym', ka: 'ფიტნესი' },
  };
  return map[tag]?.[locale] ?? map[tag]?.['en'] ?? tag;
}

function lAlsoHas(tag: string, locale: string): string {
  const name = lTag(tag, locale);
  if (locale === 'ka') return `ასევე: ${name}`;
  if (locale === 'en') return `Also: ${name}`;
  return `Также: ${name}`;
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

  constructor(
    private readonly dataSource: DataSource,
    private readonly impressionService: ImpressionService,
    private readonly tasteProfile: TasteProfileService,
  ) {}

  async discover(dto: DiscoverRequestDto) {
    // F3.5: Tourist/local modifiers
    const isTourist = dto.profile.localType === 'tourist' || dto.profile.localType === 'first_time';
    const isLocal = dto.profile.localType === 'local';
    const radiusMultiplier = isTourist ? 1.3 : isLocal ? 0.8 : 1.0;
    const baseRadiusM = Math.round((dto.radiusM ?? 5000) * radiusMultiplier);
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

      // Availability filter: exclude places confirmed closed at requested time
      // Keep: open, unknown (no hours data), events (have their own time logic)
      const timeMid = new Date((new Date(dto.timeWindow.from).getTime() + new Date(dto.timeWindow.to).getTime()) / 2);
      scored = scored.filter((c) => {
        if (c.type === 'event') return true;
        const status = checkOpenStatus(c.opening_hours, timeMid);
        return status !== 'closed';
      });

      // Enough results? Stop expanding.
      if (scored.length >= MIN_RELEVANT_RESULTS || !hasInterests) break;

      // Expand radius for next attempt
      radiusM = Math.round(radiusM * 1.5);
      this.logger.log(`Adaptive fill: only ${scored.length} relevant results, expanding radius to ${radiusM}m`);
    }

    // F2: Load taste profile once (reused for all candidates)
    const deviceIdHash = (dto as any).deviceIdHash;
    const userProfile = await this.tasteProfile.loadProfile(deviceIdHash);
    const wPersonal = this.tasteProfile.getPersonalWeight(userProfile);

    // F2.3 + F2.5: Apply personalization + price boost
    if (wPersonal > 0 && userProfile) {
      for (const c of scored) {
        const venueFacets = this.tasteProfile.extractFacetsFromCandidate(c);
        const personalScore = this.tasteProfile.computePersonalizationScore(userProfile, venueFacets);
        c.score += wPersonal * personalScore;
        c.score += this.tasteProfile.priceTierBoost(userProfile, (c as any).facet_price_tier);
      }
    }

    // F1.2: Apply impression discount (repeated venues sink)
    const discountMap = await this.impressionService.getDiscountMap(deviceIdHash);
    const savedIds = new Set<string>((dto as any).savedIds ?? []);
    this.impressionService.applyDiscount(scored, discountMap, savedIds);

    // Sort + daily rotation (tie-breaker for similar scores, top-3 untouched)
    scored.sort((a, b) => b.score - a.score);

    // F1.3: Session dithering (variety between sessions)
    this.impressionService.applySessionDithering(scored, deviceIdHash ?? '');

    this.applyDailyRotation(scored);
    let diversified = this.applyDiversity(scored);

    // Step 9: TIME FALLBACK
    // If few results at night (21:00-06:00 Tbilisi) and not forced "now",
    // re-run pipeline with tomorrow's timeWindow
    let meta: { fallback?: 'tomorrow' | 'exhausted'; originalCount?: number } | undefined;
    const tbilisiHour = (new Date().getUTCHours() + 4) % 24;
    const isNightHours = tbilisiHour >= 21 || tbilisiHour < 6;

    if (
      diversified.length < MIN_RELEVANT_RESULTS &&
      isNightHours &&
      !dto.forcedNow
    ) {
      const originalCount = diversified.length;
      this.logger.log(`Night fallback: only ${originalCount} results at ${tbilisiHour}:00 Tbilisi, trying tomorrow`);

      // Build tomorrow's time window (tomorrow 08:00 - 23:00 local)
      const now = new Date();
      const tomorrowStart = new Date(now);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
      tomorrowStart.setUTCHours(4, 0, 0, 0); // 08:00 Tbilisi = 04:00 UTC
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setUTCHours(19, 0, 0, 0); // 23:00 Tbilisi = 19:00 UTC

      const tomorrowDto = {
        ...dto,
        timeWindow: { from: tomorrowStart.toISOString(), to: tomorrowEnd.toISOString() },
      };

      // Re-fetch and re-score with tomorrow's time window
      const [places, events] = await Promise.all([
        this.fetchPlaces(dto.lat, dto.lng, radiusM),
        this.fetchEvents(dto.lat, dto.lng, radiusM, tomorrowDto.timeWindow),
      ]);

      let candidates: CandidateRow[] = [...places, ...events];
      candidates = candidates.filter((c) => {
        if (hiddenIds.includes(c.id)) return false;
        if (dto.profile.budgetMax != null) {
          if (c.price_min != null && c.price_min > dto.profile.budgetMax) return false;
          if (c.price_level != null && c.price_level > this.budgetToLevel(dto.profile.budgetMax)) return false;
        }
        return true;
      });

      let tomorrowScored = candidates.map((c) =>
        this.scoreCandidate(c, tomorrowDto, radiusM, expandedWeights),
      );

      if (hasStrictInterests) {
        tomorrowScored = tomorrowScored.filter((c) => c.hasStrictMatch);
      } else if (hasInterests) {
        tomorrowScored = tomorrowScored.filter((c) => c.primaryTags.length > 0);
      }

      // Availability filter for tomorrow midpoint
      const tomorrowMid = new Date((tomorrowStart.getTime() + tomorrowEnd.getTime()) / 2);
      tomorrowScored = tomorrowScored.filter((c) => {
        if (c.type === 'event') return true;
        const status = checkOpenStatus(c.opening_hours, tomorrowMid);
        return status !== 'closed';
      });

      tomorrowScored.sort((a, b) => b.score - a.score);
      diversified = this.applyDiversity(tomorrowScored);

      if (diversified.length >= 3) {
        meta = { fallback: 'tomorrow', originalCount };
      } else {
        meta = { fallback: 'exhausted', originalCount };
      }

      this.logger.log(`Night fallback result: ${diversified.length} tomorrow cards (fallback=${meta.fallback})`);
    }

    // Build response cards
    const isTomorrowFallback = meta?.fallback === 'tomorrow';
    const timeMid = isTomorrowFallback
      ? new Date(new Date().setUTCDate(new Date().getUTCDate() + 1))  // tomorrow noon-ish
      : new Date((new Date(dto.timeWindow.from).getTime() + new Date(dto.timeWindow.to).getTime()) / 2);

    const cards = diversified.slice(0, 60).map((c) => {
      const openStatus = c.type === 'place'
        ? checkOpenStatus(c.opening_hours, timeMid)
        : undefined;

      // Resolve title by locale with smart fallback
      // Problem: v.name is often Georgian in Tbilisi OSM data
      // For ru/en: prefer name_en over Georgian name
      const isGeorgian = (s: string) => /[\u10A0-\u10FF]/.test(s);
      let title: string;
      if (dto.locale === 'ka') {
        title = c.title_ka ?? c.title;
      } else if (dto.locale === 'en') {
        title = c.title_en ?? (isGeorgian(c.title) ? c.title_en ?? c.title : c.title);
      } else {
        // ru: prefer non-Georgian name
        title = (!isGeorgian(c.title) ? c.title : null) ?? c.title_en ?? c.title;
      }

      // For tomorrow fallback: show tomorrow's opening time instead of current status
      let displayOpenStatus: string | undefined;
      if (isTomorrowFallback && c.type === 'place') {
        const tomorrowLabel = this.getTomorrowOpenLabel(c.opening_hours, dto.locale);
        displayOpenStatus = tomorrowLabel ?? getOpenLabel(openStatus ?? 'unknown', dto.locale);
      } else {
        displayOpenStatus = getOpenLabel(openStatus ?? 'unknown', dto.locale);
      }

      return {
        id: c.id,
        type: c.type,
        title,
        category: c.category,
        lat: c.lat,
        lng: c.lng,
        distanceM: c.distance_m != null ? Math.round(c.distance_m) : null,
        walkMinutes: c.distance_m != null && c.distance_m > 0 ? Math.round((c.distance_m / WALK_SPEED_M_PER_MIN) * STREET_CURVE_FACTOR) : null,
        explanations: this.generateExplanations(c, dto, expandedWeights),
        source: 'canonical',
        address: c.address,
        rating: c.google_rating ? Number(c.google_rating) : c.rating ? Number(c.rating) : undefined,
        ratingCount: c.google_rating_count ?? c.rating_count,
        primaryTags: c.primaryTags.length > 0 ? c.primaryTags : undefined,
        secondaryTags: c.secondaryTags.length > 0 ? c.secondaryTags : undefined,
        openStatus: this.resolveOpenStatus(c, displayOpenStatus),
        startsAt: c.starts_at,
        endsAt: c.ends_at,
        venueName: c.venue_name,
        ticketUrl: c.ticket_url,
        priceLabel: this.formatPrice(c),
        photoUrl: c.photos?.[0],
        googlePlaceId: c.google_place_id,
        isChain: c.is_chain || false,
        whyLabel: this.resolveWhyLabel(c, userProfile, wPersonal, dto.locale),
      };
    });

    // F1.4: Inject epsilon-explore slot
    this.impressionService.injectEpsilonSlot(cards, scored, discountMap, deviceIdHash ?? '');

    const sessionId = crypto.randomUUID();

    this.logger.log(
      `Discover: ${scored.length} relevant → ${cards.length} cards (radius=${radiusM}m${radiusM !== baseRadiusM ? ', expanded' : ''})`,
    );

    // F1.1: Record impressions async (non-blocking)
    if (deviceIdHash) {
      this.impressionService.recordImpressions(deviceIdHash, cards.map((c: any) => c.id)).catch(() => {});
    }

    return { sessionId, cards, hasMore: diversified.length > 60, meta };
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

    // Events without a linked venue have distance_m = null → neutral score (0.5)
    const distance = c.distance_m === null ? 0.5 : Math.max(0, 1 - c.distance_m / radiusM);
    const time = this.timeFit(c, dto.timeWindow);
    const quality = Number(c.quality_score) || 0.5;
    const source = 0.6;

    // F3.5: Tourist softer on chains, local stricter
    const lt = dto.profile.localType;
    const CHAIN_SCORE_MULTIPLIER = (lt === 'tourist' || lt === 'first_time') ? 0.90 : lt === 'local' ? 0.80 : 0.85;

    let score =
      WEIGHTS.interestMatch * interestScore +
      WEIGHTS.distanceDecay * distance +
      WEIGHTS.timeFit * time +
      WEIGHTS.cardQuality * quality +
      WEIGHTS.sourceConfidence * source;

    // Chain penalty: lower discovery value, applied on final score
    if (c.is_chain && c.type === 'place') {
      score *= CHAIN_SCORE_MULTIPLIER;
    }

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
    // Haversine distance in meters — no PostGIS dependency
    const rows = await this.dataSource.query(
      `SELECT
        p.id, 'place' AS type, v.name AS title, v.name_en AS title_en, v.name_ka AS title_ka,
        p.category, p.tags,
        v.lat, v.lng,
        (6371000 * acos(
          cos(radians($1)) * cos(radians(v.lat)) *
          cos(radians(v.lng) - radians($2)) +
          sin(radians($1)) * sin(radians(v.lat))
        )) AS distance_m,
        v.address, p.rating, p.rating_count, p.indoor, p.price_level,
        p.quality_score, p.status, p.attributes, p.google_types, p.google_rating,
        p.google_rating_count, p.opening_hours, p.photos, v.website, v.google_place_id,
        p.is_chain, p.chain_key, p.enriched_at,
        p.facet_cuisine, p.facet_format, p.facet_atmosphere, p.facet_occasion, p.facet_price_tier
      FROM places p
      JOIN venues v ON p.venue_id = v.id
      WHERE p.status = 'active'
        AND v.lat BETWEEN $1 - ($3::float / 111000) AND $1 + ($3::float / 111000)
        AND v.lng BETWEEN $2 - ($3::float / (111000 * cos(radians($1)))) AND $2 + ($3::float / (111000 * cos(radians($1))))
      ORDER BY distance_m
      LIMIT $4`,
      [lat, lng, radiusM, radiusM > 5000 ? 1000 : 500],
    );
    return rows.filter((r: any) => r.distance_m <= radiusM);
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
        CASE
          WHEN v.lat IS NOT NULL AND v.lng IS NOT NULL THEN
            (6371000 * acos(LEAST(1.0,
              cos(radians($1)) * cos(radians(v.lat)) *
              cos(radians(v.lng) - radians($2)) +
              sin(radians($1)) * sin(radians(v.lat))
            )))
          ELSE NULL
        END AS distance_m,
        v.address, v.name AS venue_name,
        e.starts_at, e.ends_at, e.ticket_url,
        e.price_min, e.price_max, e.quality_score
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      WHERE e.status = 'scheduled'
        AND e.starts_at BETWEEN $3 AND $4
      ORDER BY distance_m ASC NULLS LAST, e.starts_at ASC
      LIMIT 150`,
      [lat, lng, timeWindow.from, timeWindow.to],
    );
    // Events with known venue: keep only within radius. Events without venue: always include.
    return rows.filter((r: any) => r.distance_m === null || r.distance_m <= radiusM);
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
      if (status === 'closed') return 0.0;
      if (status === 'open') {
        // 24/7 night boost: bars and late-night spots get +0.05 between 23:00-06:00
        const tbilisiHour = (mid.getUTCHours() + 4) % 24;
        if ((tbilisiHour >= 23 || tbilisiHour < 6) && this.is24h(c.opening_hours)) {
          return 1.05; // small boost over regular open places
        }
        return 1.0;
      }
    }

    return 0.8; // unknown hours — neutral
  }

  /** Check if opening_hours indicate a 24/7 venue. */
  private is24h(hours: Record<string, unknown>): boolean {
    const raw = hours['raw'] as string | undefined;
    if (raw && (raw.includes('24/7') || raw.includes('00:00-24:00'))) return true;
    const periods = hours['periods'] as Array<{ open?: { hour: number }; close?: { hour: number } }> | undefined;
    if (periods?.length === 1 && periods[0].open?.hour === 0 && !periods[0].close) return true;
    return false;
  }

  /**
   * Daily rotation: shuffle cards with similar scores (|Δ| < 0.05)
   * using date-based seed. Top-3 untouched (trust in quality).
   * Prevents "same feed every day" = "app is dead".
   */
  private applyDailyRotation(scored: ScoredCandidate[]) {
    if (scored.length <= 3) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const seed = this.simpleHash(today);

    // Only shuffle positions 3+ where score diff < 0.05
    for (let i = 3; i < scored.length - 1; i++) {
      if (Math.abs(scored[i].score - scored[i + 1].score) < 0.05) {
        // Deterministic swap based on seed + position
        if ((this.simpleHash(seed + scored[i].id) % 3) === 0) {
          [scored[i], scored[i + 1]] = [scored[i + 1], scored[i]];
        }
      }
    }
  }

  private simpleHash(s: string | number): number {
    const str = String(s);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
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

      // Category streak limit applies only to places — events are unique by definition
      // (different title/time/performer), so we never cut them for category repetition.
      if (card.type === 'place' && result.length >= 2) {
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

    // Open status: NOT added to explanations — openStatus badge already shows it on card.
    // Adding both creates duplicate "Открыто" + "Открыто сейчас" chips.

    // Walk time (skip when venue not linked — distance_m is null/0)
    if (c.distance_m != null && c.distance_m > 0 && c.distance_m <= 2000) {
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

  /** For tomorrow fallback: resolve opening time label like "Завтра с 10:00". */
  private getTomorrowOpenLabel(hours: Record<string, unknown> | undefined, locale: string): string | null {
    if (!hours) return null;
    // Try to get tomorrow's opening hour from structured periods
    const periods = hours['periods'] as Array<{
      open?: { day: number; hour: number; minute: number };
    }> | undefined;
    if (periods?.length) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayOfWeek = tomorrow.getDay(); // 0=Sun
      const match = periods.find(p => p.open?.day === dayOfWeek);
      if (match?.open) {
        const h = String(match.open.hour).padStart(2, '0');
        const m = String(match.open.minute).padStart(2, '0');
        const time = `${h}:${m}`;
        if (locale === 'en') return `Tomorrow at ${time}`;
        if (locale === 'ka') return `ხვალ ${time}-ზე`;
        return `Завтра с ${time}`;
      }
    }
    if (locale === 'en') return 'Tomorrow';
    if (locale === 'ka') return 'ხვალ';
    return 'Завтра';
  }

  /**
   * F3.1: Contextual "why" label — explains why this venue is shown.
   * Priority: explore > saved > vibe match > company > interest > nearby.
   */
  private resolveWhyLabel(
    c: ScoredCandidate,
    profile: any,
    wPersonal: number,
    locale: string,
  ): string | undefined {
    // Explore slot
    if ((c as any)._isExplore) {
      return locale === 'ka' ? 'ახალი ადგილი ახლოს' : locale === 'en' ? 'New place nearby' : 'Новое место рядом';
    }

    // Personalized vibe match
    if (profile && wPersonal > 0.05) {
      const venueFacets = this.tasteProfile.extractFacetsFromCandidate(c);
      const score = this.tasteProfile.computePersonalizationScore(profile, venueFacets);
      if (score > 0.5) {
        // Find top matching facet
        const weights = profile.facet_weights ?? {};
        let topFacet = '';
        let topWeight = 0;
        for (const { type, value } of venueFacets) {
          const w = weights[type]?.[value] ?? 0;
          if (w > topWeight) { topWeight = w; topFacet = value; }
        }
        if (topFacet) {
          const facetLabel = lInterest(topFacet, locale) || topFacet;
          return locale === 'ka' ? `თქვენი ვაიბი: ${facetLabel}` : locale === 'en' ? `Your vibe: ${facetLabel}` : `Ваш вайб: ${facetLabel}`;
        }
      }
    }

    // Company fit
    if (c.companyFit === 'boosted') {
      return locale === 'ka' ? 'შესაფერისია' : locale === 'en' ? 'Great fit' : 'Подходит';
    }

    // High interest match — only show when no active preset filter
    // (otherwise every card says "matches interest" which is noise)
    // Skip this label — let vibe/company/nearby handle it

    // Nearby
    if (c.distance_m != null && c.distance_m < 500) {
      return locale === 'ka' ? 'ახლოს თქვენთან' : locale === 'en' ? 'Near you' : 'Рядом с вами';
    }

    return undefined;
  }

  /**
   * A4: If enriched_at is stale (>30 days) or missing, treat openStatus as unknown.
   * This ensures we don't show potentially outdated hours as current.
   */
  private resolveOpenStatus(c: CandidateRow, displayStatus: string | undefined): string | undefined {
    if (c.type === 'event') return displayStatus; // events don't have opening hours
    if (!c.enriched_at) return displayStatus; // no enrichment timestamp — use as-is (legacy)
    const enrichedAt = new Date(c.enriched_at);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - enrichedAt.getTime() > thirtyDays) {
      return undefined; // stale → frontend shows "Часы не подтверждены"
    }
    return displayStatus;
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
