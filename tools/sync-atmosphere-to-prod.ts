/**
 * Sync atmosphere attributes from local DB to prod via osm_id.
 * Requires: A1 (osm_id on both local and prod), migration 018 on prod.
 *
 * Usage:
 *   API_URL=https://api.lazigo.app ADMIN_TOKEN=xxx npx tsx tools/sync-atmosphere-to-prod.ts
 *
 * Or for local testing:
 *   API_URL=http://localhost:3000 ADMIN_TOKEN=test npx tsx tools/sync-atmosphere-to-prod.ts
 */

import { DataSource } from 'typeorm';

const LOCAL_DB = 'postgresql://lazyday:lazyday_dev@localhost:5434/lazyday';
const API_URL = process.env['API_URL'] || 'http://localhost:3000';
const ADMIN_TOKEN = process.env['ADMIN_TOKEN'] || 'test';
const CHUNK_SIZE = 30;

interface EnrichmentRecord {
  osm_id: string;
  osm_type: string;
  google_place_id: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  opening_hours: any;
  attributes: any;
  google_types: string[] | null;
  photos: string[] | null;
  facet_cuisine: string[] | null;
  facet_format: string[] | null;
  facet_price_tier: number | null;
  facet_price_conf: number | null;
}

async function main() {
  const ds = new DataSource({ type: 'postgres', url: LOCAL_DB, synchronize: false });
  await ds.initialize();

  // Export all enriched venues with osm_id
  const rows: EnrichmentRecord[] = await ds.query(`
    SELECT
      v.osm_id, v.osm_type, v.google_place_id,
      p.google_rating, p.google_rating_count,
      p.opening_hours, p.attributes, p.google_types, p.photos,
      p.facet_cuisine, p.facet_format, p.facet_price_tier, p.facet_price_conf
    FROM venues v
    JOIN places p ON p.venue_id = v.id
    WHERE v.osm_id IS NOT NULL
      AND (p.google_rating IS NOT NULL OR p.attributes != '{}' OR p.facet_cuisine IS NOT NULL)
  `);

  console.log(`Exported: ${rows.length} enriched records with osm_id`);
  await ds.destroy();

  // Send in chunks
  let totalUpdated = 0, totalNotFound = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    const response = await fetch(`${API_URL}/v1/admin/ingestion/sync-by-osm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN_TOKEN,
      },
      body: JSON.stringify({ records: chunk }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed: ${response.status} ${text.slice(0, 200)}`);
      continue;
    }

    const result = await response.json();
    totalUpdated += result.updated ?? 0;
    totalNotFound += result.notFound ?? 0;

    if ((i / CHUNK_SIZE) % 10 === 0) {
      process.stdout.write(`chunk ${Math.floor(i / CHUNK_SIZE) + 1}: +${result.updated} `);
    }
  }

  console.log(`\nDone: ${totalUpdated} updated, ${totalNotFound} not found`);
}

main().catch(e => { console.error(e); process.exit(1); });
