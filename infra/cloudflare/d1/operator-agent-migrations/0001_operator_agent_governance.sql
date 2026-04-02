PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS approvals (
  approval_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  company_id TEXT,
  task_id TEXT,
  heartbeat_id TEXT,
  department_id TEXT NOT NULL,
  requested_by_employee_id TEXT NOT NULL,
  requested_by_employee_name TEXT,
  requested_by_role_id TEXT NOT NULL,
  source TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT,
  reason TEXT NOT NULL,
  message TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  decision_note TEXT,
  executed_at TEXT,
  execution_id TEXT,
  executed_by_employee_id TEXT,
  executed_by_role_id TEXT,
  execution_context_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_approvals_status_timestamp
  ON approvals(status, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_company_timestamp
  ON approvals(company_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_requester_timestamp
  ON approvals(requested_by_employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_action_timestamp
  ON approvals(action_type, timestamp DESC);

CREATE TABLE IF NOT EXISTS employee_controls (
  employee_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  transition TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by_employee_id TEXT NOT NULL,
  updated_by_role_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  reason TEXT NOT NULL,
  message TEXT NOT NULL,
  previous_state TEXT,
  review_after TEXT,
  expires_at TEXT,
  budget_override_json TEXT,
  authority_override_json TEXT,
  approval_id TEXT,
  approval_executed_at TEXT,
  approval_execution_id TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_row_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_employee_controls_state_updated
  ON employee_controls(state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_controls_approval_id
  ON employee_controls(approval_id);

CREATE TABLE IF NOT EXISTS employee_control_history (
  history_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  updated_by_employee_id TEXT NOT NULL,
  updated_by_role_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  transition TEXT NOT NULL,
  previous_state TEXT,
  next_state TEXT NOT NULL,
  reason TEXT NOT NULL,
  message TEXT NOT NULL,
  review_after TEXT,
  expires_at TEXT,
  budget_override_json TEXT,
  authority_override_json TEXT,
  approval_id TEXT,
  approval_executed_at TEXT,
  approval_execution_id TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (employee_id) REFERENCES employee_controls(employee_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employee_control_history_employee_time
  ON employee_control_history(employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_employee_control_history_transition_time
  ON employee_control_history(transition, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_employee_control_history_approval_id
  ON employee_control_history(approval_id);

CREATE TABLE IF NOT EXISTS escalations (
  escalation_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  company_id TEXT,
  department_id TEXT NOT NULL,
  manager_employee_id TEXT NOT NULL,
  manager_employee_name TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  severity TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT NOT NULL,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  resolution_note TEXT,
  affected_employee_ids_json TEXT NOT NULL,
  message TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  evidence_json TEXT,
  execution_context_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_escalations_state_timestamp
  ON escalations(state, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_severity_timestamp
  ON escalations(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_company_timestamp
  ON escalations(company_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS manager_decisions (
  decision_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  manager_employee_id TEXT NOT NULL,
  manager_employee_name TEXT NOT NULL,
  department_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  approval_required INTEGER NOT NULL DEFAULT 0,
  approval_id TEXT,
  approval_status TEXT,
  approval_gate_status TEXT,
  approval_execution_id TEXT,
  approval_executed_at TEXT,
  evidence_json TEXT,
  execution_context_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_manager_decisions_manager_time
  ON manager_decisions(manager_employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_manager_decisions_employee_time
  ON manager_decisions(employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_manager_decisions_reason_time
  ON manager_decisions(reason, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_manager_decisions_approval_id
  ON manager_decisions(approval_id);

CREATE TABLE IF NOT EXISTS agent_work_log (
  entry_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  trigger TEXT NOT NULL,
  run_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  tenant TEXT,
  service TEXT,
  action TEXT NOT NULL,
  mode TEXT NOT NULL,
  eligible INTEGER NOT NULL,
  reason TEXT NOT NULL,
  result TEXT NOT NULL,
  budget_snapshot_json TEXT NOT NULL,
  trace_evidence_json TEXT,
  error_message TEXT,
  execution_context_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_work_log_employee_time
  ON agent_work_log(employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_work_log_result_time
  ON agent_work_log(result, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_work_log_run_id
  ON agent_work_log(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_work_log_job_id
  ON agent_work_log(job_id);
