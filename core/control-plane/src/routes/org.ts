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
  assignValidationEmployeeForType,
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

type ValidationRunRow = {
  id: string;
  validation_type: "runtime_read_safety" | "contract_surface" | "ownership_surface";
  requested_by: string;
  assigned_to: string;
  status: "queued" | "running" | "completed" | "failed";
  target_base_url: string;
  result_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type CreateValidationRunBody = {
  validation_type?: "runtime_read_safety" | "contract_surface" | "ownership_surface";
  requested_by?: string;
  target_base_url?: string;
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

async function listPersistedValidationRuns(
  db: D1Database,
): Promise<ValidationRunRow[]> {
  const result = await db
    .prepare(
      `SELECT
         id,
         validation_type,
         requested_by,
         assigned_to,
         status,
         target_base_url,
         result_id,
         created_at,
         started_at,
         completed_at
       FROM validation_runs
       ORDER BY created_at DESC`,
    )
    .all<ValidationRunRow>();

  return result.results ?? [];
}

async function getPersistedValidationRun(
  db: D1Database,
  runId: string,
): Promise<ValidationRunRow | null> {
  const row = await db
    .prepare(
      `SELECT
         id,
         validation_type,
         requested_by,
         assigned_to,
         status,
         target_base_url,
         result_id,
         created_at,
         started_at,
         completed_at
       FROM validation_runs
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(runId)
    .first<ValidationRunRow>();

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

async function listLatestValidationResultsByType(
  db: D1Database,
): Promise<ValidationResultRow[]> {
  const result = await db
    .prepare(
      `SELECT vr.id, vr.team_id, vr.validation_type, vr.status, vr.executed_by, vr.summary,
              vr.created_at, vr.owner_team, vr.severity, vr.escalation_state
       FROM validation_results vr
       INNER JOIN (
         SELECT validation_type, MAX(created_at) AS max_created_at
         FROM validation_results
         GROUP BY validation_type
       ) latest
         ON vr.validation_type = latest.validation_type
        AND vr.created_at = latest.max_created_at
       ORDER BY vr.validation_type ASC`,
    )
    .all<ValidationResultRow>();

  return result.results ?? [];
}

export async function handleLatestValidationResultRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/results/latest",
    request,
    handler: async () => {
      const url = new URL(request.url);
      const validationType = url.searchParams.get("validation_type");

      if (validationType) {
        const row = await env.DB
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
             WHERE validation_type = ?
             ORDER BY created_at DESC
             LIMIT 1`,
          )
          .bind(validationType)
          .first<ValidationResultRow>();

        if (!row) {
          return notFound(`validation result not found for type: ${validationType}`);
        }

        const ownerTeam =
          row.owner_team ?? deriveOwnerTeamForValidationType(row.validation_type);

        const severity =
          row.severity ??
          classifyValidationSeverity({
            status: row.status,
            validationType: row.validation_type,
          });

        const escalationState =
          row.escalation_state ??
          deriveEscalationState({
            severity,
            ownerTeam,
          });

        return json({
          validation_id: row.id,
          team_id: row.team_id,
          validation_type: row.validation_type,
          status: row.status,
          executed_by: row.executed_by,
          summary: row.summary,
          created_at: row.created_at,
          owner_team: ownerTeam,
          severity,
          escalation_state: escalationState,
          _owner: getOwnerForRoute("/validation/results/latest"),
        });
      }

      const latest = await listLatestValidationResultsByType(env.DB);

      return json({
        results: latest.map((row) => {
          const ownerTeam =
            row.owner_team ?? deriveOwnerTeamForValidationType(row.validation_type);

          const severity =
            row.severity ??
            classifyValidationSeverity({
              status: row.status,
              validationType: row.validation_type,
            });

          const escalationState =
            row.escalation_state ??
            deriveEscalationState({
              severity,
              ownerTeam,
            });

          return {
            validation_id: row.id,
            team_id: row.team_id,
            validation_type: row.validation_type,
            status: row.status,
            executed_by: row.executed_by,
            summary: row.summary,
            created_at: row.created_at,
            owner_team: ownerTeam,
            severity,
            escalation_state: escalationState,
          };
        }),
        _owner: getOwnerForRoute("/validation/results/latest"),
      });
    },
  });
}

