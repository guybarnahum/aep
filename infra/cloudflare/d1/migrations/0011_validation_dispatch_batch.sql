ALTER TABLE validation_runs ADD COLUMN dispatch_batch_id TEXT;
ALTER TABLE validation_results ADD COLUMN dispatch_batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_validation_runs_dispatch_batch_id
  ON validation_runs(dispatch_batch_id);

CREATE INDEX IF NOT EXISTS idx_validation_results_dispatch_batch_id
  ON validation_results(dispatch_batch_id);