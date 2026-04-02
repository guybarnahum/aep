CREATE VIEW IF NOT EXISTS v_current_employee_controls AS
SELECT
  ec.employee_id,
  ec.state,
  CASE
    WHEN ec.state IN ('disabled_pending_review', 'disabled_by_manager') THEN 1
    ELSE 0
  END AS blocked,
  ec.transition,
  ec.updated_at,
  ec.updated_by_employee_id,
  ec.updated_by_role_id,
  ec.policy_version,
  ec.reason,
  ec.message,
  ec.previous_state,
  ec.review_after,
  ec.expires_at,
  ec.budget_override_json,
  ec.authority_override_json,
  ec.approval_id,
  ec.approval_executed_at,
  ec.approval_execution_id,
  ec.evidence_json
FROM employee_controls ec;
