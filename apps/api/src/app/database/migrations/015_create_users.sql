CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  profile JSONB NOT NULL DEFAULT '{}',
  saved_ids TEXT[] DEFAULT '{}',
  hidden_ids TEXT[] DEFAULT '{}',
  consent_state TEXT NOT NULL DEFAULT 'pending',
  auth_provider TEXT,
  auth_external_id TEXT,
  device_ids TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_auth ON users (auth_provider, auth_external_id)
  WHERE auth_provider IS NOT NULL;
