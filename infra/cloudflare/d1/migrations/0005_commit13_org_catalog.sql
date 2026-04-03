CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(company_id, slug),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_teams_company_id
  ON teams(company_id);

CREATE TABLE IF NOT EXISTS org_tenants (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(company_id, slug),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_org_tenants_company_id
  ON org_tenants(company_id);

CREATE TABLE IF NOT EXISTS tenant_environments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  deploy_url TEXT,
  operator_agent_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, environment_name),
  FOREIGN KEY (tenant_id) REFERENCES org_tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_environments_tenant_id
  ON tenant_environments(tenant_id);

CREATE TABLE IF NOT EXISTS services_catalog (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  tenant_id TEXT,
  team_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(company_id, slug),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (tenant_id) REFERENCES org_tenants(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_services_catalog_company_id
  ON services_catalog(company_id);

CREATE INDEX IF NOT EXISTS idx_services_catalog_tenant_id
  ON services_catalog(tenant_id);

CREATE INDEX IF NOT EXISTS idx_services_catalog_team_id
  ON services_catalog(team_id);

CREATE TABLE IF NOT EXISTS employees_catalog (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL,
  scheduler_mode TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(company_id, role_id, id),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_employees_catalog_company_id
  ON employees_catalog(company_id);

CREATE INDEX IF NOT EXISTS idx_employees_catalog_team_id
  ON employees_catalog(team_id);

CREATE TABLE IF NOT EXISTS employee_scope_bindings (
  binding_id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  tenant_id TEXT,
  service_id TEXT,
  environment_name TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees_catalog(id),
  FOREIGN KEY (tenant_id) REFERENCES org_tenants(id),
  FOREIGN KEY (service_id) REFERENCES services_catalog(id)
);

CREATE INDEX IF NOT EXISTS idx_employee_scope_bindings_employee_id
  ON employee_scope_bindings(employee_id);

CREATE TABLE IF NOT EXISTS org_policy_overlays (
  id TEXT PRIMARY KEY,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_policy_overlays_target
  ON org_policy_overlays(target_kind, target_id);

INSERT OR IGNORE INTO companies (id, slug, name, status, created_at, updated_at)
VALUES (
  'company_internal_aep',
  'internal-aep',
  'Internal AEP',
  'active',
  '2026-04-02T00:00:00.000Z',
  '2026-04-02T00:00:00.000Z'
);

INSERT OR IGNORE INTO teams (id, company_id, slug, name, kind, status, created_at, updated_at) VALUES
('team_infra', 'company_internal_aep', 'infra', 'Infra', 'operations', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('team_web_product', 'company_internal_aep', 'web-product', 'Web Product', 'product', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('team_validation', 'company_internal_aep', 'validation', 'Validation', 'quality', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z');

INSERT OR IGNORE INTO org_tenants (id, company_id, slug, name, status, created_at, updated_at) VALUES
('tenant_internal_aep', 'company_internal_aep', 'internal-aep', 'Internal AEP Tenant', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('tenant_qa', 'company_internal_aep', 'qa', 'QA Tenant', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('tenant_async_validation', 'company_internal_aep', 'async-validation', 'Async Validation Tenant', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z');

INSERT OR IGNORE INTO tenant_environments (id, tenant_id, environment_name, kind, status, deploy_url, operator_agent_url, created_at, updated_at) VALUES
('env_internal_aep_preview', 'tenant_internal_aep', 'preview', 'preview', 'active', NULL, NULL, '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('env_internal_aep_staging', 'tenant_internal_aep', 'staging', 'staging', 'active', NULL, NULL, '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('env_internal_aep_production', 'tenant_internal_aep', 'production', 'production', 'active', NULL, NULL, '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('env_async_validation', 'tenant_async_validation', 'async_validation', 'validation', 'active', NULL, NULL, '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z');

INSERT OR IGNORE INTO services_catalog (id, company_id, tenant_id, team_id, slug, name, kind, provider, status, created_at, updated_at) VALUES
('service_control_plane', 'company_internal_aep', 'tenant_internal_aep', 'team_infra', 'control-plane', 'Control Plane', 'backend', 'cloudflare', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('service_operator_agent', 'company_internal_aep', 'tenant_internal_aep', 'team_infra', 'operator-agent', 'Operator Agent', 'backend', 'cloudflare', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('service_dashboard', 'company_internal_aep', 'tenant_internal_aep', 'team_web_product', 'dashboard', 'Dashboard', 'frontend', 'cloudflare', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('service_ops_console', 'company_internal_aep', 'tenant_internal_aep', 'team_web_product', 'ops-console', 'Ops Console', 'frontend', 'cloudflare', 'active', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z');

INSERT OR IGNORE INTO employees_catalog (id, company_id, team_id, employee_name, role_id, status, scheduler_mode, created_at, updated_at) VALUES
('emp_timeout_recovery_01', 'company_internal_aep', 'team_infra', 'Timeout Recovery Operator', 'timeout-recovery-operator', 'active', 'cron_and_manual', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('emp_retry_supervisor_01', 'company_internal_aep', 'team_infra', 'Retry Supervisor', 'retry-supervisor', 'active', 'cron_and_manual', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('emp_infra_ops_manager_01', 'company_internal_aep', 'team_infra', 'Infra Ops Manager', 'infra-ops-manager', 'active', 'cron_and_manual', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('emp_product_manager_web_01', 'company_internal_aep', 'team_web_product', 'Product Manager Web', 'product-manager-web', 'planned', 'manual_only', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('emp_frontend_engineer_01', 'company_internal_aep', 'team_web_product', 'Frontend Engineer', 'frontend-engineer', 'planned', 'manual_only', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('emp_validation_pm_01', 'company_internal_aep', 'team_validation', 'Validation PM', 'validation-pm', 'planned', 'manual_only', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
('emp_validation_engineer_01', 'company_internal_aep', 'team_validation', 'Validation Engineer', 'validation-engineer', 'planned', 'manual_only', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z');

INSERT OR IGNORE INTO employee_scope_bindings (binding_id, employee_id, tenant_id, service_id, environment_name, created_at) VALUES
('scope_emp_timeout_recovery_01_internal_aep', 'emp_timeout_recovery_01', 'tenant_internal_aep', 'service_control_plane', NULL, '2026-04-02T00:00:00.000Z'),
('scope_emp_timeout_recovery_01_qa', 'emp_timeout_recovery_01', 'tenant_qa', 'service_control_plane', NULL, '2026-04-02T00:00:00.000Z'),
('scope_emp_retry_supervisor_01_internal_aep', 'emp_retry_supervisor_01', 'tenant_internal_aep', 'service_control_plane', NULL, '2026-04-02T00:00:00.000Z'),
('scope_emp_retry_supervisor_01_qa', 'emp_retry_supervisor_01', 'tenant_qa', 'service_control_plane', NULL, '2026-04-02T00:00:00.000Z'),
('scope_emp_infra_ops_manager_01_internal_aep', 'emp_infra_ops_manager_01', 'tenant_internal_aep', 'service_control_plane', NULL, '2026-04-02T00:00:00.000Z'),
('scope_emp_infra_ops_manager_01_qa', 'emp_infra_ops_manager_01', 'tenant_qa', 'service_control_plane', NULL, '2026-04-02T00:00:00.000Z'),
('scope_emp_product_manager_web_01_dashboard_preview', 'emp_product_manager_web_01', 'tenant_internal_aep', 'service_dashboard', 'preview', '2026-04-02T00:00:00.000Z'),
('scope_emp_frontend_engineer_01_dashboard_preview', 'emp_frontend_engineer_01', 'tenant_internal_aep', 'service_dashboard', 'preview', '2026-04-02T00:00:00.000Z'),
('scope_emp_validation_pm_01_async_validation', 'emp_validation_pm_01', 'tenant_async_validation', NULL, 'async_validation', '2026-04-02T00:00:00.000Z'),
('scope_emp_validation_engineer_01_async_validation', 'emp_validation_engineer_01', 'tenant_async_validation', NULL, 'async_validation', '2026-04-02T00:00:00.000Z');