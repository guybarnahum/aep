-- Ensure product-manager-web is runtime-enabled with pm-agent binding and has
-- a canonical runtime_role_policies row, and that its canonical employee
-- (pm002) is in active status so the runtime-enabled-without-active-employee
-- schema assertion does not fire in fresh / preview environments.
--
-- Context: the role was flipped to runtime_enabled = 1 via the dashboard
-- updateRoleRuntimeCapability API before a migration seeded the corresponding
-- policy row, and pm002 was activated via the dashboard without a migration.
-- This migration makes both state changes durable and idempotent.

UPDATE roles_catalog
SET
  runtime_enabled       = 1,
  implementation_binding = 'pm-agent'
WHERE role_id = 'product-manager-web';

-- Activate pm002 so the "runtime-enabled role must have ≥1 active employee"
-- assertion passes in all environments. scheduler_mode stays manual_only
-- (safe default; change via dashboard when autonomous scheduling is desired).
UPDATE employees_catalog
SET
  status     = 'active',
  updated_at = '2026-04-02T00:00:00.000Z'
WHERE id = 'pm002'
  AND status != 'active';

INSERT OR IGNORE INTO runtime_role_policies (
  role_id,
  authority_json,
  budget_json,
  escalation_json
) VALUES (
  'product-manager-web',
  json_object(
    'allowedOperatorActions', json_array('plan-work', 'create-task-graph'),
    'allowedTenants',          json_array('tenant_internal_aep', 'tenant_qa'),
    'allowedServices',         json_array('service_control_plane'),
    'requireTraceVerification', 0
  ),
  json_object(
    'maxActionsPerScan',           10,
    'maxActionsPerHour',           20,
    'maxActionsPerTenantPerHour',  10,
    'tokenBudgetDaily',             0,
    'runtimeBudgetMsPerScan',   30000,
    'verificationReadsPerAction',   2
  ),
  json_object(
    'onBudgetExhausted',               'notify-human',
    'onRepeatedVerificationFailure',   'notify-human',
    'onProdTenantAction',              'require-manager-approval'
  )
);
