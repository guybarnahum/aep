ALTER TABLE validation_results ADD COLUMN audit_status TEXT;
ALTER TABLE validation_results ADD COLUMN audited_by TEXT;
ALTER TABLE validation_results ADD COLUMN audited_at TEXT;

CREATE INDEX IF NOT EXISTS idx_validation_results_audit_status
  ON validation_results(audit_status);

CREATE INDEX IF NOT EXISTS idx_validation_results_audited_by
  ON validation_results(audited_by);