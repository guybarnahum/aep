export interface CompanySummary {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TeamSummary {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  kind: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OrgTenantSummary {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TenantEnvironmentSummary {
  id: string;
  tenant_id: string;
  environment_name: string;
  kind: string;
  status: string;
  deploy_url: string | null;
  operator_agent_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceCatalogSummary {
  id: string;
  company_id: string;
  tenant_id: string | null;
  team_id: string;
  slug: string;
  name: string;
  kind: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCatalogSummary {
  id: string;
  company_id: string;
  team_id: string;
  employee_name: string;
  role_id: string;
  status: string;
  scheduler_mode: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeScopeBindingSummary {
  binding_id: string;
  employee_id: string;
  tenant_id: string | null;
  service_id: string | null;
  environment_name: string | null;
  created_at: string;
}