-- Add status column to places for filtering out closed/defunct venues.
-- See docs/data-quality.md for context.

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_places_status ON places (status);

COMMENT ON COLUMN places.status IS 'active | closed | permanently_closed';
