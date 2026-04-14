PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- PR7.7 - Thread -> Task delegation provenance
-- ------------------------------------------------------------

ALTER TABLE tasks ADD COLUMN source_thread_id TEXT;
ALTER TABLE tasks ADD COLUMN source_message_id TEXT;
ALTER TABLE tasks ADD COLUMN source_approval_id TEXT;
ALTER TABLE tasks ADD COLUMN source_escalation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_source_thread_id
  ON tasks(source_thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_source_message_id
  ON tasks(source_message_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_source_approval_id
  ON tasks(source_approval_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_source_escalation_id
  ON tasks(source_escalation_id, created_at DESC);