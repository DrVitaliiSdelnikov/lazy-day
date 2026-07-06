CREATE TABLE interactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     TEXT NOT NULL,
  card_type     entity_type NOT NULL,
  card_id       UUID NOT NULL,
  action        interaction_action NOT NULL,
  session_id    TEXT,
  context       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_device ON interactions (device_id, created_at);
CREATE INDEX idx_interactions_card ON interactions (card_type, card_id);
CREATE INDEX idx_interactions_session ON interactions (session_id);
