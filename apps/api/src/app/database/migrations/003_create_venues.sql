CREATE TABLE venues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  name_ka       TEXT,
  name_en       TEXT,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  address       TEXT,
  city          TEXT NOT NULL DEFAULT 'tbilisi',
  website       TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venues_geo ON venues USING GIST (
  (ST_MakePoint(lng, lat)::geography)
);
CREATE INDEX idx_venues_city ON venues (city);
