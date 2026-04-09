ALTER TABLE org_tenants
  ADD COLUMN is_internal INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_org_tenants_company_internal
  ON org_tenants(company_id, is_internal);

UPDATE org_tenants
SET is_internal = 1
WHERE id IN (
  'tenant_internal_aep',
  'tenant_async_validation',
  'tenant_qa'
);
