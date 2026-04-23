CREATE TABLE IF NOT EXISTS validation_scheduler_state (
  scheduler_name TEXT PRIMARY KEY,
  is_paused INTEGER NOT NULL DEFAULT 0,
  pause_reason TEXT,
  paused_by TEXT,
  paused_at TEXT,
  resumed_by TEXT,
  resumed_at TEXT,
  last_run_requested_by TEXT,
  last_run_requested_at TEXT,
  last_dispatch_batch_id TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO validation_scheduler_state (
  scheduler_name,
  is_paused,
  pause_reason,
  paused_by,
  paused_at,
  resumed_by,
  resumed_at,
  last_run_requested_by,
  last_run_requested_at,
  last_dispatch_batch_id,
  updated_at
) VALUES (
  'employee_validation_scheduler',
  0,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP
);
