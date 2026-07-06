CREATE TABLE recommendation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL UNIQUE,
  device_id       TEXT,
  request_context JSONB NOT NULL,
  returned_ids    UUID[] NOT NULL,
  ranking_version TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
