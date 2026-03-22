CREATE TABLE IF NOT EXISTS deploy_jobs (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  result_json TEXT,
  error_message TEXT,
  callback_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deploy_jobs_run_id
  ON deploy_jobs(workflow_run_id);

CREATE INDEX IF NOT EXISTS idx_deploy_jobs_status
  ON deploy_jobs(status);

CREATE INDEX IF NOT EXISTS idx_deploy_jobs_created_at
  ON deploy_jobs(created_at);