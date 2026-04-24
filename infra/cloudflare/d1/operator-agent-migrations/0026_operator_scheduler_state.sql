CREATE TABLE IF NOT EXISTS operator_scheduler_state (
  scheduler_name TEXT PRIMARY KEY,
  team_tick_interval_minutes INTEGER NOT NULL,
  manager_tick_interval_minutes INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT OR IGNORE INTO operator_scheduler_state (
  scheduler_name,
  team_tick_interval_minutes,
  manager_tick_interval_minutes,
  updated_at,
  updated_by
) VALUES (
  'operator-agent',
  30,
  60,
  CURRENT_TIMESTAMP,
  NULL
);