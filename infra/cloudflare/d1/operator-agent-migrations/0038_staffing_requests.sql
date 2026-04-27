CREATE TABLE IF NOT EXISTS staffing_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  requested_by_employee_id TEXT NOT NULL,
  approved_by_employee_id TEXT,
  status TEXT NOT NULL,
  approval_id TEXT,
  thread_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  approved_at TEXT,
  fulfilled_at TEXT,
  rejected_at TEXT,
  canceled_at TEXT,
  rejection_reason TEXT,
  cancellation_reason TEXT,
  CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  CHECK (source_kind IN ('task', 'project', 'thread', 'role', 'review', 'manager')),
  CHECK (status IN ('draft', 'submitted', 'approved', 'fulfilled', 'rejected', 'canceled'))
);

CREATE INDEX IF NOT EXISTS idx_staffing_requests_company_status
  ON staffing_requests(company_id, status);

CREATE INDEX IF NOT EXISTS idx_staffing_requests_team_status
  ON staffing_requests(team_id, status);

CREATE INDEX IF NOT EXISTS idx_staffing_requests_role_status
  ON staffing_requests(role_id, status);

CREATE INDEX IF NOT EXISTS idx_staffing_requests_source
  ON staffing_requests(source_kind, source_id);
