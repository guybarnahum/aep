import {
  json,
  maybeInjectRuntimeReadFailure,
  notFound,
  withRuntimeJsonBoundary,
} from "@aep/control-plane/lib/http";
import {
  assertRuntimeCompany,
  assertRuntimeService,
  assertRuntimeTeam,
  normalizeCompany,
  normalizeService,
  normalizeTeam,
} from "@aep/runtime-contract/runtime_contract";
import {
  getOwnerForRoute,
  getTeamOwnership,
} from "@aep/control-plane/org/ownership";
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
  APP_ENV?: string;
  VALIDATION_LANE?: string;
  RUNTIME_READ_FAILURE_INJECTION_ENABLED?: string;
};

export async function handleCompaniesRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/companies",
    request,
    handler: async () => {
      maybeInjectRuntimeReadFailure(request, env);

      const companies = (await listCompanies(env.DB))
        .map(normalizeCompany)
        .map(assertRuntimeCompany);
      return json({
        companies,
        _owner: getOwnerForRoute("/companies"),
      });
    },
  });
}

export async function handleCompanyDetailRoute(
  request: Request,
  env: EnvLike,
  companyId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/companies/:companyId",
    request,
    companyId,
    resourceId: companyId,
    handler: async () => {
      const company = await getCompany(env.DB, companyId);
      if (!company) {
        return notFound(`company not found: ${companyId}`);
      }
      return json(company);
    },
  });
}

export async function handleTeamsRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/teams",
    request,
    handler: async () => {
      const url = new URL(request.url);
      const companyId = url.searchParams.get("companyId") ?? undefined;
      const teams = (await listTeams(env.DB, companyId))
        .map(normalizeTeam)
        .map(assertRuntimeTeam);
      return json({
        teams,
        _owner: getOwnerForRoute("/teams"),
      });
    },
  });
}

export async function handleTeamDetailRoute(
  request: Request,
  env: EnvLike,
  teamId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/teams/:teamId",
    request,
    teamId,
    resourceId: teamId,
    handler: async () => {
      const team = await getTeam(env.DB, teamId);
      if (!team) {
        return notFound(`team not found: ${teamId}`);
      }
      return json(team);
    },
  });
}

export async function handleOrgTenantsRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/org/tenants",
    request,
    handler: async () => {
      const url = new URL(request.url);
      const companyId = url.searchParams.get("companyId") ?? undefined;
      const tenants = await listOrgTenants(env.DB, companyId);
      return json({ tenants });
    },
  });
}

export async function handleOrgTenantDetailRoute(
  request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/org/tenants/:tenantId",
    request,
    tenantId,
    resourceId: tenantId,
    handler: async () => {
      const tenant = await getOrgTenant(env.DB, tenantId);
      if (!tenant) {
        return notFound(`org tenant not found: ${tenantId}`);
      }
      return json(tenant);
    },
  });
}

export async function handleTenantEnvironmentsRoute(
  request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/org/tenants/:tenantId/environments",
    request,
    tenantId,
    resourceId: tenantId,
    handler: async () => {
      const tenant = await getOrgTenant(env.DB, tenantId);
      if (!tenant) {
        return notFound(`org tenant not found: ${tenantId}`);
      }

      const environments = await listTenantEnvironments(env.DB, tenantId);
      return json({
        tenant_id: tenantId,
        environments,
      });
    },
  });
}

export async function handleServicesRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/services",
    request,
    handler: async () => {
      const url = new URL(request.url);
      const services = (await listServicesCatalog(env.DB, {
        companyId: url.searchParams.get("companyId") ?? undefined,
        tenantId: url.searchParams.get("tenantId") ?? undefined,
        teamId: url.searchParams.get("teamId") ?? undefined,
      }))
        .map(normalizeService)
        .map(assertRuntimeService);
      return json({
        services,
        _owner: getOwnerForRoute("/services"),
      });
    },
  });
}

export async function handleServiceDetailRoute(
  request: Request,
  env: EnvLike,
  serviceId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/services/:serviceId",
    request,
    serviceId,
    resourceId: serviceId,
    handler: async () => {
      const service = await getServiceCatalogEntry(env.DB, serviceId);
      if (!service) {
        return notFound(`service not found: ${serviceId}`);
      }
      return json(service);
    },
  });
}

export async function handleEmployeesCatalogRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/employees",
    request,
    handler: async () => {
      const url = new URL(request.url);
      const employees = await listEmployeesCatalog(env.DB, {
        companyId: url.searchParams.get("companyId") ?? undefined,
        teamId: url.searchParams.get("teamId") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
      });
      return json({ employees });
    },
  });
}

export async function handleEmployeeCatalogDetailRoute(
  request: Request,
  env: EnvLike,
  employeeId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/employees/:employeeId",
    request,
    employeeId,
    resourceId: employeeId,
    handler: async () => {
      const employee = await getEmployeeCatalogEntry(env.DB, employeeId);
      if (!employee) {
        return notFound(`employee not found: ${employeeId}`);
      }
      return json(employee);
    },
  });
}

export async function handleEmployeeScopeRoute(
  request: Request,
  env: EnvLike,
  employeeId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/employees/:employeeId/scope",
    request,
    employeeId,
    resourceId: employeeId,
    handler: async () => {
      const employee = await getEmployeeCatalogEntry(env.DB, employeeId);
      if (!employee) {
        return notFound(`employee not found: ${employeeId}`);
      }

      const scopeBindings = await listEmployeeScopeBindings(env.DB, employeeId);
      return json({
        employee_id: employeeId,
        scope_bindings: scopeBindings,
      });
    },
  });
}

export async function handleTeamOwnershipRoute(
  request: Request,
  teamId: string,
): Promise<Response> {
  const ownership = getTeamOwnership(teamId);
  if (!ownership) {
    return notFound(`team not found: ${teamId}`);
  }

  return json(ownership);
}

export async function handleValidationRoute(
  request: Request,
): Promise<Response> {
  return json({
    team_id: "team_validation",
    status: "active",
    capabilities: [
      "runtime_read_safety_validation",
      "contract_surface_validation",
      "ownership_surface_validation",
    ],
    _owner: getOwnerForRoute("/validation"),
  });
}