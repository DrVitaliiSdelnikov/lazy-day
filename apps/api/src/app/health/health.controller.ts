import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdminGuard } from '../guards/admin.guard';

const MIGRATIONS: { name: string; sql: string }[] = [
  { name: '001', sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` },
  { name: '002', sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN CREATE TYPE source_type AS ENUM ('google_places','osm','tkt_ge','jsonld','ics','bandsintown','manual'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_type') THEN CREATE TYPE entity_type AS ENUM ('place','event','venue'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN CREATE TYPE event_status AS ENUM ('scheduled','postponed','cancelled','past'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_type') THEN CREATE TYPE company_type AS ENUM ('solo','couple','family','friends'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interaction_action') THEN CREATE TYPE interaction_action AS ENUM ('impression','click','save','hide','share','clickout'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dedup_status') THEN CREATE TYPE dedup_status AS ENUM ('pending','merged','rejected'); END IF; END $$;` },
  { name: '003', sql: `CREATE TABLE IF NOT EXISTS venues (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, name_ka TEXT, name_en TEXT, lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, address TEXT, city TEXT NOT NULL DEFAULT 'tbilisi', website TEXT, phone TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_venues_lat ON venues (lat); CREATE INDEX IF NOT EXISTS idx_venues_lng ON venues (lng); CREATE INDEX IF NOT EXISTS idx_venues_city ON venues (city);` },
  { name: '004', sql: `CREATE TABLE IF NOT EXISTS places (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venue_id UUID REFERENCES venues(id), category TEXT NOT NULL, tags TEXT[] DEFAULT '{}', price_level SMALLINT CHECK (price_level BETWEEN 0 AND 4), opening_hours JSONB, rating NUMERIC(2,1), rating_count INTEGER, photos TEXT[] DEFAULT '{}', indoor BOOLEAN, avg_duration_min INTEGER, quality_score NUMERIC(3,2) DEFAULT 0.5, is_chain BOOLEAN DEFAULT FALSE, chain_key TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_places_category ON places (category); CREATE INDEX IF NOT EXISTS idx_places_tags ON places USING GIN (tags); CREATE INDEX IF NOT EXISTS idx_places_chain ON places (chain_key) WHERE chain_key IS NOT NULL;` },
  { name: '005', sql: `CREATE TABLE IF NOT EXISTS events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venue_id UUID REFERENCES venues(id), title TEXT NOT NULL, title_ka TEXT, title_en TEXT, description TEXT, event_type TEXT, starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ, timezone TEXT DEFAULT 'Asia/Tbilisi', category TEXT NOT NULL, tags TEXT[] DEFAULT '{}', price_min NUMERIC(10,2), price_max NUMERIC(10,2), currency TEXT DEFAULT 'GEL', ticket_url TEXT, ticket_domain TEXT, organizer_name TEXT, poster_url TEXT, poster_hash TEXT, status event_status NOT NULL DEFAULT 'scheduled', quality_score NUMERIC(3,2) DEFAULT 0.5, last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_events_starts ON events (starts_at) WHERE status = 'scheduled'; CREATE INDEX IF NOT EXISTS idx_events_venue ON events (venue_id); CREATE INDEX IF NOT EXISTS idx_events_category ON events (category); CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN (tags); CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);` },
  { name: '006', sql: `CREATE TABLE IF NOT EXISTS source_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), source source_type NOT NULL, external_id TEXT NOT NULL, url TEXT, raw_payload JSONB NOT NULL, content_hash TEXT NOT NULL, fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (source, external_id)); CREATE TABLE IF NOT EXISTS source_refs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), entity_type entity_type NOT NULL, entity_id UUID NOT NULL, source source_type NOT NULL, external_id TEXT NOT NULL, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (entity_type, source, external_id)); CREATE INDEX IF NOT EXISTS idx_source_refs_entity ON source_refs (entity_type, entity_id);` },
  { name: '007', sql: `CREATE TABLE IF NOT EXISTS interactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), device_id TEXT NOT NULL, card_type entity_type NOT NULL, card_id UUID NOT NULL, action interaction_action NOT NULL, session_id TEXT, context JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_interactions_device ON interactions (device_id, created_at); CREATE INDEX IF NOT EXISTS idx_interactions_card ON interactions (card_type, card_id); CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions (session_id);` },
  { name: '008', sql: `CREATE TABLE IF NOT EXISTS recommendation_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id TEXT NOT NULL UNIQUE, device_id TEXT, request_context JSONB NOT NULL, returned_ids UUID[] NOT NULL, ranking_version TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());` },
  { name: '009', sql: `CREATE TABLE IF NOT EXISTS dedup_candidates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), entity_type entity_type NOT NULL, entity_a_id UUID NOT NULL, entity_b_id UUID NOT NULL, confidence NUMERIC(3,2) NOT NULL, match_reasons JSONB, status dedup_status NOT NULL DEFAULT 'pending', resolved_by TEXT, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (entity_type, entity_a_id, entity_b_id)); CREATE INDEX IF NOT EXISTS idx_dedup_pending ON dedup_candidates (status) WHERE status = 'pending';` },
  { name: '010', sql: `ALTER TABLE places ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'; CREATE INDEX IF NOT EXISTS idx_places_status ON places (status);` },
  { name: '011', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_place_id TEXT; CREATE INDEX IF NOT EXISTS idx_venues_google_place_id ON venues (google_place_id); ALTER TABLE places ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'; ALTER TABLE places ADD COLUMN IF NOT EXISTS google_types TEXT[] DEFAULT '{}'; ALTER TABLE places ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1); ALTER TABLE places ADD COLUMN IF NOT EXISTS google_rating_count INTEGER;` },
  { name: '012', sql: `CREATE TABLE IF NOT EXISTS event_sources (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, url TEXT NOT NULL, adapter_type TEXT NOT NULL, last_fetched_at TIMESTAMPTZ, last_event_count INT DEFAULT 0, enabled BOOLEAN DEFAULT true, config JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW()); INSERT INTO event_sources (name, url, adapter_type, config) VALUES ('opera.ge','https://opera.ge/eng/playbill','html_parser','{}'),('ra.co','https://ra.co/events/ge/tbilisi','html_parser','{}'),('fabrika','https://fabrikatbilisi.com/events','html_parser','{}'),('khidi','https://khidi.ge','html_parser','{}') ON CONFLICT (name) DO NOTHING; ALTER TABLE events ADD COLUMN IF NOT EXISTS source TEXT; ALTER TABLE events ADD COLUMN IF NOT EXISTS source_event_id TEXT; CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_dedup ON events (source, source_event_id, starts_at);` },
  { name: '013', sql: `CREATE TABLE IF NOT EXISTS interaction_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), device_id_hash TEXT NOT NULL, session_id UUID NOT NULL, event_type TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, city_id TEXT NOT NULL DEFAULT 'tbilisi', occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), card_position INT, score_breakdown JSONB, explanation_codes TEXT[], context JSONB, consent_state TEXT NOT NULL DEFAULT 'pending'); CREATE INDEX IF NOT EXISTS idx_ie_device ON interaction_events (device_id_hash); CREATE INDEX IF NOT EXISTS idx_ie_target ON interaction_events (target_type, target_id); CREATE INDEX IF NOT EXISTS idx_ie_occurred ON interaction_events (occurred_at); CREATE INDEX IF NOT EXISTS idx_ie_type ON interaction_events (event_type); CREATE TABLE IF NOT EXISTS venue_interaction_stats (venue_id UUID PRIMARY KEY, impressions INT NOT NULL DEFAULT 0, clicks INT NOT NULL DEFAULT 0, saves INT NOT NULL DEFAULT 0, hides INT NOT NULL DEFAULT 0, shares INT NOT NULL DEFAULT 0, been_here INT NOT NULL DEFAULT 0, ctr NUMERIC GENERATED ALWAYS AS (CASE WHEN impressions > 0 THEN (clicks::numeric / impressions) ELSE 0 END) STORED); CREATE TABLE IF NOT EXISTS user_preference_aggregates (device_id_hash TEXT NOT NULL, city_id TEXT NOT NULL DEFAULT 'tbilisi', interest_key TEXT NOT NULL, positive_weight NUMERIC NOT NULL DEFAULT 0, negative_weight NUMERIC NOT NULL DEFAULT 0, last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (device_id_hash, city_id, interest_key));` },
];

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Post('migrate')
  @UseGuards(AdminGuard)
  async migrate() {
    try {
      await this.dataSource.query(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`);
      const applied = await this.dataSource.query('SELECT name FROM _migrations');
      const appliedSet = new Set(applied.map((r: any) => r.name));
      const results: string[] = [];
      for (const m of MIGRATIONS) {
        if (appliedSet.has(m.name)) { results.push(`skip: ${m.name}`); continue; }
        try {
          await this.dataSource.query(m.sql);
          await this.dataSource.query('INSERT INTO _migrations (name) VALUES ($1)', [m.name]);
          results.push(`applied: ${m.name}`);
        } catch (e: any) {
          results.push(`error: ${m.name}: ${e.message}`);
          break;
        }
      }
      return { results };
    } catch (e: any) {
      return { error: e.message, stack: e.stack?.split('\n').slice(0, 3) };
    }
  }

  @Get()
  async check() {
    const db = await this.checkDb();
    const events = await this.checkEventSources();

    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      events,
      uptime: process.uptime(),
    };
  }

  private async checkDb(): Promise<'ok' | 'down'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkEventSources(): Promise<Record<string, { last48h: number; status: string }>> {
    try {
      const rows: { source: string; cnt: string }[] = await this.dataSource.query(
        `SELECT source, COUNT(*) as cnt FROM events
         WHERE created_at > NOW() - INTERVAL '48 hours'
         GROUP BY source`,
      );
      const sources = ['opera_ge', 'google_events', 'yolo_ge'];
      const result: Record<string, { last48h: number; status: string }> = {};
      for (const s of sources) {
        const count = parseInt(rows.find(r => r.source === s)?.cnt ?? '0', 10);
        result[s] = { last48h: count, status: count > 0 ? 'ok' : 'stale' };
      }
      return result;
    } catch {
      return {};
    }
  }
}
