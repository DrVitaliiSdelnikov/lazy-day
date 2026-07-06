CREATE TABLE source_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        source_type NOT NULL,
  external_id   TEXT NOT NULL,
  url           TEXT,
  raw_payload   JSONB NOT NULL,
  content_hash  TEXT NOT NULL,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, external_id)
);

CREATE TABLE source_refs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   entity_type NOT NULL,
  entity_id     UUID NOT NULL,
  source        source_type NOT NULL,
  external_id   TEXT NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, source, external_id)
);

CREATE INDEX idx_source_refs_entity ON source_refs (entity_type, entity_id);
