CREATE TABLE events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id          UUID REFERENCES venues(id),
  title             TEXT NOT NULL,
  title_ka          TEXT,
  title_en          TEXT,
  description       TEXT,
  event_type        TEXT,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ,
  timezone          TEXT DEFAULT 'Asia/Tbilisi',
  category          TEXT NOT NULL,
  tags              TEXT[] DEFAULT '{}',
  price_min         NUMERIC(10,2),
  price_max         NUMERIC(10,2),
  currency          TEXT DEFAULT 'GEL',
  ticket_url        TEXT,
  ticket_domain     TEXT,
  organizer_name    TEXT,
  poster_url        TEXT,
  poster_hash       TEXT,
  status            event_status NOT NULL DEFAULT 'scheduled',
  quality_score     NUMERIC(3,2) DEFAULT 0.5,
  last_verified_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_starts ON events (starts_at) WHERE status = 'scheduled';
CREATE INDEX idx_events_venue ON events (venue_id);
CREATE INDEX idx_events_category ON events (category);
CREATE INDEX idx_events_tags ON events USING GIN (tags);
CREATE INDEX idx_events_status ON events (status);
