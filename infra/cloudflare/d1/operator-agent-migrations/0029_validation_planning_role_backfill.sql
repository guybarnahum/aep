-- Ensure canonical planned validation roles exist after employee ID
-- canonicalization, even in environments that missed the original
-- emp_validation_* seeds before pm003/qa001 became canonical.

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
) VALUES
  (
    'pm003',
    'company_internal_aep',
    'team_validation',
    'Validation PM',
    'validation-pm',
    'planned',
    'manual_only',
    '2026-04-02T00:00:00.000Z',
    '2026-04-02T00:00:00.000Z',
    'active',
    0
  ),
  (
    'qa001',
    'company_internal_aep',
    'team_validation',
    'Validation Engineer',
    'validation-engineer',
    'planned',
    'manual_only',
    '2026-04-02T00:00:00.000Z',
    '2026-04-02T00:00:00.000Z',
    'active',
    0
  );

UPDATE employees_catalog
SET
  company_id = 'company_internal_aep',
  team_id = 'team_validation',
  employee_name = 'Validation PM',
  role_id = 'validation-pm',
  status = 'planned',
  scheduler_mode = 'manual_only',
  employment_status = 'active',
  is_synthetic = 0,
  updated_at = '2026-04-02T00:00:00.000Z'
WHERE id = 'pm003';

UPDATE employees_catalog
SET
  company_id = 'company_internal_aep',
  team_id = 'team_validation',
  employee_name = 'Validation Engineer',
  role_id = 'validation-engineer',
  status = 'planned',
  scheduler_mode = 'manual_only',
  employment_status = 'active',
  is_synthetic = 0,
  updated_at = '2026-04-02T00:00:00.000Z'
WHERE id = 'qa001';

INSERT OR IGNORE INTO employee_scope_bindings (
  binding_id,
  employee_id,
  tenant_id,
  service_id,
  environment_name,
  created_at
) VALUES
  (
    'scope_pm003_async_validation',
    'pm003',
    'tenant_async_validation',
    NULL,
    'async_validation',
    '2026-04-02T00:00:00.000Z'
  ),
  (
    'scope_qa001_async_validation',
    'qa001',
    'tenant_async_validation',
    NULL,
    'async_validation',
    '2026-04-02T00:00:00.000Z'
  );

INSERT OR IGNORE INTO employee_visual_identity (
  employee_id,
  public_appearance_summary,
  birth_year,
  avatar_asset_url,
  visual_base_prompt,
  portrait_prompt
) VALUES
  (
    'pm003',
    'Early-40s, structured, analytical, validation-planning presence.',
    1984,
    NULL,
    'Professional validation PM, analytical, structured, composed organization aesthetic.',
    'Professional portrait of a validation PM, structured, analytical, composed technical organization aesthetic.'
  ),
  (
    'qa001',
    'Mid-30s, analytical, detail-oriented, validation-focused presence.',
    1990,
    NULL,
    'Professional validation engineer, analytical, detail-oriented, technical quality aesthetic.',
    'Professional portrait of a validation engineer, analytical, precise, understated quality engineering aesthetic.'
  );

INSERT OR IGNORE INTO employee_employment_events (
  event_id,
  employee_id,
  event_type,
  to_team_id,
  to_role_id,
  effective_at,
  reason,
  approved_by
) VALUES
  (
    'evt_hire_pm003',
    'pm003',
    'hired',
    'team_validation',
    'validation-pm',
    '2026-04-02T00:00:00.000Z',
    'Validation PM canonical backfill',
    'system'
  ),
  (
    'evt_hire_qa001',
    'qa001',
    'hired',
    'team_validation',
    'validation-engineer',
    '2026-04-02T00:00:00.000Z',
    'Validation engineer canonical backfill',
    'system'
  );