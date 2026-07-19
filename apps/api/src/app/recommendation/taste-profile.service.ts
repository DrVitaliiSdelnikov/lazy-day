import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Place } from '../database/entities/place.entity';

/**
 * F2: Faceted taste profile — learns user preferences from behavior.
 *
 * Updates facet_weights via IDF-weighted EMA on positive signals.
 * Handles facet-level negative attribution on hide (threshold ≥2).
 * Computes personalizationScore (cosine) and price gaussian boost.
 *
 * Table: user_taste_profile (device_id_hash PK).
 * Depends on: facet_idf (A10), facet_* fields on places (A8/A9).
 */

const DECAY = 0.9;
const W_PERSONAL_MAX = 0.20;
const W_PERSONAL_RAMP = 15; // full weight after 15 signals
const NEG_THRESHOLD = 2;
const NEG_RATIO = 0.4; // η_neg = 0.4 × η_pos
const NEG_FLOOR = -0.5;
const IDF_MIN = 2.0; // don't penalize common facets (food, restaurant)
const PRICE_BETA = 0.06;

const SIGNAL_WEIGHTS: Record<string, number> = {
  been_here: 1.0,
  save: 1.0,
  route: 0.7,
  taxi: 0.7,
  share: 0.7,
  ticket_click: 0.7,
  decide_open: 0.5,
  card_click: 0.3,
};

interface TasteProfile {
  facet_weights: Record<string, Record<string, number>>;
  price_pref: { histogram?: number[]; mu?: number; sigma?: number };
  neg_counters: Record<string, number>;
  signal_count: number;
}

@Injectable()
export class TasteProfileService {
  private readonly logger = new Logger(TasteProfileService.name);

