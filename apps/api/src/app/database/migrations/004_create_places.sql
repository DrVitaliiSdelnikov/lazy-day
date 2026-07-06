CREATE TABLE places (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        UUID REFERENCES venues(id),
  category        TEXT NOT NULL,
  tags            TEXT[] DEFAULT '{}',
  price_level     SMALLINT CHECK (price_level BETWEEN 0 AND 4),
  opening_hours   JSONB,
  rating          NUMERIC(2,1),
  rating_count    INTEGER,
  photos          TEXT[] DEFAULT '{}',
  indoor          BOOLEAN,
  avg_duration_min INTEGER,
  quality_score   NUMERIC(3,2) DEFAULT 0.5,
  is_chain        BOOLEAN DEFAULT FALSE,
  chain_key       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_places_category ON places (category);
CREATE INDEX idx_places_tags ON places USING GIN (tags);
CREATE INDEX idx_places_chain ON places (chain_key) WHERE chain_key IS NOT NULL;
