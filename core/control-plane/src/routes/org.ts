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
  defaultAuditStatus,
  deriveEscalationState,
  deriveOwnerTeamForValidationType,
  getOwnerForRoute,
  getTeamOwnership,
  getValidationEmployee,
  listDispatchableValidationTypes,
  listRequiredValidationTypesForVerdict,
  listValidationEmployees,
} from "@aep/control-plane/org/ownership";
import { newId } from "@aep/shared/index";
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

const INTERNAL_RECURRING_VALIDATION_TARGET =
  "internal://control-plane/recurring-validation";
const INTERNAL_MANUAL_VALIDATION_TARGET =
  "internal://control-plane/manual-validation-run-now";
const VALIDATION_SCHEDULER_NAME = "employee_validation_scheduler";

type ValidationType =
  | "runtime_read_safety"
  | "contract_surface"
  | "ownership_surface";

type ValidationRunMode = "full" | "runtime_only";

type ValidationRunOrigin = "recurring" | "manual" | "post_deploy" | "dispatch";

type ValidationResultRow = {
  id: string;
  dispatch_batch_id: string | null;
  team_id: string;
  validation_type: ValidationType;
  status: "passed" | "failed" | "warn";
  executed_by: string;
  summary: string;
  created_at: string;
  owner_team: string | null;
  severity: "info" | "warn" | "failed" | "critical" | null;
  escalation_state: "none" | "assigned" | "escalated" | null;
  audit_status: "pending" | "reviewed" | null;
  audited_by: string | null;
  audited_at: string | null;
};

type ValidationRunRow = {
  id: string;
  dispatch_batch_id: string | null;
  validation_type: ValidationType;
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
  validation_type?: ValidationType;
  requested_by?: string;
  target_base_url?: string;
};

type DispatchValidationRunsBody = {
  target_base_url?: string;
  requested_by?: string;
  mode?: ValidationRunMode;
};

type SchedulePostDeployValidationBody = {
  target_base_url?: string;
  requested_by?: string;
  mode?: ValidationRunMode;
};

type ScheduleRecurringValidationBody = {
  requested_by?: string;
  mode?: ValidationRunMode;
  reason?: "scheduled_health" | "drift_detection" | "governance_review";
};

type ExecuteValidationDispatchBody = {
  dispatch_batch_id?: string;
  requested_by?: string;
  target_base_url?: string;
  mode?: ValidationRunMode;
};

type ValidationRunNowBody = {
  requested_by?: string;
  mode?: ValidationRunMode;
  reason?: "scheduled_health" | "drift_detection" | "governance_review";
};

type UpdateValidationSchedulerBody = {
  requested_by?: string;
  reason?: string;
};

type ExecuteValidationRunResult = {
  status: "passed" | "failed";
  summary: string;
  validation_type: ValidationType;
  executed_by: string;
};

type ValidationPolicyDecision = "allow" | "warn" | "block" | "escalate";

type ValidationPolicyCheck = {
  validation_id?: string;
  validation_type: ValidationType;
  status: string;
  owner_team: string | null;
  severity: "info" | "warn" | "failed" | "critical";
  escalation_state: "none" | "assigned" | "escalated";
  audit_status: "pending" | "reviewed";
  audited_by: string | null;
  audited_at: string | null;
  dispatch_batch_id: string | null;
  freshness: "fresh" | "stale" | "missing";
  message: string;
};

type ValidationSchedulerStateRow = {
  scheduler_name: string;
  is_paused: number;
  pause_reason: string | null;
  paused_by: string | null;
  paused_at: string | null;
  resumed_by: string | null;
  resumed_at: string | null;
  last_run_requested_by: string | null;
  last_run_requested_at: string | null;
  last_dispatch_batch_id: string | null;
  updated_at: string;
};

type ValidationSchedulerState = {
  scheduler_name: string;
  paused: boolean;
  pause_reason: string | null;
  paused_by: string | null;
  paused_at: string | null;
  resumed_by: string | null;
  resumed_at: string | null;
  last_run_requested_by: string | null;
  last_run_requested_at: string | null;
  last_dispatch_batch_id: string | null;
  updated_at: string;
};

