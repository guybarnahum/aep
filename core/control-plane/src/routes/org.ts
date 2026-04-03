import { json, notFound } from "@aep/control-plane/lib/http";
import {
  getCompany,
  getEmployeeCatalogEntry,
  getOrgTenant,
  getServiceCatalogEntry,
  getTeam,
  listCompanies,
  listEmployeesCatalog,
  listEmployeeScopeBindings,
  listOrgTenants,
  listServicesCatalog,
  listTeams,
  listTenantEnvironments,
} from "@aep/control-plane/org/store";

type EnvLike = {
  DB: D1Database;
};

export async function handleCompaniesRoute(
  _request: Request,
  env: EnvLike,
): Promise<Response> {
  const companies = await listCompanies(env.DB);
  return json({ companies });
}

export async function handleCompanyDetailRoute(
  _request: Request,
  env: EnvLike,
  companyId: string,
): Promise<Response> {
  const company = await getCompany(env.DB, companyId);
  if (!company) {
    return notFound(`company not found: ${companyId}`);
  }
  return json(company);
}

export async function handleTeamsRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const teams = await listTeams(env.DB, companyId);
  return json({ teams });
}

export async function handleTeamDetailRoute(
  _request: Request,
  env: EnvLike,
  teamId: string,
): Promise<Response> {
  const team = await getTeam(env.DB, teamId);
  if (!team) {
    return notFound(`team not found: ${teamId}`);
  }
  return json(team);
}

export async function handleOrgTenantsRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const tenants = await listOrgTenants(env.DB, companyId);
  return json({ tenants });
}

export async function handleOrgTenantDetailRoute(
  _request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  const tenant = await getOrgTenant(env.DB, tenantId);
  if (!tenant) {
    return notFound(`org tenant not found: ${tenantId}`);
  }
  return json(tenant);
}

export async function handleTenantEnvironmentsRoute(
  _request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  const tenant = await getOrgTenant(env.DB, tenantId);
  if (!tenant) {
    return notFound(`org tenant not found: ${tenantId}`);
  }

  const environments = await listTenantEnvironments(env.DB, tenantId);
  return json({
    tenant_id: tenantId,
    environments,
  });
}

export async function handleServicesRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  const url = new URL(request.url);
  const services = await listServicesCatalog(env.DB, {
    companyId: url.searchParams.get("companyId") ?? undefined,
    tenantId: url.searchParams.get("tenantId") ?? undefined,
    teamId: url.searchParams.get("teamId") ?? undefined,
  });
  return json({ services });
}

export async function handleServiceDetailRoute(
  _request: Request,
  env: EnvLike,
  serviceId: string,
): Promise<Response> {
  const service = await getServiceCatalogEntry(env.DB, serviceId);
  if (!service) {
    return notFound(`service not found: ${serviceId}`);
  }
  return json(service);
}

export async function handleEmployeesCatalogRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  const url = new URL(request.url);
  const employees = await listEmployeesCatalog(env.DB, {
    companyId: url.searchParams.get("companyId") ?? undefined,
    teamId: url.searchParams.get("teamId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  return json({ employees });
}

export async function handleEmployeeCatalogDetailRoute(
  _request: Request,
  env: EnvLike,
  employeeId: string,
): Promise<Response> {
  const employee = await getEmployeeCatalogEntry(env.DB, employeeId);
  if (!employee) {
    return notFound(`employee not found: ${employeeId}`);
  }
  return json(employee);
}

export async function handleEmployeeScopeRoute(
  _request: Request,
  env: EnvLike,
  employeeId: string,
): Promise<Response> {
  const employee = await getEmployeeCatalogEntry(env.DB, employeeId);
  if (!employee) {
    return notFound(`employee not found: ${employeeId}`);
  }

  const scopeBindings = await listEmployeeScopeBindings(env.DB, employeeId);
  return json({
    employee_id: employeeId,
    scope_bindings: scopeBindings,
  });
}