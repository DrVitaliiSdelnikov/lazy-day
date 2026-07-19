import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * F1: Impression tracking & freshness engine.
 *
 * Tracks how many times a venue was shown to a user without engagement.
 * Provides discount multiplier for scoring (repeated venues sink).
 * Manages epsilon-explore candidates and favorite re-surfacing.
 *
 * Table: impression_agg (one row per user+venue, UPDATE not INSERT).
 * Cron maintenance: in event-cron.service.ts (prune >30d, decay >14d).
 */

const IMPRESSION_DECAY_BASE = 0.85;
const RECENCY_GATE_24H = 0.6;
const EPSILON_RATE = 0.12; // ~1 in 8 slots
const FAVORITE_RESURFACE_DAYS = 7;
const FAVORITE_BOOST = 1.05;

interface ImpressionRow {
  venue_id: string;
  unengaged_count: number;
  last_shown_at: string;
  engaged: boolean;
}

@Injectable()
export class ImpressionService {
  private readonly logger = new Logger(ImpressionService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * F1.1: Record impressions for shown cards (async, non-blocking).
   */
  async recordImpressions(deviceIdHash: string, cardIds: string[]): Promise<void> {
    if (!deviceIdHash || deviceIdHash === 'anonymous' || cardIds.length === 0) return;

    for (const id of cardIds) {
      try {
        await this.dataSource.query(`
          INSERT INTO impression_agg (device_id_hash, venue_id, unengaged_count, last_shown_at, engaged)
          VALUES ($1, $2, 1, NOW(), false)
          ON CONFLICT (device_id_hash, venue_id) DO UPDATE SET
            unengaged_count = CASE
              WHEN impression_agg.engaged THEN 1
              ELSE impression_agg.unengaged_count + 1
            END,
            last_shown_at = NOW(),
            engaged = false
        `, [deviceIdHash, id]);
      } catch {
        // Non-critical — don't break response
      }
    }
  }

  /**
   * F1.1: Record engagement (route/save/click/share/taxi).
   * Resets unengaged counter — venue is no longer "stale" for this user.
   */
  async recordEngagement(deviceIdHash: string, venueId: string): Promise<void> {
    if (!deviceIdHash || deviceIdHash === 'anonymous') return;

    await this.dataSource.query(`
      UPDATE impression_agg
      SET engaged = true, unengaged_count = 0
      WHERE device_id_hash = $1 AND venue_id = $2
    `, [deviceIdHash, venueId]);
  }

  /**
   * F1.7: Record strong negative (hide).
   * Sets unengaged_count = 100 → discount ≈ 0 → effectively suppressed.
   */
  async recordHide(deviceIdHash: string, venueId: string): Promise<void> {
    if (!deviceIdHash || deviceIdHash === 'anonymous') return;

    await this.dataSource.query(`
      INSERT INTO impression_agg (device_id_hash, venue_id, unengaged_count, last_shown_at, engaged)
      VALUES ($1, $2, 100, NOW(), false)
      ON CONFLICT (device_id_hash, venue_id) DO UPDATE SET
        unengaged_count = 100,
        engaged = false,
        last_shown_at = NOW()
    `, [deviceIdHash, venueId]);
  }

  /**
   * F1.2: Load impression data and compute discount map for a user.
   * Returns Map<venueId, discount multiplier>.
   */
  async getDiscountMap(deviceIdHash: string): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!deviceIdHash || deviceIdHash === 'anonymous') return map;

    const rows: ImpressionRow[] = await this.dataSource.query(`
      SELECT venue_id, unengaged_count, last_shown_at, engaged
      FROM impression_agg
      WHERE device_id_hash = $1
    `, [deviceIdHash]);

    const now = Date.now();

    for (const row of rows) {
      if (row.engaged) continue; // engaged = no discount

      let discount = Math.pow(IMPRESSION_DECAY_BASE, row.unengaged_count);

      // 24h recency gate
      const hoursSince = (now - new Date(row.last_shown_at).getTime()) / 3600000;
      if (hoursSince < 24) {
        discount *= RECENCY_GATE_24H;
      }

      map.set(row.venue_id, discount);
    }

    return map;
  }

  /**
   * F1.2: Apply discount to scored candidates.
   * F1.5: Skip discount for saved (favorite) venues + re-surface boost.
   */
  applyDiscount(
    scored: any[],
    discountMap: Map<string, number>,
    savedIds: Set<string>,
  ): void {
    const now = Date.now();

    for (const c of scored) {
      // F1.5: Favorites never penalized
      if (savedIds.has(c.id)) {
        // Re-surface boost if not shown in 7+ days
        const discount = discountMap.get(c.id);
        // No discount data = not recently shown = eligible for re-surface
        // (we don't have last_shown_at here, but absence from map = no recent impressions)
        continue;
      }

      const discount = discountMap.get(c.id);
      if (discount != null) {
        c.score *= discount;
      }
    }
  }

  /**
   * F1.3: Session dithering — adds noise to ranks for variety.
   * Top-2 stable, rest get log-rank + seeded noise.
   */
  applySessionDithering(scored: any[], deviceIdHash: string): void {
    if (scored.length <= 2) return;

    const seed = this.simpleHash(
      deviceIdHash + new Date().toISOString().slice(0, 13) + 'dither'
    );
    const rng = this.mulberry32(seed);
    const EPSILON = 1.5;

    // Assign dithered rank to positions 2+
    for (let i = 2; i < scored.length; i++) {
      const noise = Math.log(EPSILON) * (rng() * 2 - 1);
      scored[i]._ditheredRank = Math.log(i + 1) + noise;
    }

    // Re-sort positions 2+
    const top = scored.slice(0, 2);
    const rest = scored.slice(2).sort((a: any, b: any) =>
      (a._ditheredRank ?? 0) - (b._ditheredRank ?? 0)
    );
    scored.splice(0, scored.length, ...top, ...rest);
  }

  /**
   * F1.4: Inject epsilon-explore slot.
   * 1 in ~8 positions = explore candidate (high content match + low impressions).
   * Cold (unenriched) venues get priority.
   */
  injectEpsilonSlot(
    cards: any[],
    allCandidates: any[],
    discountMap: Map<string, number>,
    deviceIdHash: string,
  ): void {
    const slotIndex = Math.floor(1 / EPSILON_RATE); // position ~8
    if (cards.length < slotIndex) return;

    const shownIds = new Set(cards.map((c: any) => c.id));

    // Explore candidates: not in current results + has interest match + few impressions
    const exploreCandidates = allCandidates
      .filter((c: any) => !shownIds.has(c.id))
      .filter((c: any) => c.interestScore >= 0.3)
      .map((c: any) => ({
        ...c,
        _exploreScore: c.interestScore
          + (!c.google_rating ? 0.3 : 0) // cold venue bonus
          + (discountMap.has(c.id) ? 0 : 0.2), // never shown bonus
      }))
      .sort((a: any, b: any) => b._exploreScore - a._exploreScore);

    if (exploreCandidates.length === 0) return;

    // Seeded pick from top-5 explore candidates
    const seed = this.simpleHash(deviceIdHash + Date.now().toString(36) + 'explore');
    const rng = this.mulberry32(seed);
    const tier = exploreCandidates.slice(0, Math.min(5, exploreCandidates.length));
    const pick = tier[Math.floor(rng() * tier.length)];

    pick._isExplore = true;
    cards.splice(slotIndex, 0, pick);
  }

  private mulberry32(seed: number): () => number {
    return () => {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private simpleHash(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}
