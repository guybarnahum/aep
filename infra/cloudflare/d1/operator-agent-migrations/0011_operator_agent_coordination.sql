PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- PR6C.1 — Company coordination primitives
-- ------------------------------------------------------------

-- Existing tasks table is already used by operator-agent code.
-- Evolve it additively so old environments can migrate forward.

ALTER TABLE tasks ADD COLUMN originating_team_id TEXT;
ALTER TABLE tasks ADD COLUMN assigned_team_id TEXT;
ALTER TABLE tasks ADD COLUMN owner_employee_id TEXT;
ALTER TABLE tasks ADD COLUMN assigned_employee_id TEXT;
ALTER TABLE tasks ADD COLUMN created_by_employee_id TEXT;
ALTER TABLE tasks ADD COLUMN title TEXT;
ALTER TABLE tasks ADD COLUMN blocking_dependency_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN started_at TEXT;
ALTER TABLE tasks ADD COLUMN completed_at TEXT;
ALTER TABLE tasks ADD COLUMN failed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_company_status
  ON tasks(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_team_status
  ON tasks(assigned_team_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_employee_status
  ON tasks(assigned_employee_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'completion',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (task_id, depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id
  ON task_dependencies(task_id);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on_task_id
  ON task_dependencies(depends_on_task_id);

CREATE TABLE IF NOT EXISTS employee_messages (
  message_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  sender_employee_id TEXT NOT NULL,
  receiver_employee_id TEXT,
  receiver_team_id TEXT,
  message_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  related_task_id TEXT,
  related_escalation_id TEXT,
  related_approval_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (receiver_employee_id IS NOT NULL OR receiver_team_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_employee_messages_receiver_employee_time
  ON employee_messages(receiver_employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_messages_receiver_team_time
  ON employee_messages(receiver_team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_messages_related_task_id
  ON employee_messages(related_task_id, created_at DESC);
