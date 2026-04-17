CREATE TABLE IF NOT EXISTS task_reassignments (
  reassignment_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  from_employee_id TEXT NOT NULL,
  to_employee_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  triggered_by_event_id TEXT,
  thread_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_reassignments_task_id
  ON task_reassignments(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_reassignments_from_employee_id
  ON task_reassignments(from_employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_reassignments_to_employee_id
  ON task_reassignments(to_employee_id, created_at DESC);