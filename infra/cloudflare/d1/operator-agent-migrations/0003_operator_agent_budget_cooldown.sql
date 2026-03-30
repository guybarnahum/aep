-- 0003_operator_agent_budget_cooldown.sql
-- Adds tables for D1BudgetEnforcer and D1CooldownStore

CREATE TABLE IF NOT EXISTS employee_budget_counters (
  employee_id TEXT NOT NULL,
  tenant TEXT,
  hour_bucket TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (employee_id, tenant, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_employee_budget_counters_employee_id
  ON employee_budget_counters(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_budget_counters_tenant
  ON employee_budget_counters(tenant);
CREATE INDEX IF NOT EXISTS idx_employee_budget_counters_hour_bucket
  ON employee_budget_counters(hour_bucket);

CREATE TABLE IF NOT EXISTS job_cooldowns (
  job_id TEXT PRIMARY KEY,
  last_action_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_job_cooldowns_last_action_ms
  ON job_cooldowns(last_action_ms);
