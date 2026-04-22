INSERT OR IGNORE INTO employees_catalog (
  id,
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
)
SELECT
  'op001',
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
FROM employees_catalog
WHERE id = 'emp_timeout_recovery_01';

INSERT OR IGNORE INTO employees_catalog (
  id,
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
)
SELECT
  'op002',
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
FROM employees_catalog
WHERE id = 'emp_retry_supervisor_01';

INSERT OR IGNORE INTO employees_catalog (
  id,
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
)
SELECT
  'mg001',
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
FROM employees_catalog
WHERE id = 'emp_infra_ops_manager_01';

INSERT OR IGNORE INTO employees_catalog (
  id,
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
)
SELECT
  'pm002',
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
FROM employees_catalog
WHERE id = 'emp_product_manager_web_01';

INSERT OR IGNORE INTO employees_catalog (
  id,
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
)
SELECT
  'dv001',
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
FROM employees_catalog
WHERE id = 'emp_frontend_engineer_01';

INSERT OR IGNORE INTO employees_catalog (
  id,
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
)
SELECT
  'pm003',
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
FROM employees_catalog
WHERE id = 'emp_validation_pm_01';

INSERT OR IGNORE INTO employees_catalog (
  id,
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
)
SELECT
  'qa001',
  company_id,
  team_id,
  employee_name,
  role_id,
  status,
  scheduler_mode,
  created_at,
  updated_at
FROM employees_catalog
WHERE id = 'emp_validation_engineer_01';

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

DELETE FROM employees_catalog WHERE id = 'emp_timeout_recovery_01';
DELETE FROM employees_catalog WHERE id = 'emp_retry_supervisor_01';
DELETE FROM employees_catalog WHERE id = 'emp_infra_ops_manager_01';
DELETE FROM employees_catalog WHERE id = 'emp_product_manager_web_01';
DELETE FROM employees_catalog WHERE id = 'emp_frontend_engineer_01';
DELETE FROM employees_catalog WHERE id = 'emp_validation_pm_01';
DELETE FROM employees_catalog WHERE id = 'emp_validation_engineer_01';