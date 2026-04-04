CREATE TABLE IF NOT EXISTS validation_runs (
  id TEXT PRIMARY KEY,
  validation_type TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  status TEXT NOT NULL,
  target_base_url TEXT NOT NULL,
  result_id TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_validation_runs_created_at
  ON validation_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_validation_runs_status
  ON validation_runs(status);

CREATE INDEX IF NOT EXISTS idx_validation_runs_validation_type
  ON validation_runs(validation_type);

CREATE INDEX IF NOT EXISTS idx_validation_runs_assigned_to
  ON validation_runs(assigned_to);