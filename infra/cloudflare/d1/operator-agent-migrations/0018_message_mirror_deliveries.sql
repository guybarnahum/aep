CREATE TABLE IF NOT EXISTS message_mirror_deliveries (
  delivery_id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  external_message_id TEXT,
  failure_code TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_mirror_deliveries_message_id
ON message_mirror_deliveries(message_id);

CREATE INDEX IF NOT EXISTS idx_message_mirror_deliveries_thread_id
ON message_mirror_deliveries(thread_id);