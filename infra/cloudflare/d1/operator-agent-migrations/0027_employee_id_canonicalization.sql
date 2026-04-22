INSERT OR IGNORE INTO employees_catalog (
  id,
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at,
  employment_status,
  is_synthetic
)
SELECT
  CASE id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
  END,
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at,
  employment_status,
  is_synthetic
FROM employees_catalog
WHERE id IN (
  'emp_timeout_recovery_01',
  'emp_retry_supervisor_01',
  'emp_infra_ops_manager_01',
  'emp_pm_01',
  'emp_product_manager_web_01',
  'emp_validation_pm_01',
  'emp_frontend_engineer_01',
  'emp_validation_engineer_01',
  'emp_val_specialist_01'
);

UPDATE approvals
SET
  requested_by_employee_id = CASE requested_by_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE requested_by_employee_id
  END,
  executed_by_employee_id = CASE executed_by_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE executed_by_employee_id
  END,
  payload_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(payload_json,
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002'),
  execution_context_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(execution_context_json, ''),
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002')
WHERE requested_by_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR executed_by_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR payload_json LIKE '%emp_%'
   OR execution_context_json LIKE '%emp_%';

DELETE FROM employee_controls
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
  AND EXISTS (
    SELECT 1
    FROM employee_controls canonical
    WHERE canonical.employee_id = CASE employee_controls.employee_id
      WHEN 'emp_timeout_recovery_01' THEN 'op001'
      WHEN 'emp_retry_supervisor_01' THEN 'op002'
      WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
      WHEN 'emp_pm_01' THEN 'pm001'
      WHEN 'emp_product_manager_web_01' THEN 'pm002'
      WHEN 'emp_validation_pm_01' THEN 'pm003'
      WHEN 'emp_frontend_engineer_01' THEN 'dv001'
      WHEN 'emp_validation_engineer_01' THEN 'qa001'
      WHEN 'emp_val_specialist_01' THEN 'qa002'
      ELSE employee_controls.employee_id
    END
  );

UPDATE employee_controls
SET
  employee_id = CASE employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE employee_id
  END,
  updated_by_employee_id = CASE updated_by_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE updated_by_employee_id
  END
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR updated_by_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

UPDATE employee_control_history
SET
  employee_id = CASE employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE employee_id
  END,
  updated_by_employee_id = CASE updated_by_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE updated_by_employee_id
  END
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR updated_by_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

UPDATE escalations
SET
  manager_employee_id = CASE manager_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE manager_employee_id
  END,
  affected_employee_ids_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(affected_employee_ids_json,
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002'),
  execution_context_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(execution_context_json, ''),
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002')
WHERE manager_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR affected_employee_ids_json LIKE '%emp_%'
   OR execution_context_json LIKE '%emp_%';

UPDATE manager_decisions
SET
  manager_employee_id = CASE manager_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE manager_employee_id
  END,
  employee_id = CASE employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE employee_id
  END,
  execution_context_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(execution_context_json, ''),
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002')
WHERE manager_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR execution_context_json LIKE '%emp_%';

UPDATE agent_work_log
SET
  employee_id = CASE employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE employee_id
  END,
  execution_context_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(execution_context_json, ''),
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002')
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR execution_context_json LIKE '%emp_%';

UPDATE employee_budget_counters
SET employee_id = CASE employee_id
  WHEN 'emp_timeout_recovery_01' THEN 'op001'
  WHEN 'emp_retry_supervisor_01' THEN 'op002'
  WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
  WHEN 'emp_pm_01' THEN 'pm001'
  WHEN 'emp_product_manager_web_01' THEN 'pm002'
  WHEN 'emp_validation_pm_01' THEN 'pm003'
  WHEN 'emp_frontend_engineer_01' THEN 'dv001'
  WHEN 'emp_validation_engineer_01' THEN 'qa001'
  WHEN 'emp_val_specialist_01' THEN 'qa002'
  ELSE employee_id
END
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

UPDATE tasks
SET
  employee_id = CASE employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE employee_id
  END,
  owner_employee_id = CASE owner_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE owner_employee_id
  END,
  assigned_employee_id = CASE assigned_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE assigned_employee_id
  END,
  created_by_employee_id = CASE created_by_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE created_by_employee_id
  END,
  payload = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(payload, ''),
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002')
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR owner_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR assigned_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR created_by_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR payload LIKE '%emp_%';

UPDATE decisions
SET employee_id = CASE employee_id
  WHEN 'emp_timeout_recovery_01' THEN 'op001'
  WHEN 'emp_retry_supervisor_01' THEN 'op002'
  WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
  WHEN 'emp_pm_01' THEN 'pm001'
  WHEN 'emp_product_manager_web_01' THEN 'pm002'
  WHEN 'emp_validation_pm_01' THEN 'pm003'
  WHEN 'emp_frontend_engineer_01' THEN 'dv001'
  WHEN 'emp_validation_engineer_01' THEN 'qa001'
  WHEN 'emp_val_specialist_01' THEN 'qa002'
  ELSE employee_id
END
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

UPDATE task_artifacts
SET
  created_by_employee_id = CASE created_by_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE created_by_employee_id
  END,
  content_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(content_json,
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002')
WHERE created_by_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR content_json LIKE '%emp_%';

UPDATE employee_messages
SET
  sender_employee_id = CASE sender_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE sender_employee_id
  END,
  receiver_employee_id = CASE receiver_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE receiver_employee_id
  END,
  payload_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(payload_json,
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002')
WHERE sender_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR receiver_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR payload_json LIKE '%emp_%';

UPDATE message_threads
SET created_by_employee_id = CASE created_by_employee_id
  WHEN 'emp_timeout_recovery_01' THEN 'op001'
  WHEN 'emp_retry_supervisor_01' THEN 'op002'
  WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
  WHEN 'emp_pm_01' THEN 'pm001'
  WHEN 'emp_product_manager_web_01' THEN 'pm002'
  WHEN 'emp_validation_pm_01' THEN 'pm003'
  WHEN 'emp_frontend_engineer_01' THEN 'dv001'
  WHEN 'emp_validation_engineer_01' THEN 'qa001'
  WHEN 'emp_val_specialist_01' THEN 'qa002'
  ELSE created_by_employee_id
END
WHERE created_by_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

DELETE FROM employee_scope_bindings
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
  AND EXISTS (
    SELECT 1
    FROM employee_scope_bindings canonical
    WHERE canonical.binding_id = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(employee_scope_bindings.binding_id,
      'emp_timeout_recovery_01', 'op001'),
      'emp_retry_supervisor_01', 'op002'),
      'emp_infra_ops_manager_01', 'mg001'),
      'emp_pm_01', 'pm001'),
      'emp_product_manager_web_01', 'pm002'),
      'emp_validation_pm_01', 'pm003'),
      'emp_frontend_engineer_01', 'dv001'),
      'emp_validation_engineer_01', 'qa001'),
      'emp_val_specialist_01', 'qa002')
  );

