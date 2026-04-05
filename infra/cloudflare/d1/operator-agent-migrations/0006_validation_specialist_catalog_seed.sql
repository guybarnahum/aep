-- Commit 13.x
-- Seed validation specialist catalog and scope bindings for the operator-agent D1 track.
-- This keeps the D1-backed employee scope route aligned with the local
-- reliability-engineer / emp_val_specialist_01 org identity.

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
  'emp_val_specialist_01',
  'company_internal_aep',
  'team_validation',
  'Validation Specialist',
  'reliability-engineer',
  'active',
  'manual_only',
  '2026-04-05T00:00:00.000Z',
  '2026-04-05T00:00:00.000Z'
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
    'scope_emp_val_specialist_01_internal_aep',
    'emp_val_specialist_01',
    'tenant_internal_aep',
    'service_control_plane',
    NULL,
    '2026-04-05T00:00:00.000Z'
  ),
  (
    'scope_emp_val_specialist_01_qa',
    'emp_val_specialist_01',
    'tenant_qa',
    'service_control_plane',
    NULL,
    '2026-04-05T00:00:00.000Z'
  );