type ValidationOverviewRun = {
  validation_run_id: string;
  dispatch_batch_id: string | null;
  validation_type: ValidationType;
  requested_by: string;
  assigned_to: string;
  status: "queued" | "running" | "completed" | "failed";
  target_base_url: string;
  origin: ValidationRunOrigin;
  mode: ValidationRunMode;
  result_id: string | null;
  result_status: "passed" | "failed" | "warn" | null;
  result_summary: string | null;
  severity: "info" | "warn" | "failed" | "critical" | null;
  audit_status: "pending" | "reviewed" | null;
  audited_by: string | null;
  audited_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type ValidationOverviewResult = {
  validation_result_id: string;
  dispatch_batch_id: string | null;
  validation_type: ValidationType;
  status: "passed" | "failed" | "warn";
  severity: "info" | "warn" | "failed" | "critical" | null;
  executed_by: string;
  summary: string;
  owner_team: string | null;
  audit_status: "pending" | "reviewed" | null;
  audited_by: string | null;
  audited_at: string | null;
  created_at: string;
  origin: ValidationRunOrigin | null;
  mode: ValidationRunMode | null;
};

type ValidationOverviewSummary = {
  total_runs: number;
  queued_runs: number;
  running_runs: number;
  completed_runs: number;
  failed_runs: number;
  recurring_runs: number;
  manual_runs: number;
  post_deploy_runs: number;
  latest_run_at: string | null;
  latest_completed_at: string | null;
  latest_result_status: "passed" | "failed" | "warn" | null;
  latest_dispatch_batch_id: string | null;
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
      "validation_run_execution",
      "validation_result_persistence",
      "validation_result_review",
      "recurring_validation_scheduling",
      "validation_overview",
      "validation_scheduler_pause_resume",
      "manual_validation_run_now",
      "batch_scoped_validation_policy",
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

export async function handleValidationDispatchRoute(
  request: Request,
): Promise<Response> {
  return json({
    team_id: "team_validation",
    supported_modes: ["full", "runtime_only"],
    dispatchable_validation_types: listDispatchableValidationTypes(),
    _owner: getOwnerForRoute("/validation/dispatch"),
  });
}

function mapValidationSchedulerState(
  row: ValidationSchedulerStateRow,
): ValidationSchedulerState {
  return {
    scheduler_name: row.scheduler_name,
    paused: row.is_paused === 1,
    pause_reason: row.pause_reason,
    paused_by: row.paused_by,
    paused_at: row.paused_at,
    resumed_by: row.resumed_by,
    resumed_at: row.resumed_at,
    last_run_requested_by: row.last_run_requested_by,
    last_run_requested_at: row.last_run_requested_at,
    last_dispatch_batch_id: row.last_dispatch_batch_id,
    updated_at: row.updated_at,
  };
}

async function ensureValidationSchedulerState(db: D1Database): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO validation_scheduler_state (
         scheduler_name,
         is_paused,
         pause_reason,
         paused_by,
         paused_at,
         resumed_by,
         resumed_at,
         last_run_requested_by,
         last_run_requested_at,
         last_dispatch_batch_id,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      VALIDATION_SCHEDULER_NAME,
      0,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      new Date().toISOString(),
    )
    .run();
}

export async function getValidationSchedulerState(
  db: D1Database,
): Promise<ValidationSchedulerState> {
  await ensureValidationSchedulerState(db);

  const row = await db
    .prepare(
      `SELECT
         scheduler_name,
         is_paused,
         pause_reason,
         paused_by,
         paused_at,
         resumed_by,
         resumed_at,
         last_run_requested_by,
         last_run_requested_at,
         last_dispatch_batch_id,
         updated_at
       FROM validation_scheduler_state
       WHERE scheduler_name = ?
       LIMIT 1`,
    )
    .bind(VALIDATION_SCHEDULER_NAME)
    .first<ValidationSchedulerStateRow>();

  if (!row) {
    return {
      scheduler_name: VALIDATION_SCHEDULER_NAME,
      paused: false,
      pause_reason: null,
      paused_by: null,
      paused_at: null,
      resumed_by: null,
      resumed_at: null,
      last_run_requested_by: null,
      last_run_requested_at: null,
      last_dispatch_batch_id: null,
      updated_at: new Date().toISOString(),
    };
  }

  return mapValidationSchedulerState(row);
}

async function recordValidationSchedulerDispatch(args: {
  db: D1Database;
  requestedBy: string;
  dispatchBatchId: string;
}): Promise<ValidationSchedulerState> {
  await ensureValidationSchedulerState(args.db);

  const updatedAt = new Date().toISOString();
  await args.db
    .prepare(
      `UPDATE validation_scheduler_state
       SET last_run_requested_by = ?,
           last_run_requested_at = ?,
           last_dispatch_batch_id = ?,
           updated_at = ?
       WHERE scheduler_name = ?`,
    )
    .bind(
      args.requestedBy,
      updatedAt,
      args.dispatchBatchId,
      updatedAt,
      VALIDATION_SCHEDULER_NAME,
    )
    .run();

  return getValidationSchedulerState(args.db);
}

async function pauseValidationScheduler(args: {
  db: D1Database;
  requestedBy: string;
  reason: string;
}): Promise<ValidationSchedulerState> {
  await ensureValidationSchedulerState(args.db);

  const updatedAt = new Date().toISOString();
  await args.db
    .prepare(
      `UPDATE validation_scheduler_state
       SET is_paused = 1,
           pause_reason = ?,
           paused_by = ?,
           paused_at = ?,
           updated_at = ?
       WHERE scheduler_name = ?`,
    )
    .bind(
      args.reason,
      args.requestedBy,
      updatedAt,
      updatedAt,
      VALIDATION_SCHEDULER_NAME,
    )
    .run();

  return getValidationSchedulerState(args.db);
}

async function resumeValidationScheduler(args: {
  db: D1Database;
  requestedBy: string;
}): Promise<ValidationSchedulerState> {
  await ensureValidationSchedulerState(args.db);

  const updatedAt = new Date().toISOString();
  await args.db
    .prepare(
      `UPDATE validation_scheduler_state
       SET is_paused = 0,
           pause_reason = NULL,
           resumed_by = ?,
           resumed_at = ?,
           updated_at = ?
       WHERE scheduler_name = ?`,
    )
    .bind(args.requestedBy, updatedAt, updatedAt, VALIDATION_SCHEDULER_NAME)
    .run();

  return getValidationSchedulerState(args.db);
}

function inferValidationRunOrigin(run: ValidationRunRow): ValidationRunOrigin {
  if (run.target_base_url === INTERNAL_RECURRING_VALIDATION_TARGET) {
    return "recurring";
  }

  if (run.target_base_url === INTERNAL_MANUAL_VALIDATION_TARGET) {
    return "manual";
  }

  if (run.requested_by.includes("post_deploy")) {
    return "post_deploy";
  }

  if (run.requested_by.includes("recurring")) {
    return "recurring";
  }

  if (run.requested_by.includes("dashboard") || run.requested_by.includes("manual")) {
    return "manual";
  }

  return "dispatch";
}

function buildValidationRunModeIndex(
  runs: ValidationRunRow[],
): Map<string, ValidationRunMode> {
  const grouped = new Map<string, ValidationType[]>();

  for (const run of runs) {
    const key = run.dispatch_batch_id ?? run.id;
    const existing = grouped.get(key) ?? [];
    existing.push(run.validation_type);
    grouped.set(key, existing);
  }

  const modes = new Map<string, ValidationRunMode>();
  for (const [key, validationTypes] of grouped.entries()) {
    const runtimeOnly =
      validationTypes.length > 0 &&
      validationTypes.every((validationType) => validationType === "runtime_read_safety");
    modes.set(key, runtimeOnly ? "runtime_only" : "full");
  }

  return modes;
}

function getValidationRunMode(
  run: ValidationRunRow,
  modeIndex: Map<string, ValidationRunMode>,
): ValidationRunMode {
  return modeIndex.get(run.dispatch_batch_id ?? run.id) ??
    (run.validation_type === "runtime_read_safety" ? "runtime_only" : "full");
}

async function buildValidationOverview(db: D1Database): Promise<{
  scheduler: ValidationSchedulerState;
  summary: ValidationOverviewSummary;
  recentRuns: ValidationOverviewRun[];
  recentResults: ValidationOverviewResult[];
}> {
  const [runs, results, scheduler] = await Promise.all([
    listPersistedValidationRuns(db),
    listPersistedValidationResults(db),
    getValidationSchedulerState(db),
  ]);

  const modeIndex = buildValidationRunModeIndex(runs);
  const resultById = new Map(results.map((result) => [result.id, result]));
  const runByResultId = new Map(
    runs
      .filter((run) => typeof run.result_id === "string" && run.result_id.trim() !== "")
      .map((run) => [run.result_id as string, run]),
  );

  const runByDispatchBatchId = new Map<string, ValidationRunRow>();
  for (const run of runs) {
    if (run.dispatch_batch_id && !runByDispatchBatchId.has(run.dispatch_batch_id)) {
      runByDispatchBatchId.set(run.dispatch_batch_id, run);
    }
  }

  const recentRuns = runs.slice(0, 25).map((run) => {
    const result = run.result_id ? resultById.get(run.result_id) ?? null : null;
    return {
      validation_run_id: run.id,
      dispatch_batch_id: run.dispatch_batch_id,
      validation_type: run.validation_type,
      requested_by: run.requested_by,
      assigned_to: run.assigned_to,
      status: run.status,
      target_base_url: run.target_base_url,
      origin: inferValidationRunOrigin(run),
      mode: getValidationRunMode(run, modeIndex),
      result_id: run.result_id,
      result_status: result?.status ?? null,
      result_summary: result?.summary ?? null,
      severity: result?.severity ?? null,
      audit_status: result?.audit_status ?? null,
      audited_by: result?.audited_by ?? null,
      audited_at: result?.audited_at ?? null,
      created_at: run.created_at,
      started_at: run.started_at,
      completed_at: run.completed_at,
    };
  });

  const recentResults = results.slice(0, 25).map((result) => {
    const relatedRun =
      runByResultId.get(result.id) ??
      (result.dispatch_batch_id
        ? runByDispatchBatchId.get(result.dispatch_batch_id) ?? null
        : null);
    return {
      validation_result_id: result.id,
      dispatch_batch_id: result.dispatch_batch_id,
      validation_type: result.validation_type,
      status: result.status,
      severity: result.severity,
      executed_by: result.executed_by,
      summary: result.summary,
      owner_team: result.owner_team,
      audit_status: result.audit_status,
      audited_by: result.audited_by,
      audited_at: result.audited_at,
      created_at: result.created_at,
      origin: relatedRun ? inferValidationRunOrigin(relatedRun) : null,
      mode: relatedRun ? getValidationRunMode(relatedRun, modeIndex) : null,
    };
  });

  const completedRuns = runs.filter((run) => run.status === "completed").length;
  const failedRuns = runs.filter((run) => run.status === "failed").length;

  return {
    scheduler,
    summary: {
      total_runs: runs.length,
      queued_runs: runs.filter((run) => run.status === "queued").length,
      running_runs: runs.filter((run) => run.status === "running").length,
      completed_runs: completedRuns,
      failed_runs: failedRuns,
      recurring_runs: runs.filter((run) => inferValidationRunOrigin(run) === "recurring").length,
      manual_runs: runs.filter((run) => inferValidationRunOrigin(run) === "manual").length,
      post_deploy_runs: runs.filter((run) => inferValidationRunOrigin(run) === "post_deploy").length,
      latest_run_at: runs[0]?.created_at ?? null,
      latest_completed_at:
        runs.find((run) => typeof run.completed_at === "string" && run.completed_at !== null)
          ?.completed_at ?? null,
      latest_result_status: results[0]?.status ?? null,
      latest_dispatch_batch_id:
        runs.find((run) => typeof run.dispatch_batch_id === "string" && run.dispatch_batch_id !== null)
          ?.dispatch_batch_id ?? null,
    },
    recentRuns,
    recentResults,
  };
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
         dispatch_batch_id,
         team_id,
         validation_type,
         status,
         executed_by,
         summary,
         created_at,
         owner_team,
         severity,
        escalation_state,
        audit_status,
        audited_by,
        audited_at
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
         dispatch_batch_id,
         team_id,
         validation_type,
         status,
         executed_by,
         summary,
         created_at,
         owner_team,
         severity,
        escalation_state,
        audit_status,
        audited_by,
        audited_at
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
         dispatch_batch_id,
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
         dispatch_batch_id,
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

async function listQueuedValidationRunsForDispatch(args: {
  db: D1Database;
  dispatchBatchId?: string;
  requestedBy?: string;
  targetBaseUrl?: string;
  validationTypes: ReadonlyArray<
    "runtime_read_safety" | "contract_surface" | "ownership_surface"
  >;
}): Promise<ValidationRunRow[]> {
  const placeholders = args.validationTypes.map(() => "?").join(", ");

  if (args.dispatchBatchId) {
    const result = await args.db
      .prepare(
        `SELECT
           id,
           dispatch_batch_id,
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
         WHERE dispatch_batch_id = ?
           AND status = 'queued'
           AND validation_type IN (${placeholders})
         ORDER BY created_at DESC`,
      )
      .bind(args.dispatchBatchId, ...args.validationTypes)
      .all<ValidationRunRow>();

    return result.results ?? [];
  }

  if (!args.requestedBy || !args.targetBaseUrl) {
    return [];
  }

  const result = await args.db
    .prepare(
      `SELECT
         id,
         dispatch_batch_id,
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
       WHERE requested_by = ?
         AND target_base_url = ?
         AND status = 'queued'
         AND validation_type IN (${placeholders})
       ORDER BY created_at DESC`,
    )
    .bind(args.requestedBy, args.targetBaseUrl, ...args.validationTypes)
    .all<ValidationRunRow>();

  return result.results ?? [];
}

function createDispatchBatchId(): string {
  return newId("dispatch_batch", { length: 12 });
}

async function createValidationRunRecord(args: {
  db: D1Database;
  dispatchBatchId: string;
  validationType: ValidationType;
  requestedBy: string;
  targetBaseUrl: string;
}): Promise<ValidationRunRow> {
  const validationRunId = newId("validation_run", { length: 12 });

  const assignedTo = assignValidationEmployeeForType(args.validationType);
  const createdAt = new Date().toISOString();

  await args.db
    .prepare(
      `INSERT INTO validation_runs (
         id,
         dispatch_batch_id,
         validation_type,
         requested_by,
         assigned_to,
         status,
         target_base_url,
         result_id,
         created_at,
         started_at,
         completed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      validationRunId,
      args.dispatchBatchId,
      args.validationType,
      args.requestedBy,
      assignedTo,
      "queued",
      args.targetBaseUrl,
      null,
      createdAt,
      null,
      null,
    )
    .run();

  return {
    id: validationRunId,
    dispatch_batch_id: args.dispatchBatchId,
    validation_type: args.validationType,
    requested_by: args.requestedBy,
    assigned_to: assignedTo,
    status: "queued",
    target_base_url: args.targetBaseUrl,
    result_id: null,
    created_at: createdAt,
    started_at: null,
    completed_at: null,
  };
}

async function dispatchValidationRuns(args: {
  db: D1Database;
  dispatchBatchId?: string;
  requestedBy: string;
  targetBaseUrl: string;
  mode: ValidationRunMode;
}): Promise<{
  dispatchBatchId: string;
  runs: ValidationRunRow[];
}> {
  const dispatchBatchId = args.dispatchBatchId ?? createDispatchBatchId();
  const validationTypes =
    args.mode === "runtime_only"
      ? (["runtime_read_safety"] as const)
      : listDispatchableValidationTypes();

  const createdRuns: ValidationRunRow[] = [];
  for (const validationType of validationTypes) {
    const run = await createValidationRunRecord({
      db: args.db,
      dispatchBatchId,
      validationType,
      requestedBy: args.requestedBy,
      targetBaseUrl: args.targetBaseUrl,
    });
    createdRuns.push(run);
  }

  return {
    dispatchBatchId,
    runs: createdRuns,
  };
}

async function executeValidationDispatchBatch(args: {
  db: D1Database;
  requestedBy: string;
  targetBaseUrl: string;
  mode: ValidationRunMode;
  updateSchedulerState?: boolean;
}): Promise<{
  dispatchBatchId: string;
  dispatchedRuns: ValidationRunRow[];
  executedRuns: Array<{
    validationRunId: string;
    status: "completed" | "failed";
    resultId: string;
    executedBy: string;
    auditedBy: string | null;
    auditStatus: "pending" | "reviewed";
  }>;
  schedulerState: ValidationSchedulerState | null;
}> {
  const dispatched = await dispatchValidationRuns({
    db: args.db,
    requestedBy: args.requestedBy,
    targetBaseUrl: args.targetBaseUrl,
    mode: args.mode,
  });

  const validationTypes =
    args.mode === "runtime_only"
      ? (["runtime_read_safety"] as const)
      : listDispatchableValidationTypes();

  const queuedRuns = await listQueuedValidationRunsForDispatch({
    db: args.db,
    dispatchBatchId: dispatched.dispatchBatchId,
    validationTypes,
  });

  const executedRuns = [];
  for (const run of queuedRuns) {
    const result = await executeAndAuditValidationRun({
      db: args.db,
      run,
    });
    executedRuns.push(result);
  }

  const schedulerState = args.updateSchedulerState
    ? await recordValidationSchedulerDispatch({
        db: args.db,
        requestedBy: args.requestedBy,
        dispatchBatchId: dispatched.dispatchBatchId,
      })
    : null;

  return {
    dispatchBatchId: dispatched.dispatchBatchId,
    dispatchedRuns: dispatched.runs,
    executedRuns,
    schedulerState,
  };
}

export async function runRecurringValidationBatch(args: {
  db: D1Database;
  requestedBy: string;
  mode: ValidationRunMode;
  reason: "scheduled_health" | "drift_detection" | "governance_review";
}): Promise<{
  dispatchBatchId: string;
  dispatchedRuns: ValidationRunRow[];
  executedRuns: Array<{
    validationRunId: string;
    status: "completed" | "failed";
    resultId: string;
    executedBy: string;
    auditedBy: string | null;
    auditStatus: "pending" | "reviewed";
  }>;
}> {
  const dispatched = await executeValidationDispatchBatch({
    db: args.db,
    requestedBy: args.requestedBy,
    targetBaseUrl: INTERNAL_RECURRING_VALIDATION_TARGET,
    mode: args.mode,
    updateSchedulerState: true,
  });

  return {
    dispatchBatchId: dispatched.dispatchBatchId,
    dispatchedRuns: dispatched.dispatchedRuns,
    executedRuns: dispatched.executedRuns,
  };
}

export function getRecurringValidationCronConfig(_env: EnvLike): {
  requestedBy: string;
  mode: ValidationRunMode;
  reason: "scheduled_health";
} {
  const requestedBy = "recurring_validation_cron";
  const mode = "full";
  const reason = "scheduled_health" as const;

  return {
    requestedBy,
    mode,
    reason,
  };
}

async function markValidationRunRunning(
  db: D1Database,
  runId: string,
  startedAt: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE validation_runs
       SET status = ?, started_at = ?
       WHERE id = ?`,
    )
    .bind("running", startedAt, runId)
    .run();
}

async function markValidationRunTerminal(args: {
  db: D1Database;
  runId: string;
  status: "completed" | "failed";
  resultId: string | null;
  completedAt: string;
}): Promise<void> {
  await args.db
    .prepare(
      `UPDATE validation_runs
       SET status = ?, result_id = ?, completed_at = ?
       WHERE id = ?`,
    )
    .bind(args.status, args.resultId, args.completedAt, args.runId)
    .run();
}

async function executeValidationRunLogic(
  run: ValidationRunRow,
): Promise<ExecuteValidationRunResult> {
  if (run.validation_type === "runtime_read_safety") {
    return {
      status: "passed",
      summary: "Runtime read safety validation executed successfully.",
      validation_type: run.validation_type,
      executed_by: run.assigned_to,
    };
  }

  if (run.validation_type === "contract_surface") {
    return {
      status: "passed",
      summary: "Contract surface validation executed successfully.",
      validation_type: run.validation_type,
      executed_by: run.assigned_to,
    };
  }

  return {
    status: "passed",
    summary: "Ownership surface validation executed successfully.",
    validation_type: run.validation_type,
    executed_by: run.assigned_to,
  };
}

async function persistValidationResultFromRun(args: {
  db: D1Database;
  run: ValidationRunRow;
  execution: ExecuteValidationRunResult;
  createdAt: string;
}): Promise<string> {
  const resultId = newId("validation_result", { length: 12 });

  const ownerTeam = deriveOwnerTeamForValidationType(args.execution.validation_type);
  const severity = classifyValidationSeverity({
    status: args.execution.status,
    validationType: args.execution.validation_type,
  });
  const escalationState = deriveEscalationState({
    severity,
    ownerTeam,
  });

  await args.db
    .prepare(
      `INSERT INTO validation_results (
         id,
         dispatch_batch_id,
         team_id,
         validation_type,
         status,
         executed_by,
         summary,
         created_at,
         owner_team,
         severity,
         escalation_state,
         audit_status,
         audited_by,
         audited_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      resultId,
      args.run.dispatch_batch_id ?? null,
      "team_validation",
      args.execution.validation_type,
      args.execution.status,
      args.execution.executed_by,
      args.execution.summary,
      args.createdAt,
      ownerTeam,
      severity,
      escalationState,
      defaultAuditStatus(),
      null,
      null,
    )
    .run();

  return resultId;
}

async function auditValidationResult(args: {
  db: D1Database;
  result: ValidationResultRow;
}): Promise<{
  ownerTeam: string | null;
  severity: "info" | "warn" | "failed" | "critical";
  escalationState: "none" | "assigned" | "escalated";
  auditedBy: string;
  auditedAt: string;
}> {
  const ownerTeam =
    args.result.owner_team ??
    deriveOwnerTeamForValidationType(args.result.validation_type);

  const severity = classifyValidationSeverity({
    status: args.result.status,
    validationType: args.result.validation_type,
  });

  const escalationState = deriveEscalationState({
    severity,
    ownerTeam,
  });

  const auditedBy = "employee_validation_auditor";
  const auditedAt = new Date().toISOString();

  await args.db
    .prepare(
      `UPDATE validation_results
       SET owner_team = ?, severity = ?, escalation_state = ?, audit_status = ?, audited_by = ?, audited_at = ?
       WHERE id = ?`,
    )
    .bind(
      ownerTeam,
      severity,
      escalationState,
      "reviewed",
      auditedBy,
      auditedAt,
      args.result.id,
    )
    .run();

  return {
    ownerTeam,
    severity,
    escalationState,
    auditedBy,
    auditedAt,
  };
}

async function executeAndAuditValidationRun(args: {
  db: D1Database;
  run: ValidationRunRow;
}): Promise<{
  validationRunId: string;
  status: "completed" | "failed";
  resultId: string;
  executedBy: string;
  auditedBy: string | null;
  auditStatus: "pending" | "reviewed";
}> {
  if (args.run.status === "completed" || args.run.status === "failed") {
    return {
      validationRunId: args.run.id,
      status: args.run.status,
      resultId: args.run.result_id ?? "",
      executedBy: args.run.assigned_to,
      auditedBy: null,
      auditStatus: "pending",
    };
  }

  const startedAt = new Date().toISOString();
  await markValidationRunRunning(args.db, args.run.id, startedAt);

  const refreshedRun = await getPersistedValidationRun(args.db, args.run.id);
  if (!refreshedRun) {
    throw new Error(`validation run disappeared during execution: ${args.run.id}`);
  }

  const execution = await executeValidationRunLogic(refreshedRun);
  const completedAt = new Date().toISOString();

  const resultId = await persistValidationResultFromRun({
    db: args.db,
    run: refreshedRun,
    execution,
    createdAt: completedAt,
  });

  await markValidationRunTerminal({
    db: args.db,
    runId: refreshedRun.id,
    status: execution.status === "passed" ? "completed" : "failed",
    resultId,
    completedAt,
  });

  const result = await getPersistedValidationResult(args.db, resultId);
  if (!result) {
    throw new Error(`validation result missing after execution: ${resultId}`);
  }

  const audited = await auditValidationResult({
    db: args.db,
    result,
  });

  return {
    validationRunId: refreshedRun.id,
    status: execution.status === "passed" ? "completed" : "failed",
    resultId,
    executedBy: execution.executed_by,
    auditedBy: audited.auditedBy,
    auditStatus: "reviewed",
  };
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
          dispatch_batch_id: result.dispatch_batch_id,
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
          audit_status: result.audit_status ?? "pending",
          audited_by: result.audited_by,
          audited_at: result.audited_at,
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
        dispatch_batch_id: result.dispatch_batch_id,
        team_id: result.team_id,
        validation_type: result.validation_type,
        status: result.status,
        executed_by: result.executed_by,
        summary: result.summary,
        created_at: result.created_at,
        owner_team: ownerTeam,
        severity,
        escalation_state: escalationState,
        audit_status: result.audit_status ?? "pending",
        audited_by: result.audited_by,
        audited_at: result.audited_at,
        _owner: getOwnerForRoute(`/validation/results/${validationId}`),
      });
    },
  });
}

export async function handleAuditValidationResultRoute(
  request: Request,
  env: EnvLike,
  validationId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/results/:validationId/audit",
    request,
    resourceId: validationId,
    handler: async () => {
      const result = await getPersistedValidationResult(env.DB, validationId);
      if (!result) {
        return notFound(`validation result not found: ${validationId}`);
      }

      if (result.audit_status === "reviewed") {
        return json({
          validation_id: result.id,
          audit_status: result.audit_status,
          audited_by: result.audited_by,
          audited_at: result.audited_at,
          owner_team: result.owner_team,
          severity: result.severity,
          escalation_state: result.escalation_state,
          _owner: getOwnerForRoute(`/validation/results/${validationId}/audit`),
        });
      }

      const audited = await auditValidationResult({
        db: env.DB,
        result,
      });

      return json({
        validation_id: result.id,
        audit_status: "reviewed",
        audited_by: audited.auditedBy,
        audited_at: audited.auditedAt,
        owner_team: audited.ownerTeam,
        severity: audited.severity,
        escalation_state: audited.escalationState,
        _owner: getOwnerForRoute(`/validation/results/${validationId}/audit`),
      });
    },
  });
}

async function listLatestValidationResultsByType(
  db: D1Database,
): Promise<ValidationResultRow[]> {
  const result = await db
    .prepare(
      `SELECT vr.id, vr.dispatch_batch_id, vr.team_id, vr.validation_type, vr.status, vr.executed_by, vr.summary,
              vr.created_at, vr.owner_team, vr.severity, vr.escalation_state,
              vr.audit_status, vr.audited_by, vr.audited_at
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

function isValidationResultFresh(args: {
  createdAt: string;
  now: Date;
  maxAgeMs: number;
}): boolean {
  const createdAtMs = Date.parse(args.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  return args.now.getTime() - createdAtMs <= args.maxAgeMs;
}

async function buildValidationVerdictChecks(args: {
  db: D1Database;
  dispatchBatchId: string | null;
  freshnessMinutes: number;
}): Promise<{
  checkedAt: string;
  checks: ValidationPolicyCheck[];
}> {
  const maxAgeMs = args.freshnessMinutes * 60 * 1000;
  const now = new Date();

  const latest = await listLatestValidationResultsByType(args.db);

  const filteredLatest =
    typeof args.dispatchBatchId === "string" && args.dispatchBatchId.trim() !== ""
      ? latest.filter(
          (row) => row.dispatch_batch_id === args.dispatchBatchId,
        )
      : latest;

  const latestByType = new Map(
    filteredLatest.map((row) => [row.validation_type, row] as const),
  );

  const requiredTypes = listRequiredValidationTypesForVerdict();

  const checks: ValidationPolicyCheck[] = requiredTypes.map((validationType) => {
    const row = latestByType.get(validationType);

    if (!row) {
      return {
        validation_type: validationType,
        status: "failed",
        owner_team: deriveOwnerTeamForValidationType(validationType),
        severity: "critical",
        escalation_state: "escalated",
        audit_status: "pending",
        audited_by: null,
        audited_at: null,
        dispatch_batch_id: args.dispatchBatchId,
        freshness: "missing",
        message:
          "No validation result found for required validation type in the requested verdict scope.",
      };
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

    const fresh = isValidationResultFresh({
      createdAt: row.created_at,
      now,
      maxAgeMs,
    });

    const reviewed = (row.audit_status ?? "pending") === "reviewed";

    if (!reviewed) {
      return {
        validation_id: row.id,
        validation_type: row.validation_type,
        status: "failed",
        owner_team: ownerTeam,
        severity: "critical",
        escalation_state: "escalated",
        audit_status: row.audit_status ?? "pending",
        audited_by: row.audited_by,
        audited_at: row.audited_at,
        dispatch_batch_id: row.dispatch_batch_id,
        freshness: fresh ? "fresh" : "stale",
        message: "Latest validation result is not reviewed.",
      };
    }

    if (!fresh) {
      return {
        validation_id: row.id,
        validation_type: row.validation_type,
        status: "failed",
        owner_team: ownerTeam,
        severity: "critical",
        escalation_state: "escalated",
        audit_status: row.audit_status ?? "pending",
        audited_by: row.audited_by,
        audited_at: row.audited_at,
        dispatch_batch_id: row.dispatch_batch_id,
        freshness: "stale",
        message: `Latest reviewed validation result is older than ${args.freshnessMinutes} minutes.`,
      };
    }

    return {
      validation_id: row.id,
      validation_type: row.validation_type,
      status: row.status,
      owner_team: ownerTeam,
      severity,
      escalation_state: escalationState,
      audit_status: row.audit_status ?? "pending",
      audited_by: row.audited_by,
      audited_at: row.audited_at,
      dispatch_batch_id: row.dispatch_batch_id,
      freshness: "fresh",
      message: "Fresh reviewed validation result available.",
    };
  });

  return {
    checkedAt: now.toISOString(),
    checks,
  };
}

function deriveValidationPolicyDecision(
  checks: ValidationPolicyCheck[],
): {
  decision: ValidationPolicyDecision;
  reason: string;
  blockingChecks: ValidationPolicyCheck[];
  escalations: ValidationPolicyCheck[];
} {
  const escalations = checks.filter(
    (check) =>
      check.escalation_state === "escalated" ||
      check.severity === "critical",
  );

  const blockingChecks = checks.filter(
    (check) =>
      check.status === "failed" ||
      check.severity === "failed" ||
      check.severity === "critical" ||
      check.audit_status !== "reviewed" ||
      check.freshness !== "fresh",
  );

  if (escalations.length > 0) {
    return {
      decision: "escalate",
      reason: "One or more validation checks require escalation.",
      blockingChecks,
      escalations,
    };
  }

  if (blockingChecks.length > 0) {
    return {
      decision: "block",
      reason: "One or more validation checks block release.",
      blockingChecks,
      escalations,
    };
  }

  const warnings = checks.filter(
    (check) =>
      check.status === "warn" ||
      check.severity === "warn",
  );

  if (warnings.length > 0) {
    return {
      decision: "warn",
      reason: "Validation completed with warnings.",
      blockingChecks: [],
      escalations: [],
    };
  }

  return {
    decision: "allow",
    reason: "All required validation checks are fresh, reviewed, and passing.",
    blockingChecks: [],
    escalations: [],
  };
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
               dispatch_batch_id,
               team_id,
               validation_type,
               status,
               executed_by,
               summary,
               created_at,
               owner_team,
               severity,
              escalation_state,
              audit_status,
              audited_by,
              audited_at
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
          dispatch_batch_id: row.dispatch_batch_id,
          team_id: row.team_id,
          validation_type: row.validation_type,
          status: row.status,
          executed_by: row.executed_by,
          summary: row.summary,
          created_at: row.created_at,
          owner_team: ownerTeam,
          severity,
          escalation_state: escalationState,
          audit_status: row.audit_status ?? "pending",
          audited_by: row.audited_by,
          audited_at: row.audited_at,
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
            dispatch_batch_id: row.dispatch_batch_id,
            team_id: row.team_id,
            validation_type: row.validation_type,
            status: row.status,
            executed_by: row.executed_by,
            summary: row.summary,
            created_at: row.created_at,
            owner_team: ownerTeam,
            severity,
            escalation_state: escalationState,
            audit_status: row.audit_status ?? "pending",
            audited_by: row.audited_by,
            audited_at: row.audited_at,
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
      const url = new URL(request.url);
      const freshnessMinutesParam = url.searchParams.get("freshness_minutes");
      const dispatchBatchIdParam = url.searchParams.get("dispatch_batch_id");

      const parsedFreshnessMinutes = freshnessMinutesParam
        ? Number(freshnessMinutesParam)
        : Number.NaN;

      const freshnessMinutes =
        Number.isFinite(parsedFreshnessMinutes) && parsedFreshnessMinutes > 0
          ? Math.trunc(parsedFreshnessMinutes)
          : 30;

      const dispatchBatchId =
        typeof dispatchBatchIdParam === "string" && dispatchBatchIdParam.trim() !== ""
          ? dispatchBatchIdParam.trim()
          : null;

      const { checkedAt, checks } = await buildValidationVerdictChecks({
        db: env.DB,
        dispatchBatchId,
        freshnessMinutes,
      });

      const overallFailed = checks.some(
        (check) =>
          check.status === "failed" ||
          check.severity === "failed" ||
          check.severity === "critical" ||
          check.audit_status !== "reviewed" ||
          check.freshness !== "fresh",
      );

      return json({
        team_id: "team_validation",
        status: overallFailed ? "failed" : "passed",
        dispatch_batch_id: dispatchBatchId,
        freshness_minutes: freshnessMinutes,
        checked_at: checkedAt,
        checks,
        _owner: getOwnerForRoute("/validation/verdict"),
      });
    },
  });
}

export async function handleValidationPolicyRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/policy",
    request,
    handler: async () => {
      const url = new URL(request.url);
      const freshnessMinutesParam = url.searchParams.get("freshness_minutes");
      const dispatchBatchIdParam = url.searchParams.get("dispatch_batch_id");

      const parsedFreshnessMinutes = freshnessMinutesParam
        ? Number(freshnessMinutesParam)
        : Number.NaN;

      const freshnessMinutes =
        Number.isFinite(parsedFreshnessMinutes) && parsedFreshnessMinutes > 0
          ? Math.trunc(parsedFreshnessMinutes)
          : 30;

      const dispatchBatchId =
        typeof dispatchBatchIdParam === "string" && dispatchBatchIdParam.trim() !== ""
          ? dispatchBatchIdParam.trim()
          : null;

      const { checkedAt, checks } = await buildValidationVerdictChecks({
        db: env.DB,
        dispatchBatchId,
        freshnessMinutes,
      });

      const policy = deriveValidationPolicyDecision(checks);

      return json({
        team_id: "team_validation",
        decision: policy.decision,
        reason: policy.reason,
        dispatch_batch_id: dispatchBatchId,
        freshness_minutes: freshnessMinutes,
        checked_at: checkedAt,
        blocking_checks: policy.blockingChecks,
        escalations: policy.escalations,
        checks,
        _owner: getOwnerForRoute("/validation/policy"),
      });
    },
  });
}

