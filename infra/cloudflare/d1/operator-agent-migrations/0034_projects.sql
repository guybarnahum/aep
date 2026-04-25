CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  intake_request_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  owner_team_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_company_created
  ON projects (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_intake_request
  ON projects (intake_request_id);

CREATE INDEX IF NOT EXISTS idx_projects_owner_team_status
  ON projects (owner_team_id, status);
