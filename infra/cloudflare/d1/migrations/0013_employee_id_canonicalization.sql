PRAGMA foreign_keys = OFF;

UPDATE employee_scope_bindings
SET
  binding_id = REPLACE(binding_id, 'emp_timeout_recovery_01', 'op001'),
  employee_id = CASE
    WHEN employee_id = 'emp_timeout_recovery_01' THEN 'op001'
    ELSE employee_id
  END
WHERE employee_id = 'emp_timeout_recovery_01'
   OR binding_id LIKE '%emp_timeout_recovery_01%';

UPDATE employee_scope_bindings
SET
  binding_id = REPLACE(binding_id, 'emp_retry_supervisor_01', 'op002'),
  employee_id = CASE
    WHEN employee_id = 'emp_retry_supervisor_01' THEN 'op002'
    ELSE employee_id
  END
WHERE employee_id = 'emp_retry_supervisor_01'
   OR binding_id LIKE '%emp_retry_supervisor_01%';

UPDATE employee_scope_bindings
SET
  binding_id = REPLACE(binding_id, 'emp_infra_ops_manager_01', 'mg001'),
  employee_id = CASE
    WHEN employee_id = 'emp_infra_ops_manager_01' THEN 'mg001'
    ELSE employee_id
  END
WHERE employee_id = 'emp_infra_ops_manager_01'
   OR binding_id LIKE '%emp_infra_ops_manager_01%';

UPDATE employee_scope_bindings
SET
  binding_id = REPLACE(binding_id, 'emp_product_manager_web_01', 'pm002'),
  employee_id = CASE
    WHEN employee_id = 'emp_product_manager_web_01' THEN 'pm002'
    ELSE employee_id
  END
WHERE employee_id = 'emp_product_manager_web_01'
   OR binding_id LIKE '%emp_product_manager_web_01%';

UPDATE employee_scope_bindings
SET
  binding_id = REPLACE(binding_id, 'emp_frontend_engineer_01', 'dv001'),
  employee_id = CASE
    WHEN employee_id = 'emp_frontend_engineer_01' THEN 'dv001'
    ELSE employee_id
  END
WHERE employee_id = 'emp_frontend_engineer_01'
   OR binding_id LIKE '%emp_frontend_engineer_01%';

UPDATE employee_scope_bindings
SET
  binding_id = REPLACE(binding_id, 'emp_validation_pm_01', 'pm003'),
  employee_id = CASE
    WHEN employee_id = 'emp_validation_pm_01' THEN 'pm003'
    ELSE employee_id
  END
WHERE employee_id = 'emp_validation_pm_01'
   OR binding_id LIKE '%emp_validation_pm_01%';

UPDATE employee_scope_bindings
SET
  binding_id = REPLACE(binding_id, 'emp_validation_engineer_01', 'qa001'),
  employee_id = CASE
    WHEN employee_id = 'emp_validation_engineer_01' THEN 'qa001'
    ELSE employee_id
  END
WHERE employee_id = 'emp_validation_engineer_01'
   OR binding_id LIKE '%emp_validation_engineer_01%';

UPDATE employees_catalog SET id = 'op001' WHERE id = 'emp_timeout_recovery_01';
UPDATE employees_catalog SET id = 'op002' WHERE id = 'emp_retry_supervisor_01';
UPDATE employees_catalog SET id = 'mg001' WHERE id = 'emp_infra_ops_manager_01';
UPDATE employees_catalog SET id = 'pm002' WHERE id = 'emp_product_manager_web_01';
UPDATE employees_catalog SET id = 'dv001' WHERE id = 'emp_frontend_engineer_01';
UPDATE employees_catalog SET id = 'pm003' WHERE id = 'emp_validation_pm_01';
UPDATE employees_catalog SET id = 'qa001' WHERE id = 'emp_validation_engineer_01';

PRAGMA foreign_keys = ON;