-- Ensure canonical web-product planned roles exist after employee ID
-- canonicalization, even in environments that missed the original
-- emp_product_manager_web_01/emp_frontend_engineer_01 seeds before
-- pm002/dv001 became canonical.

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
    'pm002',
    'company_internal_aep',
    'team_web_product',
    'Product Manager Web',
    'product-manager-web',
    'planned',
    'manual_only',
    '2026-04-02T00:00:00.000Z',
    '2026-04-02T00:00:00.000Z',
    'active',
    0
  ),
  (
    'dv001',
    'company_internal_aep',
    'team_web_product',
    'Frontend Engineer',
    'frontend-engineer',
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
  team_id = 'team_web_product',
  employee_name = 'Product Manager Web',
  role_id = 'product-manager-web',
  status = 'planned',
  scheduler_mode = 'manual_only',
  employment_status = 'active',
  is_synthetic = 0,
  updated_at = '2026-04-02T00:00:00.000Z'
WHERE id = 'pm002';

UPDATE employees_catalog
SET
  company_id = 'company_internal_aep',
  team_id = 'team_web_product',
  employee_name = 'Frontend Engineer',
  role_id = 'frontend-engineer',
  status = 'planned',
  scheduler_mode = 'manual_only',
  employment_status = 'active',
  is_synthetic = 0,
  updated_at = '2026-04-02T00:00:00.000Z'
WHERE id = 'dv001';

INSERT OR IGNORE INTO employee_scope_bindings (
  binding_id,
  employee_id,
  tenant_id,
  service_id,
  environment_name,
  created_at
) VALUES
  (
    'scope_pm002_dashboard_preview',
    'pm002',
    'tenant_internal_aep',
    'service_dashboard',
    'preview',
    '2026-04-02T00:00:00.000Z'
  ),
  (
    'scope_dv001_dashboard_preview',
    'dv001',
    'tenant_internal_aep',
    'service_dashboard',
    'preview',
    '2026-04-02T00:00:00.000Z'
  );

INSERT OR IGNORE INTO employee_personas (
  employee_id,
  bio,
  tone,
  skills_json,
  photo_url
) VALUES
  (
    'pm002',
    'A structured web product planner who translates strategy into delivery sequences, clear ownership, and reviewable decisions.',
    'Strategic and clear',
    '["Roadmap Prioritization", "Cross-team Planning", "Delivery Sequencing"]',
    NULL
  ),
  (
    'dv001',
    'A focused frontend engineer who turns scoped work into reviewable product increments while preserving canonical task ownership.',
    'Direct and implementation-focused',
    '["Frontend Implementation", "UI Delivery", "Task Execution"]',
    NULL
  );

INSERT OR IGNORE INTO employee_prompt_profiles (
  employee_id,
  base_prompt,
  decision_style,
  collaboration_style,
  identity_seed,
  portrait_prompt,
  prompt_version,
  status
) VALUES
  (
    'pm002',
    'You are the web product manager inside AEP. You translate product goals into structured plans, explicit dependencies, and bounded coordination. You prioritize clarity, sequencing, and auditability. You do not perform uncontrolled runtime mutation.',
    'strategic_and_structuring',
    'clear_and_alignment_driven',
    'A web-focused product planner who turns goals into crisp, reviewable delivery plans.',
    'Professional web product manager portrait, thoughtful, composed, modern technical product organization aesthetic',
    'v1',
    'draft'
  ),
  (
    'dv001',
    'You are a frontend engineer inside AEP. You implement assigned web product tasks with clear scope control, reviewable outputs, and explicit communication about tradeoffs. You stay within assigned ownership and do not perform uncontrolled mutation.',
    'implementation_and_delivery',
    'direct_and_task_focused',
    'A delivery-focused frontend engineer who values clear scope and reviewable outputs.',
    'Professional frontend engineer portrait, modern, focused, calm technical product aesthetic',
    'v1',
    'draft'
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
    'pm002',
    'Early-40s, strategic, thoughtful, product-oriented presence.',
    1985,
    NULL,
    'Professional web product manager, strategic, thoughtful, modern product organization aesthetic.',
    'Professional portrait of a web product manager, strategic, thoughtful, composed, modern technical product aesthetic.'
  ),
  (
    'dv001',
    'Early-30s, creative, implementation-focused, modern technical presence.',
    1994,
    NULL,
    'Professional frontend engineer, modern, implementation-focused, clean technical aesthetic.',
    'Professional portrait of a frontend engineer, modern, implementation-focused, calm technical aesthetic.'
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
    'evt_hire_pm002',
    'pm002',
    'hired',
    'team_web_product',
    'product-manager-web',
    '2026-04-02T00:00:00.000Z',
    'Web product manager canonical backfill',
    'system'
  ),
  (
    'evt_hire_dv001',
    'dv001',
    'hired',
    'team_web_product',
    'frontend-engineer',
    '2026-04-02T00:00:00.000Z',
    'Frontend engineer canonical backfill',
    'system'
  );
