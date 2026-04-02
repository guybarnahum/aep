CREATE TABLE deploy_job_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  status TEXT NOT NULL,
  callback_token_hash TEXT NOT NULL,
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  superseded_at TEXT,
  UNIQUE(job_id, attempt_no)
);

ALTER TABLE deploy_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE deploy_jobs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deploy_jobs ADD COLUMN active_attempt_no INTEGER;
ALTER TABLE deploy_jobs ADD COLUMN terminal_attempt_no INTEGER;
ALTER TABLE deploy_jobs ADD COLUMN last_dispatched_at TEXT;

CREATE INDEX idx_deploy_job_attempts_job_id
  ON deploy_job_attempts(job_id);

CREATE INDEX idx_deploy_job_attempts_status
  ON deploy_job_attempts(status);