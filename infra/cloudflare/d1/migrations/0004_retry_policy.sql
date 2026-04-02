ALTER TABLE deploy_jobs ADD COLUMN next_retry_at TEXT;

CREATE INDEX idx_deploy_jobs_status_next_retry
  ON deploy_jobs(status, next_retry_at);
