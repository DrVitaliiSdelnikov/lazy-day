-- Migration 018: Facets, osm_id, enriched_at, impression_agg, facet_idf
-- Phase A + F1 schema for personalization system

-- A1: osm_id on venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS osm_id BIGINT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS osm_type VARCHAR(8);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_osm ON venues (osm_type, osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venues_coords ON venues (lat, lng);

-- A2: enriched_at
ALTER TABLE places ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- A9/A8: facets on places
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_cuisine TEXT[];
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_format TEXT[];
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_price_tier SMALLINT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_price_conf REAL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_atmosphere TEXT[];
ALTER TABLE places ADD COLUMN IF NOT EXISTS facet_occasion TEXT[];

-- A8: "Спланируй день" schema (fill now, logic later)
ALTER TABLE places ADD COLUMN IF NOT EXISTS typical_duration_min SMALLINT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS time_of_day_fit TEXT[];
ALTER TABLE places ADD COLUMN IF NOT EXISTS venue_role TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS anchor_vs_filler TEXT;

-- A10: IDF table
CREATE TABLE IF NOT EXISTS facet_idf (
  facet_key TEXT PRIMARY KEY,
  idf REAL NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- F1.1: impression aggregates
CREATE TABLE IF NOT EXISTS impression_agg (
  device_id_hash TEXT NOT NULL,
  venue_id UUID NOT NULL,
  unengaged_count SMALLINT NOT NULL DEFAULT 0,
  last_shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engaged BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (device_id_hash, venue_id)
);
CREATE INDEX IF NOT EXISTS idx_impr_device ON impression_agg (device_id_hash);

-- F2.1: user taste profile
CREATE TABLE IF NOT EXISTS user_taste_profile (
  device_id_hash TEXT PRIMARY KEY,
  facet_weights JSONB NOT NULL DEFAULT '{}',
  price_pref JSONB NOT NULL DEFAULT '{}',
  neg_counters JSONB NOT NULL DEFAULT '{}',
  signal_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill enriched_at for already-enriched places
UPDATE places SET enriched_at = NOW() WHERE google_rating IS NOT NULL AND enriched_at IS NULL;
