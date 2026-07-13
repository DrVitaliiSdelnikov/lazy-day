/**
 * One-time batch translate: Georgian venue names → English via Google Translate API.
 * Usage: GOOGLE_TRANSLATE_KEY=... DATABASE_URL=... npx tsx tools/translate-names.ts
 *
 * What it does:
 * 1. Finds venues where `name` is Georgian and `name_en` is NULL
 * 2. Translates in batches of 50 via Google Cloud Translation API
 * 3. Updates `name_en` in venues table
 * 4. Reports results
 */
import { Client } from 'pg';

const TRANSLATE_KEY = process.env['GOOGLE_TRANSLATE_KEY'];
const DB_URL = process.env['DATABASE_URL'] || 'postgresql://lazyday:lazyday_dev@localhost:5434/lazyday';
const BATCH_SIZE = 50;
const TARGET_LANG = 'en';

if (!TRANSLATE_KEY) {
  console.error('Error: GOOGLE_TRANSLATE_KEY env var required');
  process.exit(1);
}

function isGeorgian(s: string): boolean {
  return /[\u10A0-\u10FF]/.test(s);
}

async function translateBatch(texts: string[]): Promise<string[]> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${TRANSLATE_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: texts,
      source: 'ka',
      target: TARGET_LANG,
      format: 'text',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Translation API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data.translations.map((t: any) => t.translatedText);
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Connected to database');

  // Find venues needing translation
  const { rows } = await client.query(
    `SELECT id, name FROM venues WHERE name_en IS NULL AND name ~ '[\\u10A0-\\u10FF]'`
  );

  // Fallback: check with JS if SQL regex doesn't work
  let venues = rows;
  if (venues.length === 0) {
    const all = await client.query(`SELECT id, name FROM venues WHERE name_en IS NULL`);
    venues = all.rows.filter((r: any) => isGeorgian(r.name));
  }

  console.log(`Found ${venues.length} venues needing translation`);

  if (venues.length === 0) {
    console.log('Nothing to translate!');
    await client.end();
    return;
  }

  let translated = 0;
  let errors = 0;

  for (let i = 0; i < venues.length; i += BATCH_SIZE) {
    const batch = venues.slice(i, i + BATCH_SIZE);
    const names = batch.map((v: any) => v.name);

    try {
      const results = await translateBatch(names);

      for (let j = 0; j < batch.length; j++) {
        const venue = batch[j];
        const translatedName = results[j];

        // Skip if translation is identical to original (no real translation happened)
        if (translatedName === venue.name) continue;

        await client.query(
          `UPDATE venues SET name_en = $1 WHERE id = $2`,
          [translatedName, venue.id],
        );
        translated++;
      }

      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: translated ${results.length} names`);
    } catch (err: any) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, err.message);
      errors++;
    }

    // Rate limit: 100ms between batches
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nDone! Translated: ${translated}, Errors: ${errors}`);
  console.log(`Total venues with name_en: check with:`);
  console.log(`  SELECT COUNT(*) FROM venues WHERE name_en IS NOT NULL;`);

  await client.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
