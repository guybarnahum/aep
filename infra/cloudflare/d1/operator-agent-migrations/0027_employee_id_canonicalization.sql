PRAGMA foreign_keys = OFF;

CREATE TEMP TABLE employee_id_map (
  old_id TEXT PRIMARY KEY,
  new_id TEXT NOT NULL
);

INSERT INTO employee_id_map (old_id, new_id) VALUES
  ('emp_timeout_recovery_01', 'op001'),
  ('emp_retry_supervisor_01', 'op002'),
  ('emp_infra_ops_manager_01', 'mg001'),
  ('emp_pm_01', 'pm001'),
  ('emp_product_manager_web_01', 'pm002'),
  ('emp_validation_pm_01', 'pm003'),
  ('emp_frontend_engineer_01', 'dv001'),
  ('emp_validation_engineer_01', 'qa001'),
  ('emp_val_specialist_01', 'qa002');

UPDATE approvals
SET
  requested_by_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = requested_by_employee_id),
  executed_by_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = executed_by_employee_id),
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
WHERE requested_by_employee_id IN (SELECT old_id FROM employee_id_map)
   OR executed_by_employee_id IN (SELECT old_id FROM employee_id_map)
   OR payload_json LIKE '%emp_%'
   OR execution_context_json LIKE '%emp_%';

UPDATE employee_controls
SET
  employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id),
  updated_by_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = updated_by_employee_id)
WHERE employee_id IN (SELECT old_id FROM employee_id_map)
   OR updated_by_employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE employee_control_history
SET
  employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id),
  updated_by_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = updated_by_employee_id)
WHERE employee_id IN (SELECT old_id FROM employee_id_map)
   OR updated_by_employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE escalations
SET
  manager_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = manager_employee_id),
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
WHERE manager_employee_id IN (SELECT old_id FROM employee_id_map)
   OR affected_employee_ids_json LIKE '%emp_%'
   OR execution_context_json LIKE '%emp_%';

UPDATE manager_decisions
SET
  manager_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = manager_employee_id),
  employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id),
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
WHERE manager_employee_id IN (SELECT old_id FROM employee_id_map)
   OR employee_id IN (SELECT old_id FROM employee_id_map)
   OR execution_context_json LIKE '%emp_%';

UPDATE agent_work_log
SET
  employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id),
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
WHERE employee_id IN (SELECT old_id FROM employee_id_map)
   OR execution_context_json LIKE '%emp_%';

UPDATE employee_budget_counters
SET employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id)
WHERE employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE tasks
SET
  employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id),
  owner_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = owner_employee_id),
  assigned_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = assigned_employee_id),
  created_by_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = created_by_employee_id),
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
WHERE employee_id IN (SELECT old_id FROM employee_id_map)
   OR owner_employee_id IN (SELECT old_id FROM employee_id_map)
   OR assigned_employee_id IN (SELECT old_id FROM employee_id_map)
   OR created_by_employee_id IN (SELECT old_id FROM employee_id_map)
   OR payload LIKE '%emp_%';

UPDATE decisions
SET employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id)
WHERE employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE task_artifacts
SET
  created_by_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = created_by_employee_id),
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
WHERE created_by_employee_id IN (SELECT old_id FROM employee_id_map)
   OR content_json LIKE '%emp_%';

UPDATE employee_messages
SET
  sender_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = sender_employee_id),
  receiver_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = receiver_employee_id),
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
WHERE sender_employee_id IN (SELECT old_id FROM employee_id_map)
   OR receiver_employee_id IN (SELECT old_id FROM employee_id_map)
   OR payload_json LIKE '%emp_%';

UPDATE message_threads
SET created_by_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = created_by_employee_id)
WHERE created_by_employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE employee_scope_bindings
SET
  employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id),
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
WHERE employee_id IN (SELECT old_id FROM employee_id_map)
   OR binding_id LIKE '%emp_%';

UPDATE employee_personas
SET employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id)
WHERE employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE employee_prompt_profiles
SET employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id)
WHERE employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE employee_public_links
SET employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id)
WHERE employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE employee_visual_identity
SET employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id)
WHERE employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE employee_employment_events
SET
  employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id),
  approved_by = (SELECT new_id FROM employee_id_map WHERE old_id = approved_by),
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
WHERE employee_id IN (SELECT old_id FROM employee_id_map)
   OR approved_by IN (SELECT old_id FROM employee_id_map)
   OR event_id LIKE '%emp_%';

UPDATE task_reassignments
SET
  from_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = from_employee_id),
  to_employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = to_employee_id)
WHERE from_employee_id IN (SELECT old_id FROM employee_id_map)
   OR to_employee_id IN (SELECT old_id FROM employee_id_map);

UPDATE employee_review_cycles
SET created_by = (SELECT new_id FROM employee_id_map WHERE old_id = created_by)
WHERE created_by IN (SELECT old_id FROM employee_id_map);

UPDATE employee_performance_reviews
SET
  employee_id = (SELECT new_id FROM employee_id_map WHERE old_id = employee_id),
  created_by = (SELECT new_id FROM employee_id_map WHERE old_id = created_by),
  approved_by = (SELECT new_id FROM employee_id_map WHERE old_id = approved_by)
WHERE employee_id IN (SELECT old_id FROM employee_id_map)
   OR created_by IN (SELECT old_id FROM employee_id_map)
   OR approved_by IN (SELECT old_id FROM employee_id_map);

UPDATE employees_catalog
SET id = (SELECT new_id FROM employee_id_map WHERE old_id = id)
WHERE id IN (SELECT old_id FROM employee_id_map);

DROP TABLE employee_id_map;

PRAGMA foreign_keys = ON;