UPDATE employee_scope_bindings
SET
  employee_id = CASE employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE employee_id
  END,
  binding_id = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(binding_id,
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002')
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR binding_id LIKE '%emp_%';

DELETE FROM employee_personas
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
  AND EXISTS (
    SELECT 1
    FROM employee_personas canonical
    WHERE canonical.employee_id = CASE employee_personas.employee_id
      WHEN 'emp_timeout_recovery_01' THEN 'op001'
      WHEN 'emp_retry_supervisor_01' THEN 'op002'
      WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
      WHEN 'emp_pm_01' THEN 'pm001'
      WHEN 'emp_product_manager_web_01' THEN 'pm002'
      WHEN 'emp_validation_pm_01' THEN 'pm003'
      WHEN 'emp_frontend_engineer_01' THEN 'dv001'
      WHEN 'emp_validation_engineer_01' THEN 'qa001'
      WHEN 'emp_val_specialist_01' THEN 'qa002'
      ELSE employee_personas.employee_id
    END
  );

UPDATE employee_personas
SET employee_id = CASE employee_id
  WHEN 'emp_timeout_recovery_01' THEN 'op001'
  WHEN 'emp_retry_supervisor_01' THEN 'op002'
  WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
  WHEN 'emp_pm_01' THEN 'pm001'
  WHEN 'emp_product_manager_web_01' THEN 'pm002'
  WHEN 'emp_validation_pm_01' THEN 'pm003'
  WHEN 'emp_frontend_engineer_01' THEN 'dv001'
  WHEN 'emp_validation_engineer_01' THEN 'qa001'
  WHEN 'emp_val_specialist_01' THEN 'qa002'
  ELSE employee_id
END
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

DELETE FROM employee_prompt_profiles
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
  AND EXISTS (
    SELECT 1
    FROM employee_prompt_profiles canonical
    WHERE canonical.employee_id = CASE employee_prompt_profiles.employee_id
      WHEN 'emp_timeout_recovery_01' THEN 'op001'
      WHEN 'emp_retry_supervisor_01' THEN 'op002'
      WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
      WHEN 'emp_pm_01' THEN 'pm001'
      WHEN 'emp_product_manager_web_01' THEN 'pm002'
      WHEN 'emp_validation_pm_01' THEN 'pm003'
      WHEN 'emp_frontend_engineer_01' THEN 'dv001'
      WHEN 'emp_validation_engineer_01' THEN 'qa001'
      WHEN 'emp_val_specialist_01' THEN 'qa002'
      ELSE employee_prompt_profiles.employee_id
    END
  );

UPDATE employee_prompt_profiles
SET employee_id = CASE employee_id
  WHEN 'emp_timeout_recovery_01' THEN 'op001'
  WHEN 'emp_retry_supervisor_01' THEN 'op002'
  WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
  WHEN 'emp_pm_01' THEN 'pm001'
  WHEN 'emp_product_manager_web_01' THEN 'pm002'
  WHEN 'emp_validation_pm_01' THEN 'pm003'
  WHEN 'emp_frontend_engineer_01' THEN 'dv001'
  WHEN 'emp_validation_engineer_01' THEN 'qa001'
  WHEN 'emp_val_specialist_01' THEN 'qa002'
  ELSE employee_id
END
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

UPDATE employee_public_links
SET employee_id = CASE employee_id
  WHEN 'emp_timeout_recovery_01' THEN 'op001'
  WHEN 'emp_retry_supervisor_01' THEN 'op002'
  WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
  WHEN 'emp_pm_01' THEN 'pm001'
  WHEN 'emp_product_manager_web_01' THEN 'pm002'
  WHEN 'emp_validation_pm_01' THEN 'pm003'
  WHEN 'emp_frontend_engineer_01' THEN 'dv001'
  WHEN 'emp_validation_engineer_01' THEN 'qa001'
  WHEN 'emp_val_specialist_01' THEN 'qa002'
  ELSE employee_id
END
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

DELETE FROM employee_visual_identity
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
  AND EXISTS (
    SELECT 1
    FROM employee_visual_identity canonical
    WHERE canonical.employee_id = CASE employee_visual_identity.employee_id
      WHEN 'emp_timeout_recovery_01' THEN 'op001'
      WHEN 'emp_retry_supervisor_01' THEN 'op002'
      WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
      WHEN 'emp_pm_01' THEN 'pm001'
      WHEN 'emp_product_manager_web_01' THEN 'pm002'
      WHEN 'emp_validation_pm_01' THEN 'pm003'
      WHEN 'emp_frontend_engineer_01' THEN 'dv001'
      WHEN 'emp_validation_engineer_01' THEN 'qa001'
      WHEN 'emp_val_specialist_01' THEN 'qa002'
      ELSE employee_visual_identity.employee_id
    END
  );

UPDATE employee_visual_identity
SET employee_id = CASE employee_id
  WHEN 'emp_timeout_recovery_01' THEN 'op001'
  WHEN 'emp_retry_supervisor_01' THEN 'op002'
  WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
  WHEN 'emp_pm_01' THEN 'pm001'
  WHEN 'emp_product_manager_web_01' THEN 'pm002'
  WHEN 'emp_validation_pm_01' THEN 'pm003'
  WHEN 'emp_frontend_engineer_01' THEN 'dv001'
  WHEN 'emp_validation_engineer_01' THEN 'qa001'
  WHEN 'emp_val_specialist_01' THEN 'qa002'
  ELSE employee_id
END
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

DELETE FROM employee_employment_events
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
  AND EXISTS (
    SELECT 1
    FROM employee_employment_events canonical
    WHERE canonical.event_id = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(employee_employment_events.event_id,
      'emp_timeout_recovery_01', 'op001'),
      'emp_retry_supervisor_01', 'op002'),
      'emp_infra_ops_manager_01', 'mg001'),
      'emp_pm_01', 'pm001'),
      'emp_product_manager_web_01', 'pm002'),
      'emp_validation_pm_01', 'pm003'),
      'emp_frontend_engineer_01', 'dv001'),
      'emp_validation_engineer_01', 'qa001'),
      'emp_val_specialist_01', 'qa002')
  );

