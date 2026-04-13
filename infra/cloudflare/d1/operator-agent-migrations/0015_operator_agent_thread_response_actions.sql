PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- PR7.5 — message-backed human response actions
-- ------------------------------------------------------------

ALTER TABLE employee_messages ADD COLUMN response_action_type TEXT;
ALTER TABLE employee_messages ADD COLUMN response_action_status TEXT;
ALTER TABLE employee_messages ADD COLUMN caused_state_transition INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_employee_messages_response_action_type
  ON employee_messages(response_action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_messages_related_approval_action
  ON employee_messages(related_approval_id, response_action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_messages_related_escalation_action
  ON employee_messages(related_escalation_id, response_action_type, created_at DESC);