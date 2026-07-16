/**
 * External worker: fetches events from Cloudflare-blocked sources
 * and pushes them to the prod API.
 *
 * Usage:
 *   API_URL=https://api.lazigo.app ADMIN_TOKEN=xxx npx tsx tools/fetch-blocked-events.ts
 *
 * Can run from:
 *   - GitHub Actions (Azure IP, may pass Cloudflare)
 *   - Local machine (Georgian IP, guaranteed to work)
 *   - Any machine with non-datacenter IP
 */

// Import adapters directly — they are self-contained, no DI needed
import { TktGeAdapter } from '../apps/api/src/app/ingestion/event-sources/tkt-ge.adapter';
import { BiletebiGeAdapter } from '../apps/api/src/app/ingestion/event-sources/biletebi-ge.adapter';

const API_URL = process.env['API_URL'] || 'https://api.lazigo.app';
const ADMIN_TOKEN = process.env['ADMIN_TOKEN'] || '';

async function main() {
  if (!ADMIN_TOKEN) {
    console.error('ADMIN_TOKEN env var required');
    process.exit(1);
  }

  const adapters = [new TktGeAdapter(), new BiletebiGeAdapter()];
  let totalFetched = 0;
  let totalErrors = 0;

  for (const adapter of adapters) {
    console.log(`\n--- ${adapter.sourceName} ---`);

    try {
      const events = await adapter.fetch();
      console.log(`Fetched: ${events.length} events`);

      if (events.length === 0) {
        console.log('No events, skipping push');
        continue;
      }

      // Push to prod API
      const response = await fetch(`${API_URL}/v1/admin/ingestion/events/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': ADMIN_TOKEN,
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Push failed: ${response.status} ${text}`);
        totalErrors++;
        continue;
      }

      const result = await response.json();
      console.log(`Push result:`, result);
      totalFetched += events.length;
    } catch (err: any) {
      console.error(`${adapter.sourceName} failed:`, err.message);
      totalErrors++;
    }
  }

  console.log(`\n=== Done: ${totalFetched} events pushed, ${totalErrors} errors ===`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
