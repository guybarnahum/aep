ALTER TABLE projects
  ADD COLUMN created_by_employee_id TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_created_by_employee
  ON projects (created_by_employee_id);

-- Backfill from intake provenance when available.
UPDATE projects
SET created_by_employee_id = (
  SELECT requested_by
  FROM intake_requests
  WHERE intake_requests.id = projects.intake_request_id
)
WHERE created_by_employee_id IS NULL
  AND intake_request_id IS NOT NULL;

-- Backfill from linked project tasks for direct projects that already have a task graph.
UPDATE projects
SET created_by_employee_id = (
  SELECT created_by_employee_id
  FROM tasks
  WHERE created_by_employee_id IS NOT NULL
    AND json_extract(payload, '$.projectId') = projects.id
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE created_by_employee_id IS NULL;