  constructor(
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * F2.2: Update taste profile on positive signal.
   * IDF-weighted EMA: rare facets (fine_dining) weigh more than common (food).
   */
  async updateOnPositive(deviceIdHash: string, venueId: string, action: string): Promise<void> {
    if (!deviceIdHash || deviceIdHash === 'anonymous') return;
    const signalWeight = SIGNAL_WEIGHTS[action] ?? 0.3;

    const place = await this.placeRepo.findOne({ where: { id: venueId } });
    if (!place) return;

    const facets = this.extractFacets(place);
    if (facets.length === 0) return;

    const profile = await this.loadOrCreate(deviceIdHash);
    const idfMap = await this.loadIdf();

    // Update facet weights
    for (const { type, value } of facets) {
      const idf = idfMap.get(`${type}:${value}`) ?? 3.0;
      if (!profile.facet_weights[type]) profile.facet_weights[type] = {};
      const current = profile.facet_weights[type][value] ?? 0;
      profile.facet_weights[type][value] = DECAY * current + (1 - DECAY) * signalWeight * idf;
    }

    // Update price preference
    if (place.facetPriceTier) {
      if (!profile.price_pref.histogram) profile.price_pref.histogram = [0, 0, 0, 0, 0];
      profile.price_pref.histogram[place.facetPriceTier - 1] += signalWeight;
      this.recalcPriceStats(profile.price_pref);
    }

    profile.signal_count++;
    await this.save(deviceIdHash, profile);
  }

  /**
   * F2.4: Apply facet-level negative on hide.
   * IDF-weighted attribution, threshold ≥2 concordant negatives.
   */
  async updateOnHide(deviceIdHash: string, venueId: string): Promise<void> {
    if (!deviceIdHash || deviceIdHash === 'anonymous') return;

    const place = await this.placeRepo.findOne({ where: { id: venueId } });
    if (!place) return;

    const facets = this.extractFacets(place);
    if (facets.length === 0) return;

    const profile = await this.loadOrCreate(deviceIdHash);
    const idfMap = await this.loadIdf();

    const idfSum = facets.reduce((s, f) => s + (idfMap.get(`${f.type}:${f.value}`) ?? 3.0), 0);

    for (const { type, value } of facets) {
      const key = `${type}:${value}`;
      const idf = idfMap.get(key) ?? 3.0;

      if (idf < IDF_MIN) continue; // skip too-common facets

      profile.neg_counters[key] = (profile.neg_counters[key] ?? 0) + 1;

      if (profile.neg_counters[key] >= NEG_THRESHOLD) {
        const penalty = NEG_RATIO * idf / idfSum;
        if (!profile.facet_weights[type]) profile.facet_weights[type] = {};
        profile.facet_weights[type][value] = Math.max(
          NEG_FLOOR,
          (profile.facet_weights[type][value] ?? 0) - penalty,
        );
      }
    }

    await this.save(deviceIdHash, profile);
  }

  /**
   * F2.3: Compute personalization score (cosine similarity).
   * Returns 0 for anonymous/new users.
   */
  computePersonalizationScore(
    profile: TasteProfile | null,
    venueFacets: Array<{ type: string; value: string }>,
  ): number {
    if (!profile || profile.signal_count === 0 || venueFacets.length === 0) return 0;

    const weights = profile.facet_weights;
    let dot = 0, normU = 0;

    for (const [type, vals] of Object.entries(weights)) {
      for (const [val, w] of Object.entries(vals)) {
        normU += w * w;
        if (venueFacets.some(f => f.type === type && f.value === val)) {
          dot += w;
        }
      }
    }

    if (normU === 0) return 0;
    const normV = Math.sqrt(venueFacets.length);
    return Math.max(0, dot / (Math.sqrt(normU) * normV));
  }

  /**
   * F2.3: Get w_personal weight (ramps 0→0.20 by signal count).
   */
  getPersonalWeight(profile: TasteProfile | null): number {
    if (!profile) return 0;
    return W_PERSONAL_MAX * Math.min(1, profile.signal_count / W_PERSONAL_RAMP);
  }

  /**
   * F2.5: Price tier gaussian boost.
   * Soft preference — never hard-excludes.
   */
  priceTierBoost(profile: TasteProfile | null, venueTier: number | null): number {
    if (!profile?.price_pref?.mu || !profile.price_pref.sigma || !venueTier) return 0;
    return PRICE_BETA * Math.exp(
      -Math.pow(venueTier - profile.price_pref.mu, 2) /
      (2 * Math.pow(profile.price_pref.sigma, 2)),
    );
  }

  /**
   * Load profile for scoring (called once per request).
   */
  async loadProfile(deviceIdHash: string): Promise<TasteProfile | null> {
    if (!deviceIdHash || deviceIdHash === 'anonymous') return null;

    const rows = await this.dataSource.query(
      'SELECT facet_weights, price_pref, neg_counters, signal_count FROM user_taste_profile WHERE device_id_hash = $1',
      [deviceIdHash],
    );

    if (rows.length === 0) return null;
    return {
      facet_weights: rows[0].facet_weights ?? {},
      price_pref: rows[0].price_pref ?? {},
      neg_counters: rows[0].neg_counters ?? {},
      signal_count: rows[0].signal_count ?? 0,
    };
  }

  /**
   * Extract facets from a place for scoring/profile update.
   */
  extractFacetsFromCandidate(c: any): Array<{ type: string; value: string }> {
    const facets: Array<{ type: string; value: string }> = [];
    for (const v of c.facet_cuisine ?? []) facets.push({ type: 'cuisine', value: v });
    for (const v of c.facet_format ?? []) facets.push({ type: 'format', value: v });
    for (const v of c.facet_atmosphere ?? []) facets.push({ type: 'atmosphere', value: v });
    for (const v of c.facet_occasion ?? []) facets.push({ type: 'occasion', value: v });
    return facets;
  }

  // --- Private ---

  private extractFacets(place: Place): Array<{ type: string; value: string }> {
    const facets: Array<{ type: string; value: string }> = [];
    for (const c of place.facetCuisine ?? []) facets.push({ type: 'cuisine', value: c });
    for (const f of place.facetFormat ?? []) facets.push({ type: 'format', value: f });
    for (const a of place.facetAtmosphere ?? []) facets.push({ type: 'atmosphere', value: a });
    for (const o of place.facetOccasion ?? []) facets.push({ type: 'occasion', value: o });
    return facets;
  }

  private async loadOrCreate(deviceIdHash: string): Promise<TasteProfile> {
    const rows = await this.dataSource.query(
      'SELECT facet_weights, price_pref, neg_counters, signal_count FROM user_taste_profile WHERE device_id_hash = $1',
      [deviceIdHash],
    );

    if (rows.length > 0) {
      return {
        facet_weights: rows[0].facet_weights ?? {},
        price_pref: rows[0].price_pref ?? {},
        neg_counters: rows[0].neg_counters ?? {},
        signal_count: rows[0].signal_count ?? 0,
      };
    }

    return { facet_weights: {}, price_pref: {}, neg_counters: {}, signal_count: 0 };
  }

  private async save(deviceIdHash: string, profile: TasteProfile): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO user_taste_profile (device_id_hash, facet_weights, price_pref, neg_counters, signal_count, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (device_id_hash) DO UPDATE SET
        facet_weights = $2, price_pref = $3, neg_counters = $4, signal_count = $5, updated_at = NOW()
    `, [
      deviceIdHash,
      JSON.stringify(profile.facet_weights),
      JSON.stringify(profile.price_pref),
      JSON.stringify(profile.neg_counters),
      profile.signal_count,
    ]);
  }

  private recalcPriceStats(pref: { histogram?: number[]; mu?: number; sigma?: number }): void {
    const h = pref.histogram;
    if (!h) return;
    const total = h.reduce((s, v) => s + v, 0);
    if (total === 0) return;
    pref.mu = h.reduce((s, v, i) => s + v * (i + 1), 0) / total;
    const variance = h.reduce((s, v, i) => s + v * Math.pow(i + 1 - pref.mu!, 2), 0) / total;
    pref.sigma = Math.sqrt(variance) || 1.0;
  }

  private idfCache: Map<string, number> | null = null;
  private idfCacheTime = 0;

  private async loadIdf(): Promise<Map<string, number>> {
    // Cache IDF for 5 minutes
    if (this.idfCache && Date.now() - this.idfCacheTime < 300000) return this.idfCache;

    const rows = await this.dataSource.query('SELECT facet_key, idf FROM facet_idf');
    this.idfCache = new Map(rows.map((r: any) => [r.facet_key, Number(r.idf)]));
    this.idfCacheTime = Date.now();
    return this.idfCache;
  }
}
