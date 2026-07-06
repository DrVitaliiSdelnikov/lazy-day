/**
 * Run SQL migrations in order against PostgreSQL.
 * Usage: npx tsx tools/run-migrations.ts
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString:
      process.env['DATABASE_URL'] ||
      'postgresql://lazyday:lazyday_dev@localhost:5434/lazyday',
  });

  await client.connect();
  console.log('Connected to database');

  // Create migrations tracking table
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = join(__dirname, '..', 'apps', 'api', 'src', 'app', 'database', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows: applied } = await client.query('SELECT name FROM _migrations');
  const appliedSet = new Set(applied.map((r: { name: string }) => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip: ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`  apply: ${file}`);
    await client.query(sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
  }

  console.log('Migrations complete');
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