export async function handleValidationVerdictRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/verdict",
    request,
    handler: async () => {
      const latest = await listLatestValidationResultsByType(env.DB);

      const checks = latest.map((row) => {
        const ownerTeam =
          row.owner_team ?? deriveOwnerTeamForValidationType(row.validation_type);

        const severity =
          row.severity ??
          classifyValidationSeverity({
            status: row.status,
            validationType: row.validation_type,
          });

        const escalationState =
          row.escalation_state ??
          deriveEscalationState({
            severity,
            ownerTeam,
          });

        return {
          validation_id: row.id,
          validation_type: row.validation_type,
          status: row.status,
          owner_team: ownerTeam,
          severity,
          escalation_state: escalationState,
        };
      });

      const overallFailed = checks.some(
        (check) =>
          check.status === "failed" ||
          check.severity === "failed" ||
          check.severity === "critical",
      );

      return json({
        team_id: "team_validation",
        status: overallFailed ? "failed" : "passed",
        checks,
        _owner: getOwnerForRoute("/validation/verdict"),
      });
    },
  });
}

export async function handleValidationRunsRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/runs",
    request,
    handler: async () => {
      const runs = await listPersistedValidationRuns(env.DB);

      return json({
        runs: runs.map((run) => ({
          validation_run_id: run.id,
          validation_type: run.validation_type,
          requested_by: run.requested_by,
          assigned_to: run.assigned_to,
          status: run.status,
          target_base_url: run.target_base_url,
          result_id: run.result_id,
          created_at: run.created_at,
          started_at: run.started_at,
          completed_at: run.completed_at,
        })),
        _owner: getOwnerForRoute("/validation/runs"),
      });
    },
  });
}

export async function handleValidationRunDetailRoute(
  request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/runs/:runId",
    request,
    resourceId: runId,
    handler: async () => {
      const run = await getPersistedValidationRun(env.DB, runId);
      if (!run) {
        return notFound(`validation run not found: ${runId}`);
      }

      return json({
        validation_run_id: run.id,
        validation_type: run.validation_type,
        requested_by: run.requested_by,
        assigned_to: run.assigned_to,
        status: run.status,
        target_base_url: run.target_base_url,
        result_id: run.result_id,
        created_at: run.created_at,
        started_at: run.started_at,
        completed_at: run.completed_at,
        _owner: getOwnerForRoute(`/validation/runs/${runId}`),
      });
    },
  });
}

export async function handleCreateValidationRunRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/runs",
    request,
    handler: async () => {
      const body = (await request.json()) as CreateValidationRunBody;

      if (
        body.validation_type !== "runtime_read_safety" &&
        body.validation_type !== "contract_surface" &&
        body.validation_type !== "ownership_surface"
      ) {
        return json(
          {
            error: "invalid_validation_type",
            message:
              "validation_type must be runtime_read_safety, contract_surface, or ownership_surface",
          },
          { status: 400 },
        );
      }

      if (
        typeof body.requested_by !== "string" ||
        body.requested_by.trim() === ""
      ) {
        return json(
          {
            error: "invalid_requested_by",
            message: "requested_by must be a non-empty string",
          },
          { status: 400 },
        );
      }

      if (
        typeof body.target_base_url !== "string" ||
        body.target_base_url.trim() === ""
      ) {
        return json(
          {
            error: "invalid_target_base_url",
            message: "target_base_url must be a non-empty string",
          },
          { status: 400 },
        );
      }

      const validationRunId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `validation_run_${crypto.randomUUID()}`
          : `validation_run_${Date.now()}`;

      const assignedTo = assignValidationEmployeeForType(body.validation_type);
      const createdAt = new Date().toISOString();

      await env.DB
        .prepare(
          `INSERT INTO validation_runs (
             id,
             validation_type,
             requested_by,
             assigned_to,
             status,
             target_base_url,
             result_id,
             created_at,
             started_at,
             completed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          validationRunId,
          body.validation_type,
          body.requested_by.trim(),
          assignedTo,
          "queued",
          body.target_base_url.trim(),
          null,
          createdAt,
          null,
          null,
        )
        .run();

      return json(
        {
          validation_run_id: validationRunId,
          validation_type: body.validation_type,
          requested_by: body.requested_by.trim(),
          assigned_to: assignedTo,
          status: "queued",
          target_base_url: body.target_base_url.trim(),
          created_at: createdAt,
          _owner: getOwnerForRoute("/validation/runs"),
        },
        { status: 202 },
      );
    },
  });
}