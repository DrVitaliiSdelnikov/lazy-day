-- Event sources tracking table.
-- See docs/research/events-ingestion-plan.md

CREATE TABLE IF NOT EXISTS event_sources (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  last_fetched_at TIMESTAMPTZ,
  last_event_count INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial sources
INSERT INTO event_sources (name, url, adapter_type, config) VALUES
  ('opera.ge', 'https://opera.ge/eng/playbill', 'html_parser', '{"venueMap":{"Tbilisi Opera and Ballet Theatre":"opera_venue_id"}}'),
  ('ra.co', 'https://ra.co/events/ge/tbilisi', 'html_parser', '{}'),
  ('fabrika', 'https://fabrikatbilisi.com/events', 'html_parser', '{}'),
  ('khidi', 'https://khidi.ge', 'html_parser', '{}')
ON CONFLICT (name) DO NOTHING;

-- Add source tracking columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_dedup ON events (source, source_event_id, starts_at);
