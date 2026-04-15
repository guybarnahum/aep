CREATE TABLE IF NOT EXISTS thread_external_interaction_policy (
  thread_id TEXT PRIMARY KEY,
  inbound_replies_allowed INTEGER NOT NULL DEFAULT 1,
  external_actions_allowed INTEGER NOT NULL DEFAULT 1,
  allowed_channels_json TEXT,
  allowed_targets_json TEXT,
  allowed_external_actors_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS external_interaction_audit (
  audit_id TEXT PRIMARY KEY,
  thread_id TEXT,
  channel TEXT NOT NULL,
  interaction_kind TEXT NOT NULL,
  external_actor_id TEXT,
  external_message_id TEXT,
  external_action_id TEXT,
  decision TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_external_interaction_audit_thread_id
ON external_interaction_audit(thread_id);

CREATE INDEX IF NOT EXISTS idx_external_interaction_audit_decision
ON external_interaction_audit(decision);

CREATE INDEX IF NOT EXISTS idx_external_interaction_audit_reason_code
ON external_interaction_audit(reason_code);