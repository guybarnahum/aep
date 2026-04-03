import type {
  CompanySummary,
  EmployeeCatalogSummary,
  EmployeeScopeBindingSummary,
  OrgTenantSummary,
  ServiceCatalogSummary,
  TeamSummary,
  TenantEnvironmentSummary,
} from "@aep/control-plane/org/types";

export async function listCompanies(db: D1Database): Promise<CompanySummary[]> {
  const rows = await db.prepare(`SELECT * FROM companies ORDER BY id`).all<CompanySummary>();
  return rows.results ?? [];
}

export async function getCompany(
  db: D1Database,
  companyId: string,
): Promise<CompanySummary | null> {
  return (
    (await db
      .prepare(`SELECT * FROM companies WHERE id = ? LIMIT 1`)
      .bind(companyId)
      .first<CompanySummary>()) ?? null
  );
}

export async function listTeams(
  db: D1Database,
  companyId?: string,
): Promise<TeamSummary[]> {
  const stmt = companyId
    ? db.prepare(`SELECT * FROM teams WHERE company_id = ? ORDER BY id`).bind(companyId)
    : db.prepare(`SELECT * FROM teams ORDER BY id`);
  const rows = await stmt.all<TeamSummary>();
  return rows.results ?? [];
}

export async function getTeam(
  db: D1Database,
  teamId: string,
): Promise<TeamSummary | null> {
  return (
    (await db
      .prepare(`SELECT * FROM teams WHERE id = ? LIMIT 1`)
      .bind(teamId)
      .first<TeamSummary>()) ?? null
  );
}

export async function listOrgTenants(
  db: D1Database,
  companyId?: string,
): Promise<OrgTenantSummary[]> {
  const stmt = companyId
    ? db.prepare(`SELECT * FROM org_tenants WHERE company_id = ? ORDER BY id`).bind(companyId)
    : db.prepare(`SELECT * FROM org_tenants ORDER BY id`);
  const rows = await stmt.all<OrgTenantSummary>();
  return rows.results ?? [];
}

export async function getOrgTenant(
  db: D1Database,
  tenantId: string,
): Promise<OrgTenantSummary | null> {
  return (
    (await db
      .prepare(`SELECT * FROM org_tenants WHERE id = ? LIMIT 1`)
      .bind(tenantId)
      .first<OrgTenantSummary>()) ?? null
  );
}

export async function listTenantEnvironments(
  db: D1Database,
  tenantId: string,
): Promise<TenantEnvironmentSummary[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM tenant_environments WHERE tenant_id = ? ORDER BY environment_name`,
    )
    .bind(tenantId)
    .all<TenantEnvironmentSummary>();
  return rows.results ?? [];
}

export async function listServicesCatalog(
  db: D1Database,
  filters?: { companyId?: string; tenantId?: string; teamId?: string },
): Promise<ServiceCatalogSummary[]> {
  const clauses: string[] = [];
  const bindings: string[] = [];

  if (filters?.companyId) {
    clauses.push(`company_id = ?`);
    bindings.push(filters.companyId);
  }
  if (filters?.tenantId) {
    clauses.push(`tenant_id = ?`);
    bindings.push(filters.tenantId);
  }
  if (filters?.teamId) {
    clauses.push(`team_id = ?`);
    bindings.push(filters.teamId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await db
    .prepare(`SELECT * FROM services_catalog ${where} ORDER BY id`)
    .bind(...bindings)
    .all<ServiceCatalogSummary>();

  return rows.results ?? [];
}

export async function getServiceCatalogEntry(
  db: D1Database,
  serviceId: string,
): Promise<ServiceCatalogSummary | null> {
  return (
    (await db
      .prepare(`SELECT * FROM services_catalog WHERE id = ? LIMIT 1`)
      .bind(serviceId)
      .first<ServiceCatalogSummary>()) ?? null
  );
}

export async function listEmployeesCatalog(
  db: D1Database,
  filters?: { companyId?: string; teamId?: string; status?: string },
): Promise<EmployeeCatalogSummary[]> {
  const clauses: string[] = [];
  const bindings: string[] = [];

  if (filters?.companyId) {
    clauses.push(`company_id = ?`);
    bindings.push(filters.companyId);
  }
  if (filters?.teamId) {
    clauses.push(`team_id = ?`);
    bindings.push(filters.teamId);
  }
  if (filters?.status) {
    clauses.push(`status = ?`);
    bindings.push(filters.status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await db
    .prepare(`SELECT * FROM employees_catalog ${where} ORDER BY id`)
    .bind(...bindings)
    .all<EmployeeCatalogSummary>();

  return rows.results ?? [];
}

export async function getEmployeeCatalogEntry(
  db: D1Database,
  employeeId: string,
): Promise<EmployeeCatalogSummary | null> {
  return (
    (await db
      .prepare(`SELECT * FROM employees_catalog WHERE id = ? LIMIT 1`)
      .bind(employeeId)
      .first<EmployeeCatalogSummary>()) ?? null
  );
}

export async function listEmployeeScopeBindings(
  db: D1Database,
  employeeId: string,
): Promise<EmployeeScopeBindingSummary[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM employee_scope_bindings WHERE employee_id = ? ORDER BY binding_id`,
    )
    .bind(employeeId)
    .all<EmployeeScopeBindingSummary>();

  return rows.results ?? [];
}