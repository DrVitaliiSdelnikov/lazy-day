-- Google Places API enrichment columns.
-- See docs/research/google-places-api-integration.md

-- Venue-level: Google place_id for future lookups
ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_place_id TEXT;
CREATE INDEX IF NOT EXISTS idx_venues_google_place_id ON venues (google_place_id);

-- Place-level: structured attributes from Google
ALTER TABLE places ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';
ALTER TABLE places ADD COLUMN IF NOT EXISTS google_types TEXT[] DEFAULT '{}';
ALTER TABLE places ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1);
ALTER TABLE places ADD COLUMN IF NOT EXISTS google_rating_count INTEGER;

COMMENT ON COLUMN venues.google_place_id IS 'Google Places API place_id for enrichment lookups';
COMMENT ON COLUMN places.attributes IS '{"allowsDogs":true,"goodForChildren":false,"outdoorSeating":true,...}';
COMMENT ON COLUMN places.google_types IS '["restaurant","food","point_of_interest","establishment"]';