UPDATE employee_employment_events
SET
  employee_id = CASE employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE employee_id
  END,
  approved_by = CASE approved_by
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE approved_by
  END,
  event_id = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(event_id,
    'emp_timeout_recovery_01', 'op001'),
    'emp_retry_supervisor_01', 'op002'),
    'emp_infra_ops_manager_01', 'mg001'),
    'emp_pm_01', 'pm001'),
    'emp_product_manager_web_01', 'pm002'),
    'emp_validation_pm_01', 'pm003'),
    'emp_frontend_engineer_01', 'dv001'),
    'emp_validation_engineer_01', 'qa001'),
    'emp_val_specialist_01', 'qa002')
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR approved_by IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR event_id LIKE '%emp_%';

UPDATE task_reassignments
SET
  from_employee_id = CASE from_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE from_employee_id
  END,
  to_employee_id = CASE to_employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE to_employee_id
  END
WHERE from_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR to_employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

UPDATE employee_review_cycles
SET created_by = CASE created_by
  WHEN 'emp_timeout_recovery_01' THEN 'op001'
  WHEN 'emp_retry_supervisor_01' THEN 'op002'
  WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
  WHEN 'emp_pm_01' THEN 'pm001'
  WHEN 'emp_product_manager_web_01' THEN 'pm002'
  WHEN 'emp_validation_pm_01' THEN 'pm003'
  WHEN 'emp_frontend_engineer_01' THEN 'dv001'
  WHEN 'emp_validation_engineer_01' THEN 'qa001'
  WHEN 'emp_val_specialist_01' THEN 'qa002'
  ELSE created_by