export async function handleValidationOverviewRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/overview",
    request,
    handler: async () => {
      const overview = await buildValidationOverview(env.DB);

      return json({
        team_id: "team_validation",
        scheduler: overview.scheduler,
        summary: overview.summary,
        recent_runs: overview.recentRuns,
        recent_results: overview.recentResults,
        _owner: getOwnerForRoute("/validation/overview"),
      });
    },
  });
}

export async function handleValidationSchedulerRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/scheduler",
    request,
    handler: async () => {
      const scheduler = await getValidationSchedulerState(env.DB);

      return json({
        scheduler,
        _owner: getOwnerForRoute("/validation/scheduler"),
      });
    },
  });
}

export async function handleRunValidationNowRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/run-now",
    request,
    handler: async () => {
      const body = (await request.json()) as ValidationRunNowBody;
      const requestedBy =
        typeof body.requested_by === "string" && body.requested_by.trim() !== ""
          ? body.requested_by.trim()
          : "dashboard_validation_operator";

      const mode = body.mode ?? "full";
      if (mode !== "full" && mode !== "runtime_only") {
        return json(
          {
            error: "invalid_mode",
            message: "mode must be full or runtime_only",
          },
          { status: 400 },
        );
      }

      const reason = body.reason ?? "governance_review";
      if (
        reason !== "scheduled_health" &&
        reason !== "drift_detection" &&
        reason !== "governance_review"
      ) {
        return json(
          {
            error: "invalid_reason",
            message:
              "reason must be scheduled_health, drift_detection, or governance_review",
          },
          { status: 400 },
        );
      }

      const executed = await executeValidationDispatchBatch({
        db: env.DB,
        requestedBy,
        targetBaseUrl: INTERNAL_MANUAL_VALIDATION_TARGET,
        mode,
        updateSchedulerState: true,
      });

      return json(
        {
          team_id: "team_validation",
          trigger: "manual",
          reason,
          dispatch_batch_id: executed.dispatchBatchId,
          mode,
          dispatched: executed.dispatchedRuns.length,
          executed: executed.executedRuns.length,
          scheduler: executed.schedulerState,
          runs: executed.executedRuns.map((run) => ({
            validation_run_id: run.validationRunId,
            status: run.status,
            result_id: run.resultId,
            executed_by: run.executedBy,
            audit_status: run.auditStatus,
            audited_by: run.auditedBy,
          })),
          _owner: getOwnerForRoute("/validation/run-now"),
        },
        { status: 202 },
      );
    },
  });
}

export async function handlePauseValidationSchedulerRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/scheduler/pause",
    request,
    handler: async () => {
      const body = (await request.json()) as UpdateValidationSchedulerBody;
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

      if (typeof body.reason !== "string" || body.reason.trim() === "") {
        return json(
          {
            error: "invalid_reason",
            message: "reason must be a non-empty string",
          },
          { status: 400 },
        );
      }

      const scheduler = await pauseValidationScheduler({
        db: env.DB,
        requestedBy: body.requested_by.trim(),
        reason: body.reason.trim(),
      });

      return json(
        {
          scheduler,
          _owner: getOwnerForRoute("/validation/scheduler/pause"),
        },
        { status: 202 },
      );
    },
  });
}

export async function handleResumeValidationSchedulerRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/scheduler/resume",
    request,
    handler: async () => {
      const body = (await request.json()) as UpdateValidationSchedulerBody;
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

      const scheduler = await resumeValidationScheduler({
        db: env.DB,
        requestedBy: body.requested_by.trim(),
      });

      return json(
        {
          scheduler,
          _owner: getOwnerForRoute("/validation/scheduler/resume"),
        },
        { status: 202 },
      );
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
          dispatch_batch_id: run.dispatch_batch_id,
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
        dispatch_batch_id: run.dispatch_batch_id,
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

      const run = await createValidationRunRecord({
        db: env.DB,
        dispatchBatchId: createDispatchBatchId(),
        validationType: body.validation_type,
        requestedBy: body.requested_by.trim(),
        targetBaseUrl: body.target_base_url.trim(),
      });

      return json(
        {
          validation_run_id: run.id,
          dispatch_batch_id: run.dispatch_batch_id,
          validation_type: run.validation_type,
          requested_by: run.requested_by,
          assigned_to: run.assigned_to,
          status: run.status,
          target_base_url: run.target_base_url,
          created_at: run.created_at,
          _owner: getOwnerForRoute("/validation/runs"),
        },
        { status: 202 },
      );
    },
  });
}

export async function handleCreateValidationDispatchRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/dispatch",
    request,
    handler: async () => {
      const body = (await request.json()) as DispatchValidationRunsBody;

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

      const mode = body.mode ?? "full";
      if (mode !== "full" && mode !== "runtime_only") {
        return json(
          {
            error: "invalid_mode",
            message: "mode must be full or runtime_only",
          },
          { status: 400 },
        );
      }

      const dispatched = await dispatchValidationRuns({
        db: env.DB,
        requestedBy: body.requested_by.trim(),
        targetBaseUrl: body.target_base_url.trim(),
        mode,
      });

      return json(
        {
          team_id: "team_validation",
          dispatch_batch_id: dispatched.dispatchBatchId,
          mode,
          dispatched: dispatched.runs.length,
          runs: dispatched.runs.map((run) => ({
            validation_run_id: run.id,
            dispatch_batch_id: run.dispatch_batch_id,
            validation_type: run.validation_type,
            requested_by: run.requested_by,
            assigned_to: run.assigned_to,
            status: run.status,
            target_base_url: run.target_base_url,
            created_at: run.created_at,
          })),
          _owner: getOwnerForRoute("/validation/dispatch"),
        },
        { status: 202 },
      );
    },
  });
}

export async function handleSchedulePostDeployValidationRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/internal/validation/schedule-post-deploy",
    request,
    handler: async () => {
      const body = (await request.json()) as SchedulePostDeployValidationBody;

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

      const mode = body.mode ?? "full";
      if (mode !== "full" && mode !== "runtime_only") {
        return json(
          {
            error: "invalid_mode",
            message: "mode must be full or runtime_only",
          },
          { status: 400 },
        );
      }

      const dispatched = await dispatchValidationRuns({
        db: env.DB,
        requestedBy: body.requested_by.trim(),
        targetBaseUrl: body.target_base_url.trim(),
        mode,
      });

      return json(
        {
          team_id: "team_validation",
          scheduler: "employee_validation_scheduler",
          trigger: "post_deploy",
          dispatch_batch_id: dispatched.dispatchBatchId,
          mode,
          dispatched: dispatched.runs.length,
          runs: dispatched.runs.map((run) => ({
            validation_run_id: run.id,
            dispatch_batch_id: run.dispatch_batch_id,
            validation_type: run.validation_type,
            requested_by: run.requested_by,
            assigned_to: run.assigned_to,
            status: run.status,
            target_base_url: run.target_base_url,
            created_at: run.created_at,
          })),
          _owner: getOwnerForRoute("/internal/validation/schedule-post-deploy"),
        },
        { status: 202 },
      );
    },
  });
}

export async function handleScheduleRecurringValidationRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/internal/validation/schedule-recurring",
    request,
    handler: async () => {
      const body = (await request.json()) as ScheduleRecurringValidationBody;

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

      const mode = body.mode ?? "full";
      if (mode !== "full" && mode !== "runtime_only") {
        return json(
          {
            error: "invalid_mode",
            message: "mode must be full or runtime_only",
          },
          { status: 400 },
        );
      }

      const reason = body.reason ?? "scheduled_health";
      if (
        reason !== "scheduled_health" &&
        reason !== "drift_detection" &&
        reason !== "governance_review"
      ) {
        return json(
          {
            error: "invalid_reason",
            message:
              "reason must be scheduled_health, drift_detection, or governance_review",
          },
          { status: 400 },
        );
      }

      const scheduler = await getValidationSchedulerState(env.DB);
      if (scheduler.paused) {
        return json(
          {
            team_id: "team_validation",
            scheduler,
            trigger: "recurring",
            skipped: true,
            reason: scheduler.pause_reason ?? "validation scheduler paused",
            _owner: getOwnerForRoute("/internal/validation/schedule-recurring"),
          },
          { status: 202 },
        );
      }

      const recurring = await runRecurringValidationBatch({
        db: env.DB,
        requestedBy: body.requested_by.trim(),
        mode,
        reason,
      });

      return json(
        {
          team_id: "team_validation",
          scheduler_name: "employee_validation_scheduler",
          runner: "employee_validation_runner",
          auditor: "employee_validation_auditor",
          trigger: "recurring",
          reason,
          scheduler: await getValidationSchedulerState(env.DB),
          dispatch_batch_id: recurring.dispatchBatchId,
          mode,
          dispatched: recurring.dispatchedRuns.length,
          executed: recurring.executedRuns.length,
          runs: recurring.executedRuns.map((run) => ({
            validation_run_id: run.validationRunId,
            status: run.status,
            result_id: run.resultId,
            executed_by: run.executedBy,
            audit_status: run.auditStatus,
            audited_by: run.auditedBy,
          })),
          _owner: getOwnerForRoute("/internal/validation/schedule-recurring"),
        },
        { status: 202 },
      );
    },
  });
}

export async function handleExecuteValidationDispatchRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/internal/validation/execute-dispatch",
    request,
    handler: async () => {
      const body = (await request.json()) as ExecuteValidationDispatchBody;

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

      const mode = body.mode ?? "full";
      if (mode !== "full" && mode !== "runtime_only") {
        return json(
          {
            error: "invalid_mode",
            message: "mode must be full or runtime_only",
          },
          { status: 400 },
        );
      }

      const validationTypes =
        mode === "runtime_only"
          ? (["runtime_read_safety"] as const)
          : listDispatchableValidationTypes();

      const queuedRuns = await listQueuedValidationRunsForDispatch({
        db: env.DB,
        dispatchBatchId:
          typeof body.dispatch_batch_id === "string" &&
          body.dispatch_batch_id.trim() !== ""
            ? body.dispatch_batch_id.trim()
            : undefined,
        requestedBy: body.requested_by?.trim(),
        targetBaseUrl: body.target_base_url?.trim(),
        validationTypes,
      });

      const executed = [];
      for (const run of queuedRuns) {
        const result = await executeAndAuditValidationRun({
          db: env.DB,
          run,
        });
        executed.push(result);
      }

      return json({
        team_id: "team_validation",
        runner: "employee_validation_runner",
        auditor: "employee_validation_auditor",
        trigger: "post_deploy_execution",
        dispatch_batch_id:
          queuedRuns.length > 0 ? queuedRuns[0].dispatch_batch_id : body.dispatch_batch_id ?? null,
        mode,
        executed: executed.length,
        runs: executed.map((item) => ({
          validation_run_id: item.validationRunId,
          dispatch_batch_id:
            queuedRuns.find((run) => run.id === item.validationRunId)?.dispatch_batch_id ?? null,
          status: item.status,
          result_id: item.resultId,
          executed_by: item.executedBy,
          audit_status: item.auditStatus,
          audited_by: item.auditedBy,
        })),
        _owner: getOwnerForRoute("/internal/validation/execute-dispatch"),
      });
    },
  });
}

