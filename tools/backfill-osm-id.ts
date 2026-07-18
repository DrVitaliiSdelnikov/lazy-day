/**
 * Backfill osm_id on venues from source_refs table.
 * source_refs already has (entity_id → osm externalId) mapping from the import.
 *
 * Usage: npx tsx tools/backfill-osm-id.ts
 */

import { DataSource } from 'typeorm';

const DB_URL = process.env['DATABASE_URL'] || 'postgresql://lazyday:lazyday_dev@localhost:5434/lazyday';

async function main() {
  const ds = new DataSource({ type: 'postgres', url: DB_URL, synchronize: false });
  await ds.initialize();

  // source_refs has: entity_type='venue', source='osm', external_id='node/12345' or 'way/67890'
  const refs = await ds.query(`
    SELECT entity_id, external_id
    FROM source_refs
    WHERE entity_type = 'venue' AND source = 'osm' AND external_id IS NOT NULL
  `);

  console.log(`Found ${refs.length} source_refs for venues`);

  let updated = 0, skipped = 0, errors = 0;

  for (const ref of refs) {
    const parts = ref.external_id.split('/');
    if (parts.length !== 2) { skipped++; continue; }

    const [osmType, osmIdStr] = parts;
    const osmId = parseInt(osmIdStr, 10);
    if (isNaN(osmId)) { skipped++; continue; }

    try {
      const result = await ds.query(
        `UPDATE venues SET osm_id = $1, osm_type = $2 WHERE id = $3 AND osm_id IS NULL`,
        [osmId, osmType, ref.entity_id],
      );
      if (result[1] > 0) updated++;
      else skipped++;
    } catch (e: any) {
      errors++;
      if (errors <= 5) console.error(`Error on ${ref.entity_id}:`, e.message);
    }
  }

  console.log(`Done: ${updated} updated, ${skipped} skipped, ${errors} errors`);

  // Verify
  const counts = await ds.query(`
    SELECT COUNT(*) as total, COUNT(osm_id) as with_osm FROM venues
  `);
  console.log('Coverage:', counts[0]);

  await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
