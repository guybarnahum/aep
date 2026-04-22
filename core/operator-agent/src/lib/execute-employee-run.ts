import { getConfig } from "@aep/operator-agent/config";
import { getImplementationBindingExecutor } from "@aep/operator-agent/lib/implementation-binding-registry";
import { createStores } from "@aep/operator-agent/lib/store-factory";
import { mergeAuthority, mergeBudget } from "@aep/operator-agent/lib/policy-merge";
import { validateRoleCatalogEntry } from "@aep/operator-agent/persistence/d1/role-catalog-store-d1";
import { cloneAuthority } from "@aep/operator-agent/org/authority";
import { cloneBudget } from "@aep/operator-agent/org/budgets";
import { getEmployeeById } from "@aep/operator-agent/org/employees";
import type { ExecutionContext } from "@aep/operator-agent/types/execution-provenance";
import type {
  AgentExecutionResponse,
  EffectiveEmployeePolicy,
  EmployeeControlBlockedResponse,
  EmployeeRunRequest,
  EmployeeRunErrorResponse,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
  ResolvedEmployeeControl,
  ResolvedTaskExecutionContext,
} from "@aep/operator-agent/types";

function validateRunRequest(
  request: EmployeeRunRequest
): EmployeeRunErrorResponse | undefined {
  if (!request.employeeId) {
    return {
      ok: false,
      status: "invalid_request",
      error: "Missing required field: employeeId",
    };
  }

  if (!request.roleId) {
    return {
      ok: false,
      status: "invalid_request",
      error: "Missing required field: roleId",
    };
  }

  if (!request.trigger) {
    return {
      ok: false,
      status: "invalid_request",
      error: "Missing required field: trigger",
    };
  }

  if (!request.policyVersion) {
    return {
      ok: false,
      status: "invalid_request",
      error: "Missing required field: policyVersion",
    };
  }

  if (request.companyId == null && request.teamId == null) {
    return undefined;
  }

  return undefined;
}

async function resolveRunContext(
  request: EmployeeRunRequest,
  env?: OperatorAgentEnv,
  executionContext?: ExecutionContext,
): Promise<ResolvedEmployeeRunContext | EmployeeRunErrorResponse> {
  const employee = getEmployeeById(request.employeeId);
  let roleCatalogEntry: ResolvedEmployeeRunContext["roleCatalogEntry"];

  if (!employee) {
    return {
      ok: false,
      status: "employee_not_found",
      error: `Unknown employeeId: ${request.employeeId}`,
    };
  }

  if (
    request.companyId != null &&
    request.companyId !== employee.identity.companyId &&
    executionContext?.executionSource !== "paperclip"
  ) {
    return {
      ok: false,
      status: "role_mismatch",
      error: `companyId mismatch for employee ${request.employeeId}`,
    };
  }

  if (request.teamId != null && request.teamId !== employee.identity.teamId) {
    return {
      ok: false,
      status: "role_mismatch",
      error: `teamId mismatch for employee ${request.employeeId}`,
    };
  }

  if (request.roleId !== employee.identity.roleId) {
    return {
      ok: false,
      status: "role_mismatch",
      error: `roleId mismatch for employee ${request.employeeId}`,
    };
  }

  if (env?.OPERATOR_AGENT_DB) {
    try {
      roleCatalogEntry = await validateRoleCatalogEntry(env, {
        roleId: request.roleId,
        teamId: employee.identity.teamId,
        requireRuntimeEnabled: true,
      });
    } catch (error) {
      return {
        ok: false,
        status: "role_mismatch",
        error:
          error instanceof Error
            ? error.message
            : `Invalid runtime role: ${request.roleId}`,
      };
    }
  }

  const authority = cloneAuthority(employee.authority);
  const budget = cloneBudget(employee.budget);

  return {
    request,
    employee,
    roleCatalogEntry,
    authority,
    budget,
    policyVersion: request.policyVersion,
  };
}

async function resolveEffectivePolicy(
  resolved: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv
): Promise<EffectiveEmployeePolicy> {
  const store = createStores(env ?? {}).employeeControls;
  const control = await store.getEffective(
    resolved.employee.identity.employeeId,
    new Date().toISOString()
  );

  const authority = mergeAuthority(
    cloneAuthority(resolved.employee.authority),
    control.authorityOverride,
    resolved.request.authorityOverride
  );

  const budget = mergeBudget(
    cloneBudget(resolved.employee.budget),
    control.budgetOverride,
    resolved.request.budgetOverride
  );

  return {
    authority,
    budget,
    control,
  };
}

