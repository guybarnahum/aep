CREATE TABLE IF NOT EXISTS mirror_routing_rules (
  rule_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  thread_kind TEXT,
  message_type TEXT,
  severity TEXT,
  visibility TEXT,
  target_adapter TEXT NOT NULL,
  target_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO mirror_routing_rules (
  rule_id,
  enabled,
  thread_kind,
  message_type,
  severity,
  visibility,
  target_adapter,
  target_key
) VALUES
  (
    'mirror_escalations_to_slack',
    1,
    'escalation',
    NULL,
    NULL,
    NULL,
    'slack',
    'MIRROR_ESCALATIONS_SLACK_CHANNEL'
  ),
  (
    'mirror_approvals_to_slack',
    1,
    'approval',
    NULL,
    NULL,
    NULL,
    'slack',
    'MIRROR_APPROVALS_SLACK_CHANNEL'
  ),
  (
    'mirror_coordination_to_default_slack',
    1,
    'coordination',
    NULL,
    NULL,
    NULL,
    'slack',
    'MIRROR_DEFAULT_SLACK_CHANNEL'
  ),
  (
    'mirror_critical_escalations_to_email',
    1,
    'escalation',
    NULL,
    'critical',
    NULL,
    'email',
    'MIRROR_ESCALATIONS_EMAIL_GROUP'
  );