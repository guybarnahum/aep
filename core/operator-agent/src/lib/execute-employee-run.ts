import { getConfig } from "@aep/operator-agent/config";
import { runInfraOpsManager } from "@aep/operator-agent/agents/infra-ops-manager";
import { runTimeoutRecoveryOperator } from "@aep/operator-agent/agents/timeout-recovery";
import { EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store";
import { cloneAuthority } from "@aep/operator-agent/org/authority";
import { cloneBudget } from "@aep/operator-agent/org/budgets";
import { getEmployeeById } from "@aep/operator-agent/org/employees";
import type {
  AgentExecutionResponse,
  EmployeeControlBlockedResponse,
  EmployeeRunRequest,
  EmployeeRunErrorResponse,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
} from "@aep/operator-agent/types";

function validateRunRequest(
  request: EmployeeRunRequest
): EmployeeRunErrorResponse | undefined {
  if (!request.departmentId) {
    return {
      ok: false,
      status: "invalid_request",
      error: "Missing required field: departmentId",
    };
  }

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

  return undefined;
}

function resolveRunContext(
  request: EmployeeRunRequest
): ResolvedEmployeeRunContext | EmployeeRunErrorResponse {
  const employee = getEmployeeById(request.employeeId);

  if (!employee) {
    return {
      ok: false,
      status: "employee_not_found",
      error: `Unknown employeeId: ${request.employeeId}`,
    };
  }

  if (request.departmentId !== employee.identity.departmentId) {
    return {
      ok: false,
      status: "role_mismatch",
      error: `departmentId mismatch for employee ${request.employeeId}`,
    };
  }

  if (request.roleId !== employee.identity.roleId) {
    return {
      ok: false,
      status: "role_mismatch",
      error: `roleId mismatch for employee ${request.employeeId}`,
    };
  }

  const authority = {
    ...cloneAuthority(employee.authority),
    ...(request.authorityOverride ?? {}),
  };

  const budget = {
    ...cloneBudget(employee.budget),
    ...(request.budgetOverride ?? {}),
  };

  return {
    request,
    employee,
    authority,
    budget,
    policyVersion: request.policyVersion,
  };
}

async function maybeReturnBlockedByControl(
  resolved: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv
): Promise<EmployeeControlBlockedResponse | null> {
  if (resolved.employee.identity.roleId === "infra-ops-manager") {
    return null;
  }

  const store = new EmployeeControlStore(env ?? {});
  const control = await store.get(resolved.employee.identity.employeeId);

  if (!control || control.enabled) {
    return null;
  }

  return {
    ok: true,
    status: "skipped_disabled_by_manager",
    policyVersion: resolved.policyVersion,
    trigger: resolved.request.trigger,
    employee: resolved.employee.identity,
    message:
      "Employee run was skipped because the employee is currently disabled by a local manager control.",
    control,
  };
}

export async function executeEmployeeRun(
  request: EmployeeRunRequest,
  env?: OperatorAgentEnv
): Promise<AgentExecutionResponse> {
  const validationError = validateRunRequest(request);
  if (validationError) {
    throw Object.assign(new Error(validationError.error), {
      response: validationError,
      httpStatus: 400,
    });
  }

  const resolved = resolveRunContext(request);
  if ("ok" in resolved) {
    throw Object.assign(new Error(resolved.error), {
      response: resolved,
      httpStatus:
        resolved.status === "employee_not_found" ? 404 : 400,
    });
  }

  const blocked = await maybeReturnBlockedByControl(resolved, env);
  if (blocked) {
    return blocked;
  }

  switch (resolved.employee.identity.roleId) {
    case "timeout-recovery-operator":
      return runTimeoutRecoveryOperator(resolved, env);
    case "infra-ops-manager":
      return runInfraOpsManager(resolved, env);
    default:
      throw Object.assign(
        new Error(
          `No execution handler implemented for roleId ${resolved.employee.identity.roleId}`
        ),
        {
          response: {
            ok: false,
            status: "employee_not_found",
            error: `No execution handler implemented for roleId ${resolved.employee.identity.roleId}`,
          } satisfies EmployeeRunErrorResponse,
          httpStatus: 404,
        }
      );
  }
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
      controlPlaneBaseUrl: config.controlPlaneBaseUrl,
      error: message,
    } satisfies EmployeeRunErrorResponse,
    { status: 503 }
  );
}