async function maybeReturnBlockedByControl(
  resolved: ResolvedEmployeeRunContext,
  effectiveControl: ResolvedEmployeeControl
): Promise<EmployeeControlBlockedResponse | null> {
  if (resolved.employee.identity.roleId === "infra-ops-manager") {
    return null;
  }

  if (!effectiveControl.blocked || !effectiveControl.control) {
    return null;
  }

  if (effectiveControl.state === "disabled_pending_review") {
    return {
      ok: true,
      status: "skipped_pending_review",
      policyVersion: resolved.policyVersion,
      trigger: resolved.request.trigger,
      employee: resolved.employee.identity,
      message:
        "Employee run was skipped because the employee is currently paused pending manager review.",
      control: effectiveControl.control,
    };
  }

  return {
    ok: true,
    status: "skipped_disabled_by_manager",
    policyVersion: resolved.policyVersion,
    trigger: resolved.request.trigger,
    employee: resolved.employee.identity,
    message:
      "Employee run was skipped because the employee is currently disabled by a local manager control.",
    control: effectiveControl.control,
  };
}

export async function executeEmployeeRun(
  request: EmployeeRunRequest,
  env?: OperatorAgentEnv,
  executionContext?: ExecutionContext,
  taskContext?: ResolvedTaskExecutionContext,
): Promise<AgentExecutionResponse> {
  const validationError = validateRunRequest(request);
  if (validationError) {
    throw Object.assign(new Error(validationError.error), {
      response: validationError,
      httpStatus: 400,
    });
  }

  const resolved = await resolveRunContext(request, env, executionContext);
  if ("ok" in resolved) {
    throw Object.assign(new Error(resolved.error), {
      response: resolved,
      httpStatus:
        resolved.status === "employee_not_found" ? 404 : 400,
    });
  }

  const effectivePolicy = await resolveEffectivePolicy(resolved, env);

  const blocked = await maybeReturnBlockedByControl(
    resolved,
    effectivePolicy.control
  );
  if (blocked) {
    return blocked;
  }

  const runContext: ResolvedEmployeeRunContext = {
    ...resolved,
    authority: effectivePolicy.authority,
    budget: effectivePolicy.budget,
    // taskContext is the bounded task/dependency/artifact input available to employee-local cognition.
    executionContext,
    taskContext,
  };

  if (runContext.roleCatalogEntry?.implementationBinding) {
    try {
      const executor = getImplementationBindingExecutor(
        runContext.roleCatalogEntry.implementationBinding,
      );
      return await executor(runContext, env);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Invalid implementation binding for roleId ${resolved.employee.identity.roleId}`;

      throw Object.assign(new Error(message), {
        response: {
          ok: false,
          status: "role_mismatch",
          error: message,
        } satisfies EmployeeRunErrorResponse,
        httpStatus: 400,
      });
    }
  }

  throw Object.assign(
    new Error(
      `Role ${resolved.employee.identity.roleId} is missing implementation_binding`,
    ),
    {
      response: {
        ok: false,
        status: "role_mismatch",
        error: `Role ${resolved.employee.identity.roleId} is missing implementation_binding`,
      } satisfies EmployeeRunErrorResponse,
      httpStatus: 400,
    },
  );
}

export function toErrorResponse(
  error: unknown,
  env?: OperatorAgentEnv
): Response {
  const config = getConfig(env);

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    "httpStatus" in error
  ) {
    const typed = error as {
      response: EmployeeRunErrorResponse;
      httpStatus: number;
    };

    return Response.json(typed.response, { status: typed.httpStatus });
  }

  const message = error instanceof Error ? error.message : String(error);

  return Response.json(
    {
      ok: false,
      status: "control_plane_unavailable",
      policyVersion: config.policyVersion,
      controlPlaneBaseUrl: config.controlPlaneTarget,
      controlPlaneTarget: config.controlPlaneTarget,
      error: message,
    } satisfies EmployeeRunErrorResponse,
    { status: 503 }
  );
}
