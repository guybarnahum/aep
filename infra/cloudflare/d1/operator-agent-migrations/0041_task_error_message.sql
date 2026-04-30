-- Add error_message column to tasks to surface work-loop failures (e.g. waiting_for_staffing,
-- execution_failed) directly on the task record, so the dashboard can render them without
-- requiring backend log access.
ALTER TABLE tasks ADD COLUMN error_message TEXT;
