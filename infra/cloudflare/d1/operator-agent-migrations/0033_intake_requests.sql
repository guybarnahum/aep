CREATE TABLE IF NOT EXISTS intake_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  requested_by TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intake_company_created
  ON intake_requests (company_id, created_at DESC);