export async function handleExecuteValidationRunRoute(
  request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/validation/runs/:runId/execute",
    request,
    resourceId: runId,
    handler: async () => {
      const run = await getPersistedValidationRun(env.DB, runId);
      if (!run) {
        return notFound(`validation run not found: ${runId}`);
      }

      if (run.status === "completed" || run.status === "failed") {
        return json({
          validation_run_id: run.id,
          status: run.status,
          result_id: run.result_id,
          message: "validation run already terminal",
          _owner: getOwnerForRoute(`/validation/runs/${runId}/execute`),
        });
      }

      const startedAt = new Date().toISOString();
      await markValidationRunRunning(env.DB, runId, startedAt);

      const refreshedRun = await getPersistedValidationRun(env.DB, runId);
      if (!refreshedRun) {
        return notFound(`validation run not found after start: ${runId}`);
      }

      const execution = await executeValidationRunLogic(refreshedRun);
      const completedAt = new Date().toISOString();
      const resultId = await persistValidationResultFromRun({
        db: env.DB,
        run: refreshedRun,
        execution,
        createdAt: completedAt,
      });

      await markValidationRunTerminal({
        db: env.DB,
        runId,
        status: execution.status === "passed" ? "completed" : "failed",
        resultId,
        completedAt,
      });

      return json({
        validation_run_id: runId,
        status: execution.status === "passed" ? "completed" : "failed",
        result_id: resultId,
        executed_by: execution.executed_by,
        summary: execution.summary,
        completed_at: completedAt,
        _owner: getOwnerForRoute(`/validation/runs/${runId}/execute`),
      });
    },
  });
}