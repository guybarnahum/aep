ALTER TABLE validation_results ADD COLUMN owner_team TEXT;
ALTER TABLE validation_results ADD COLUMN severity TEXT;
ALTER TABLE validation_results ADD COLUMN escalation_state TEXT;

CREATE INDEX IF NOT EXISTS idx_validation_results_owner_team
  ON validation_results(owner_team);

CREATE INDEX IF NOT EXISTS idx_validation_results_severity
  ON validation_results(severity);

CREATE INDEX IF NOT EXISTS idx_validation_results_escalation_state
  ON validation_results(escalation_state);