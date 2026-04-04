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
  classifyValidationSeverity,
  deriveEscalationState,
  deriveOwnerTeamForValidationType,
  getOwnerForRoute,
  getTeamOwnership,
  getValidationEmployee,
  listValidationEmployees,
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

type ValidationResultRow = {
  id: string;
  team_id: string;
  validation_type: "runtime_read_safety" | "contract_surface" | "ownership_surface";
  status: "passed" | "failed" | "warn";
  executed_by: string;
  summary: string;
  created_at: string;
  owner_team: string | null;
  severity: "info" | "warn" | "failed" | "critical" | null;
  escalation_state: "none" | "assigned" | "escalated" | null;
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

export async function handleValidationEmployeesRoute(
  request: Request,
): Promise<Response> {
  return json({
    employees: listValidationEmployees(),
    _owner: getOwnerForRoute("/validation/employees"),
  });
}

export async function handleValidationEmployeeDetailRoute(
  request: Request,
  employeeId: string,
): Promise<Response> {
  const employee = getValidationEmployee(employeeId);
  if (!employee) {
    return notFound(`validation employee not found: ${employeeId}`);
  }

  return json({
    ...employee,
    _owner: getOwnerForRoute(`/validation/employees/${employeeId}`),
  });
}

async function listPersistedValidationResults(
  db: D1Database,
): Promise<ValidationResultRow[]> {
  const result = await db
    .prepare(
      `SELECT
         id,
         team_id,
         validation_type,
         status,
         executed_by,
         summary,
         created_at,
         owner_team,
         severity,
         escalation_state
       FROM validation_results
       ORDER BY created_at DESC`,
    )
    .all<ValidationResultRow>();

  return result.results ?? [];
}

async function getPersistedValidationResult(
  db: D1Database,
  validationId: string,
): Promise<ValidationResultRow | null> {
  const row = await db
    .prepare(
      `SELECT
         id,
         team_id,
         validation_type,
         status,
         executed_by,
         summary,
         created_at,
         owner_team,
         severity,
         escalation_state
       FROM validation_results
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(validationId)
    .first<ValidationResultRow>();

  return row ?? null;
}

export async function handleValidationResultsRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/results",
    request,
    handler: async () => {
      const results = await listPersistedValidationResults(env.DB);

      return json({
        results: results.map((result) => ({
          validation_id: result.id,
          team_id: result.team_id,
          validation_type: result.validation_type,
          status: result.status,
          executed_by: result.executed_by,
          summary: result.summary,
          created_at: result.created_at,
          owner_team:
            result.owner_team ??
            deriveOwnerTeamForValidationType(result.validation_type),
          severity:
            result.severity ??
            classifyValidationSeverity({
              status: result.status,
              validationType: result.validation_type,
            }),
          escalation_state:
            result.escalation_state ??
            deriveEscalationState({
              severity:
                result.severity ??
                classifyValidationSeverity({
                  status: result.status,
                  validationType: result.validation_type,
                }),
              ownerTeam:
                result.owner_team ??
                deriveOwnerTeamForValidationType(result.validation_type),
            }),
        })),
        _owner: getOwnerForRoute("/validation/results"),
      });
    },
  });
}

export async function handleValidationResultDetailRoute(
  request: Request,
  env: EnvLike,
  validationId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/results/:validationId",
    request,
    resourceId: validationId,
    handler: async () => {
      const result = await getPersistedValidationResult(env.DB, validationId);
      if (!result) {
        return notFound(`validation result not found: ${validationId}`);
      }

      const ownerTeam =
        result.owner_team ??
        deriveOwnerTeamForValidationType(result.validation_type);

      const severity =
        result.severity ??
        classifyValidationSeverity({
          status: result.status,
          validationType: result.validation_type,
        });

      const escalationState =
        result.escalation_state ??
        deriveEscalationState({
          severity,
          ownerTeam,
        });

      return json({
        validation_id: result.id,
        team_id: result.team_id,
        validation_type: result.validation_type,
        status: result.status,
        executed_by: result.executed_by,
        summary: result.summary,
        created_at: result.created_at,
        owner_team: ownerTeam,
        severity,
        escalation_state: escalationState,
        _owner: getOwnerForRoute(`/validation/results/${validationId}`),
      });
    },
  });
}