PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- PR7.2 — internal message threads + inbox/outbox substrate
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS message_threads (
  thread_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  created_by_employee_id TEXT,
  related_task_id TEXT,
  related_artifact_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'internal',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (visibility IN ('internal', 'org'))
);

CREATE INDEX IF NOT EXISTS idx_message_threads_company_created_at
  ON message_threads(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_threads_related_task
  ON message_threads(related_task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_threads_related_artifact
  ON message_threads(related_artifact_id, created_at DESC);

ALTER TABLE employee_messages ADD COLUMN thread_id TEXT;
ALTER TABLE employee_messages ADD COLUMN subject TEXT;
ALTER TABLE employee_messages ADD COLUMN body TEXT;
ALTER TABLE employee_messages ADD COLUMN source TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE employee_messages ADD COLUMN requires_response INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employee_messages ADD COLUMN related_artifact_id TEXT;

CREATE INDEX IF NOT EXISTS idx_employee_messages_thread_created_at
  ON employee_messages(thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_employee_messages_sender_created_at
  ON employee_messages(sender_employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_messages_receiver_created_at
  ON employee_messages(receiver_employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_messages_related_artifact
  ON employee_messages(related_artifact_id, created_at DESC);