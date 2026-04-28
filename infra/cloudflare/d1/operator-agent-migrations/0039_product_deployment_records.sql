CREATE TABLE IF NOT EXISTS product_deployment_records (
  deployment_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_task_id TEXT NOT NULL,
  source_artifact_id TEXT NOT NULL,
  requested_by_employee_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  target_url TEXT,
  external_visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  approval_id TEXT,
  deployment_target_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  deployed_at TEXT,
  failed_at TEXT,
  canceled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_product_deployments_project
  ON product_deployment_records (project_id);

CREATE INDEX IF NOT EXISTS idx_product_deployments_artifact
  ON product_deployment_records (source_artifact_id);

CREATE INDEX IF NOT EXISTS idx_product_deployments_status
  ON product_deployment_records (status);