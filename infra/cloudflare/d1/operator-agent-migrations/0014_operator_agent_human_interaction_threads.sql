PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- PR7.3 — human interaction linkage for approvals/escalations
-- ------------------------------------------------------------

ALTER TABLE message_threads ADD COLUMN related_approval_id TEXT;
ALTER TABLE message_threads ADD COLUMN related_escalation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_message_threads_related_approval
  ON message_threads(related_approval_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_threads_related_escalation
  ON message_threads(related_escalation_id, created_at DESC);