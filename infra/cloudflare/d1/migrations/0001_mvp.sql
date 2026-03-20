PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  service_name TEXT,
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL,
  status TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_trace_id ON workflow_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON workflow_runs(created_at);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error_message TEXT,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_run_id ON workflow_steps(workflow_run_id);

CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  preview_url TEXT,
  created_at TEXT NOT NULL,
  destroyed_at TEXT,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_environments_run_id ON environments(workflow_run_id);

CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  environment_id TEXT NOT NULL,
  deployment_provider TEXT NOT NULL,
  deployment_ref TEXT,
  url TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  destroyed_at TEXT,
  FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deployments_env_id ON deployments(environment_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  step_name TEXT,
  event_type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_trace_id ON events(trace_id);
CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
