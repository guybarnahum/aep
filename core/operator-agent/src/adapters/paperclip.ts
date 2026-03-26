import { getConfig } from "@aep/operator-agent/config";
import type {
  EmployeeRunRequest,
  EmployeeRunResponse,
  OperatorAgentEnv,
  PaperclipRunRequest,
  PaperclipRunResponse,
} from "@aep/operator-agent/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPaperclipRunRequest(value: unknown): value is PaperclipRunRequest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.trigger === "paperclip" ||
    typeof value.taskId === "string" ||
    typeof value.heartbeatId === "string"
  );
}

export function adaptPaperclipRequest(
  payload: PaperclipRunRequest,
  env?: OperatorAgentEnv
): EmployeeRunRequest {
  const config = getConfig(env);

  return {
    companyId: payload.companyId,
    departmentId: payload.departmentId,
    employeeId: payload.employeeId,
    roleId: payload.roleId,
    trigger: "paperclip",
    policyVersion: payload.policyVersion ?? config.policyVersion,
    budgetOverride: payload.budgetOverride,
    authorityOverride: payload.authorityOverride,
  };
}

export function adaptPaperclipResponse(args: {
  payload: PaperclipRunRequest;
  request: EmployeeRunRequest;
  result: EmployeeRunResponse;
}): PaperclipRunResponse {
  return {
    ok: true,
    status: "completed",
    companyId: args.payload.companyId,
    taskId: args.payload.taskId,
    heartbeatId: args.payload.heartbeatId,
    request: args.request,
    result: args.result,
  };
}