CREATE TABLE IF NOT EXISTS external_thread_projections (
  projection_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  target TEXT NOT NULL,
  external_thread_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_thread_projections_thread_channel_target
ON external_thread_projections(thread_id, channel, target);

CREATE INDEX IF NOT EXISTS idx_external_thread_projections_external_thread_id
ON external_thread_projections(channel, external_thread_id);

CREATE TABLE IF NOT EXISTS external_message_projections (
  projection_id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  target TEXT NOT NULL,
  external_thread_id TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_message_projections_message_channel_target
ON external_message_projections(message_id, channel, target);

CREATE INDEX IF NOT EXISTS idx_external_message_projections_external_message
ON external_message_projections(channel, external_message_id);