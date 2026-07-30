import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Facet co-occurrence graph — two sources, two signals:
 *
 * source='places' — structural: which facets physically co-exist on venues.
 *   Computed via PMI (pointwise mutual information) to normalize against
 *   frequent facets like "casual" or "cafe".
 *
 * source='chat_mining' — intentional: which facets people want together.
 *   Seeded from dependency map (11 chat sources, 30K+ messages).
 *   day_trip→baths, food→wine — intent links that don't exist structurally.
 *
 * source='behavior' — future: from real user clicks/saves in the app.
 *   Will eventually outweigh both, but needs traffic first.
 */
@Injectable()
export class CooccurrenceService {
  private readonly logger = new Logger(CooccurrenceService.name);

  constructor(private readonly ds: DataSource) {}

  /**
   * Compute co-occurrence from places facets using PMI (pointwise mutual information).
   * PMI = log2(P(a,b) / (P(a) * P(b))) — high when a+b appear together more than expected.
   * Normalized to 0-1 range via NPMI: PMI / -log2(P(a,b)).
   */
  async computeFromPlaces(): Promise<{ computed: number }> {
    // Step 1: collect all facet arrays per place into a flat facet list per place
    const places: { id: string; facets: string[] }[] = await this.ds.query(`
      SELECT id,
        COALESCE(facet_atmosphere, '{}') || COALESCE(facet_occasion, '{}') ||
        COALESCE(facet_cuisine, '{}') || COALESCE(facet_format, '{}') ||
        CASE WHEN facet_price_tier IS NOT NULL THEN ARRAY['price:' || facet_price_tier] ELSE '{}' END
        AS facets
      FROM places
      WHERE status = 'active' AND facet_atmosphere IS NOT NULL
    `);

    // Prefix facets by type for disambiguation
    const prefixed = places.map(p => ({
      id: p.id,
      facets: [
        ...(p.facets || []).map((f: string) => {
          if (f.startsWith('price:')) return f;
          return f; // already unprefixed in DB, IDF has prefixed keys
        }),
      ].filter(Boolean),
    }));

    const totalPlaces = prefixed.length;
    if (totalPlaces < 10) return { computed: 0 };

    // Step 2: count single facet occurrences and pair co-occurrences
    const facetCount = new Map<string, number>();
    const pairCount = new Map<string, number>();

    for (const p of prefixed) {
      const unique = [...new Set(p.facets)];
      for (const f of unique) {
        facetCount.set(f, (facetCount.get(f) ?? 0) + 1);
      }
      for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
          const key = unique[i] < unique[j] ? `${unique[i]}|${unique[j]}` : `${unique[j]}|${unique[i]}`;
          pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
        }
      }
    }

    // Step 3: compute NPMI for each pair
    const MIN_COOCCURRENCE = 5; // minimum co-occurrence count to be reliable
    const rows: { a: string; b: string; weight: number }[] = [];

    for (const [key, count] of pairCount) {
      if (count < MIN_COOCCURRENCE) continue;

      const [a, b] = key.split('|');
      const pA = (facetCount.get(a) ?? 0) / totalPlaces;
      const pB = (facetCount.get(b) ?? 0) / totalPlaces;
      const pAB = count / totalPlaces;

      if (pA === 0 || pB === 0 || pAB === 0) continue;

      const pmi = Math.log2(pAB / (pA * pB));
      const npmi = pmi / -Math.log2(pAB); // normalize to [-1, 1]

      // Only keep positive associations (co-occur more than expected)
      if (npmi <= 0) continue;

      rows.push({ a, b, weight: Math.round(npmi * 1000) / 1000 });
    }

    // Step 4: write to DB (replace all source='places')
    await this.ds.query(`DELETE FROM facet_cooccurrence WHERE source = 'places'`);

    if (rows.length > 0) {
      const values = rows.map(r =>
        `('${r.a.replace(/'/g, "''")}', '${r.b.replace(/'/g, "''")}', ${r.weight}, 'places', NOW())`
      ).join(',\n');

      await this.ds.query(`
        INSERT INTO facet_cooccurrence (facet_a, facet_b, weight, source, updated_at)
        VALUES ${values}
        ON CONFLICT (facet_a, facet_b, source) DO UPDATE SET weight = EXCLUDED.weight, updated_at = NOW()
      `);
    }

    this.logger.log(`Computed ${rows.length} co-occurrence pairs from ${totalPlaces} places`);
    return { computed: rows.length };
  }

  /**
   * Seed intentional co-occurrence from chat mining dependency map.
   * These are intent links: "people who want X also want Y".
   * Weights are normalized lift from 11 chat sources (30K+ messages).
   */
  async seedFromChatMining(): Promise<{ seeded: number }> {
    // From lazigo-facet-dependency-map.md — reliable links (together ≥ 15, lift > 2)
    // Mapped to our facet vocabulary where possible
    const intentLinks: { a: string; b: string; weight: number }[] = [
      // Hub "Day trip" (outing)
      { a: 'outdoorsy', b: 'scenic', weight: 0.85 },
      { a: 'outdoorsy', b: 'exploring', weight: 0.80 },
      { a: 'exploring', b: 'scenic', weight: 0.75 },
      { a: 'exploring', b: 'traditional', weight: 0.70 },
      // Food hub
      { a: 'georgian', b: 'traditional', weight: 0.75 },
      { a: 'georgian', b: 'live_music', weight: 0.65 },
      { a: 'live_music', b: 'lively', weight: 0.70 },
      { a: 'georgian', b: 'celebration', weight: 0.60 },
      // Walk/relax hub
      { a: 'scenic', b: 'cultural', weight: 0.70 },
      { a: 'scenic', b: 'instagram_worthy', weight: 0.65 },
      { a: 'cultural', b: 'traditional', weight: 0.65 },
      // Date intent chain
      { a: 'romantic', b: 'date', weight: 0.90 },
      { a: 'date', b: 'cozy', weight: 0.70 },
      { a: 'romantic', b: 'scenic', weight: 0.60 },
      // Family intent
      { a: 'family_friendly', b: 'family_outing', weight: 0.85 },
      { a: 'family_outing', b: 'outdoorsy', weight: 0.65 },
      // Solo/work intent
      { a: 'work_friendly', b: 'solo', weight: 0.75 },
      { a: 'work_friendly', b: 'quiet', weight: 0.70 },
      { a: 'solo', b: 'cozy', weight: 0.55 },
      // Nightlife (isolated cluster — separate mode)
      { a: 'lively', b: 'group_friendly', weight: 0.70 },
      { a: 'lively', b: 'trendy', weight: 0.60 },
      { a: 'group_friendly', b: 'friends', weight: 0.80 },
      // Cross-hub bridges
      { a: 'cozy', b: 'casual', weight: 0.50 },
      { a: 'traditional', b: 'family_friendly', weight: 0.55 },
      { a: 'upscale', b: 'date', weight: 0.60 },
    ];

    await this.ds.query(`DELETE FROM facet_cooccurrence WHERE source = 'chat_mining'`);

    if (intentLinks.length > 0) {
      const values = intentLinks.map(r =>
        `('${r.a}', '${r.b}', ${r.weight}, 'chat_mining', NOW())`
      ).join(',\n');

      await this.ds.query(`
        INSERT INTO facet_cooccurrence (facet_a, facet_b, weight, source, updated_at)
        VALUES ${values}
        ON CONFLICT (facet_a, facet_b, source) DO UPDATE SET weight = EXCLUDED.weight, updated_at = NOW()
      `);
    }

    this.logger.log(`Seeded ${intentLinks.length} chat-mining co-occurrence links`);
    return { seeded: intentLinks.length };
  }

  /**
   * Get the full co-occurrence graph, optionally filtered by source.
   */
  async getGraph(source?: string): Promise<{
    edges: { facetA: string; facetB: string; weight: number; source: string }[];
    stats: { places: number; chatMining: number; behavior: number };
  }> {
    const whereClause = source ? `WHERE source = $1` : '';
    const params = source ? [source] : [];

    const edges = await this.ds.query(
      `SELECT facet_a, facet_b, weight, source FROM facet_cooccurrence ${whereClause} ORDER BY weight DESC`,
      params,
    );

    const stats = await this.ds.query(
      `SELECT source, COUNT(*) as count FROM facet_cooccurrence GROUP BY source`,
    );

    return {
      edges: edges.map((e: any) => ({
        facetA: e.facet_a,
        facetB: e.facet_b,
        weight: Number(e.weight),
        source: e.source,
      })),
      stats: {
        places: Number(stats.find((s: any) => s.source === 'places')?.count ?? 0),
        chatMining: Number(stats.find((s: any) => s.source === 'chat_mining')?.count ?? 0),
        behavior: Number(stats.find((s: any) => s.source === 'behavior')?.count ?? 0),
      },
    };
  }

  /**
   * Get suggested next facets for a set of active facets.
   * Combines both sources: max(places_weight, chat_weight) per candidate.
   */
  async suggestNext(activeFacets: string[], limit = 5): Promise<{
    suggestions: { facet: string; score: number; sources: string[] }[];
  }> {
    if (activeFacets.length === 0) return { suggestions: [] };

    const placeholders = activeFacets.map((_, i) => `$${i + 1}`).join(',');

    const rows = await this.ds.query(`
      SELECT
        CASE WHEN facet_a = ANY($1::text[]) THEN facet_b ELSE facet_a END AS suggested,
        source,
        weight
      FROM facet_cooccurrence
      WHERE (facet_a = ANY($1::text[]) OR facet_b = ANY($1::text[]))
        AND NOT (facet_a = ANY($1::text[]) AND facet_b = ANY($1::text[]))
      ORDER BY weight DESC
    `, [activeFacets]);

    // Aggregate: sum weights per suggested facet, track sources
    const agg = new Map<string, { score: number; sources: Set<string> }>();
    for (const r of rows) {
      const entry = agg.get(r.suggested) ?? { score: 0, sources: new Set<string>() };
      entry.score += Number(r.weight);
      entry.sources.add(r.source);
      agg.set(r.suggested, entry);
    }

    const suggestions = [...agg.entries()]
      .filter(([facet]) => !activeFacets.includes(facet))
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit)
      .map(([facet, data]) => ({
        facet,
        score: Math.round(data.score * 1000) / 1000,
        sources: [...data.sources],
      }));

    return { suggestions };
  }
}
