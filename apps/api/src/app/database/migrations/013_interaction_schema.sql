-- Behavioral data schema: interaction events + aggregated stats.
-- See docs/roadmap.md for context.

-- Extended interaction events (replaces basic interactions table usage)
CREATE TABLE IF NOT EXISTS interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id_hash TEXT NOT NULL,
  session_id UUID NOT NULL,
  event_type TEXT NOT NULL,             -- card_click, save, hide, visited, share, impression
  target_type TEXT NOT NULL,            -- place, event, collection
  target_id TEXT,
  city_id TEXT NOT NULL DEFAULT 'tbilisi',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  card_position INT,
  score_breakdown JSONB,                -- { interest: 0.9, distance: 0.7, ... }
  explanation_codes TEXT[],             -- ['nature_match', 'pet_friendly', 'open_now']
  context JSONB,                        -- { interests, company, hasPet, time, locale }
  consent_state TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_ie_device ON interaction_events (device_id_hash);
CREATE INDEX IF NOT EXISTS idx_ie_target ON interaction_events (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_ie_occurred ON interaction_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_ie_type ON interaction_events (event_type);

-- Per-venue aggregated stats (updated periodically or via triggers)
CREATE TABLE IF NOT EXISTS venue_interaction_stats (
  venue_id UUID PRIMARY KEY,
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  saves INT NOT NULL DEFAULT 0,
  hides INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  been_here INT NOT NULL DEFAULT 0,
  ctr NUMERIC GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN (clicks::numeric / impressions) ELSE 0 END
  ) STORED
);

-- Per-user per-city interest weights (aggregated from interactions)
CREATE TABLE IF NOT EXISTS user_preference_aggregates (
  device_id_hash TEXT NOT NULL,
  city_id TEXT NOT NULL DEFAULT 'tbilisi',
  interest_key TEXT NOT NULL,
  positive_weight NUMERIC NOT NULL DEFAULT 0,
  negative_weight NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id_hash, city_id, interest_key)
);
