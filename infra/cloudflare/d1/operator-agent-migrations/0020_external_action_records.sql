CREATE TABLE IF NOT EXISTS external_action_records (
  id TEXT PRIMARY KEY,
  external_action_id TEXT NOT NULL,
  external_channel TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_action_idempotency
ON external_action_records (external_action_id, external_channel);