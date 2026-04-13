PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- PR6 closeout — durable task artifacts
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS task_artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  created_by_employee_id TEXT,
  summary TEXT,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (artifact_type IN ('plan', 'result', 'evidence'))
);

CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_created_at
  ON task_artifacts(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_artifacts_company_type_created_at
  ON task_artifacts(company_id, artifact_type, created_at DESC);