CREATE TABLE IF NOT EXISTS operator_scheduler_state (
  scheduler_name TEXT PRIMARY KEY,
  team_tick_interval_minutes INTEGER NOT NULL,
  manager_tick_interval_minutes INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);