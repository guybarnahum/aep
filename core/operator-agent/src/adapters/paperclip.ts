import { getConfig } from "@aep/operator-agent/config";
import type { ExecutionContext } from "@aep/operator-agent/types/execution-provenance";
import type {
  AgentExecutionResponse,
  EmployeeRunRequest,
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
    teamId: payload.teamId,
    workOrderId: payload.workOrderId,
    taskId: payload.taskId,
    employeeId: payload.employeeId,
    roleId: payload.roleId,
    trigger: "paperclip",
    policyVersion: payload.policyVersion ?? config.policyVersion,
    budgetOverride: payload.budgetOverride,
    authorityOverride: payload.authorityOverride,
    targetEmployeeIdOverride: (payload as unknown as Record<string, unknown>).targetEmployeeIdOverride as string | undefined,
    targetEmployeeIdsOverride: (payload as unknown as Record<string, unknown>).targetEmployeeIdsOverride as string[] | undefined,
  };
}

export function adaptPaperclipResponse(args: {
  payload: PaperclipRunRequest;
  request: EmployeeRunRequest;
  result: AgentExecutionResponse;
  executionContext?: ExecutionContext;
}): PaperclipRunResponse {
  return {
    ok: true,
    status: "completed",
    companyId: args.payload.companyId,
    workOrderId: args.payload.workOrderId,
    taskId: args.payload.taskId,
    heartbeatId: args.payload.heartbeatId,
    request: args.request,
    result: args.result,
    executionSource: "paperclip",
    cronFallbackRecommended: false,
    executionContext: args.executionContext,
  };
}