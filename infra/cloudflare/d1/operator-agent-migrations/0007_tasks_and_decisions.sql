-- Migration: 0007_tasks_and_decisions.sql
-- Goal: Provide authoritative state for work orders and agentic verdicts.

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  employee_id TEXT,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  verdict TEXT NOT NULL,
  reasoning TEXT,
  evidence_trace_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_team_status ON tasks(team_id, status);
CREATE INDEX IF NOT EXISTS idx_decisions_task ON decisions(task_id);