END
WHERE created_by IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

UPDATE employee_performance_reviews
SET
  employee_id = CASE employee_id
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE employee_id
  END,
  created_by = CASE created_by
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE created_by
  END,
  approved_by = CASE approved_by
    WHEN 'emp_timeout_recovery_01' THEN 'op001'
    WHEN 'emp_retry_supervisor_01' THEN 'op002'
    WHEN 'emp_infra_ops_manager_01' THEN 'mg001'
    WHEN 'emp_pm_01' THEN 'pm001'
    WHEN 'emp_product_manager_web_01' THEN 'pm002'
    WHEN 'emp_validation_pm_01' THEN 'pm003'
    WHEN 'emp_frontend_engineer_01' THEN 'dv001'
    WHEN 'emp_validation_engineer_01' THEN 'qa001'
    WHEN 'emp_val_specialist_01' THEN 'qa002'
    ELSE approved_by
  END
WHERE employee_id IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR created_by IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01')
   OR approved_by IN ('emp_timeout_recovery_01', 'emp_retry_supervisor_01', 'emp_infra_ops_manager_01', 'emp_pm_01', 'emp_product_manager_web_01', 'emp_validation_pm_01', 'emp_frontend_engineer_01', 'emp_validation_engineer_01', 'emp_val_specialist_01');

DELETE FROM employees_catalog
WHERE id IN (
  'emp_timeout_recovery_01',
  'emp_retry_supervisor_01',
  'emp_infra_ops_manager_01',
  'emp_pm_01',
  'emp_product_manager_web_01',
  'emp_validation_pm_01',
  'emp_frontend_engineer_01',
  'emp_validation_engineer_01',
  'emp_val_specialist_01'
);