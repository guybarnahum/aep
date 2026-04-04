CREATE TABLE IF NOT EXISTS validation_results (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  validation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  executed_by TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_validation_results_created_at
  ON validation_results(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_validation_results_type
  ON validation_results(validation_type);

CREATE INDEX IF NOT EXISTS idx_validation_results_status
  ON validation_results(status);