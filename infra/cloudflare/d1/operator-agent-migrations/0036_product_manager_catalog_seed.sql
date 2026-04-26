-- Add product manager (Marcus/emp_pm_01) to employee catalog and scope bindings.
-- This ensures emp_pm_01 exists before canonicalization migrations, so it can be
-- properly transformed to pm001. Without this, the schema check expecting 9 employees
-- would fail with only 8 present.

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
) VALUES (
  'emp_pm_01',
  'company_internal_aep',
  'team_infra',
  'Marcus',
  'product-manager',
  'active',
  'manual_only',
  '2026-04-02T00:00:00.000Z',
  '2026-04-02T00:00:00.000Z'
);

INSERT OR IGNORE INTO employee_scope_bindings (
  binding_id,
  employee_id,
  tenant_id,
  service_id,
  environment_name,
  created_at
) VALUES
  (
    'scope_emp_pm_01_internal_aep',
    'emp_pm_01',
    'tenant_internal_aep',
    'service_control_plane',
    NULL,
    '2026-04-02T00:00:00.000Z'
  ),
  (
    'scope_emp_pm_01_qa',
    'emp_pm_01',
    'tenant_qa',
    'service_control_plane',
    NULL,
    '2026-04-02T00:00:00.000Z'
  );
