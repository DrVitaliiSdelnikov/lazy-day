CREATE TABLE dedup_candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     entity_type NOT NULL,
  entity_a_id     UUID NOT NULL,
  entity_b_id     UUID NOT NULL,
  confidence      NUMERIC(3,2) NOT NULL,
  match_reasons   JSONB,
  status          dedup_status NOT NULL DEFAULT 'pending',
  resolved_by     TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_a_id, entity_b_id)
);

CREATE INDEX idx_dedup_pending ON dedup_candidates (status) WHERE status = 'pending';
