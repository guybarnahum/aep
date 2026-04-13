import { adaptPaperclipRequest, adaptPaperclipResponse } from "@aep/operator-agent/adapters/paperclip";
import { parseExecutionContext } from "@aep/operator-agent/lib/execution-context";
import { executeEmployeeRun, toErrorResponse } from "@aep/operator-agent/lib/execute-employee-run";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { validatePaperclipAuth } from "@aep/operator-agent/lib/paperclip-auth";
import { validatePaperclipRunRequest } from "@aep/operator-agent/lib/validate-paperclip-request";
import { getEmployeeById } from "@aep/operator-agent/org/employees";
import type { ExecutionContext } from "@aep/operator-agent/types/execution-provenance";
import type {
  AgentExecutionResponse,
  EmployeeRunRequest,
  OperatorAgentEnv,
  PaperclipRunRequest,
  ValidationAgentResponse,
} from "@aep/operator-agent/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getRequestedTaskId(body: unknown, executionContext?: ExecutionContext): string | null {
  const directTaskId = asRecord(body).taskId;
  if (typeof directTaskId === "string" && directTaskId.length > 0) {
    return directTaskId;
  }

  const legacyWorkOrderId = asRecord(body).workOrderId;
  if (typeof legacyWorkOrderId === "string" && legacyWorkOrderId.length > 0) {
    return legacyWorkOrderId;
  }

  const contextTaskId = executionContext && "taskId" in executionContext
    ? executionContext.taskId
    : undefined;
  if (typeof contextTaskId === "string" && contextTaskId.length > 0) {
    return contextTaskId;
  }

  const value = asRecord(body).workOrderId;
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return executionContext && "workOrderId" in executionContext && typeof executionContext.workOrderId === "string"
    ? executionContext.workOrderId
    : null;
}

function withTaskId(
  executionContext: ExecutionContext,
  taskId: string,
  workOrderId?: string,
): ExecutionContext {
  const hasSameTaskId = "taskId" in executionContext && executionContext.taskId === taskId;
  const hasSameWorkOrderId = !workOrderId
    || ("workOrderId" in executionContext && executionContext.workOrderId === workOrderId);

  if (hasSameTaskId && hasSameWorkOrderId) {
    return executionContext;
  }

  return {
    ...executionContext,
    taskId,
    ...(workOrderId ? { workOrderId } : {}),
  };
}

function taskDecisionId(taskId: string, employeeId: string): string {
  return `${taskId}:${employeeId}:${Date.now()}`;
}

function inferEvidenceTraceId(result: AgentExecutionResponse): string | undefined {
  if ("decisions" in result && result.decisions.length > 0 && "runId" in result.decisions[0]) {
    return result.decisions[0].runId;
  }

  return undefined;
}

function isValidationAgentResponse(
  result: AgentExecutionResponse,
): result is ValidationAgentResponse {
  return "workerRole" in result && result.workerRole === "reliability-engineer";
}

function inferVerdict(result: AgentExecutionResponse): {
  verdict: "pass" | "fail" | "remediate" | "manual_escalation";
  reasoning: string;
} {
  if ("control" in result) {
    return {
      verdict: "manual_escalation",
      reasoning: result.message,
    };
  }

  if ("observedEmployeeIds" in result) {
    return {
      verdict: result.summary.decisionsEmitted > 0 ? "manual_escalation" : "pass",
      reasoning: result.message,
    };
  }

  if (isValidationAgentResponse(result)) {
    if (result.summary.remediations > 0) {
      return {
        verdict: "remediate",
        reasoning: result.message,
      };
    }

    if (result.summary.failed > 0) {
      return {
        verdict: "fail",
        reasoning: result.message,
      };
    }

    if (result.decisions.some((decision) => decision.verdict === "manual_escalation")) {
      return {
        verdict: "manual_escalation",
        reasoning: result.message,
      };
    }

    return {
      verdict: "pass",
      reasoning: result.message,
    };
  }

  if (result.summary.verificationFailed > 0 || result.summary.operatorActionFailed > 0) {
    return {
      verdict: "fail",
      reasoning: result.message,
    };
  }

  if (result.summary.actionRequested > 0 || result.summary.verifiedApplied > 0) {
    return {
      verdict: "remediate",
      reasoning: result.message,
    };
  }

  return {
    verdict: "pass",
    reasoning: result.message,
  };
}

async function claimTaskIfPresent(
  body: unknown,
  env: OperatorAgentEnv | undefined,
  executionContext: ExecutionContext,
): Promise<
  | { ok: true; taskId: string | null; executionContext: ExecutionContext }
  | { ok: false; response: Response }
> {
  const taskId = getRequestedTaskId(body, executionContext);
  const workOrderId = typeof asRecord(body).workOrderId === "string"
    ? (asRecord(body).workOrderId as string)
    : undefined;

  if (!taskId) {
    return { ok: true, taskId: null, executionContext };
  }

  if (!env) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          status: "control_plane_unavailable",
          error: "Task-backed runs require OPERATOR_AGENT_DB",
        },
        { status: 503 },
      ),
    };
  }

  const employeeId = typeof asRecord(body).employeeId === "string"
    ? (asRecord(body).employeeId as string)
    : null;
  const employee = employeeId ? getEmployeeById(employeeId) : undefined;
  const requestedTeamId = typeof asRecord(body).teamId === "string"
    ? (asRecord(body).teamId as string)
    : undefined;

  const taskStore = getTaskStore(env);
  const task = await taskStore.getTask(taskId);

  if (!task) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          status: "invalid_request",
          error: `Task ${taskId} not found`,
        },
        { status: 400 },
      ),
    };
  }

  const effectiveTeamId = employee?.identity.teamId ?? requestedTeamId;
  if (effectiveTeamId && task.assignedTeamId !== effectiveTeamId) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          status: "role_mismatch",
          error: `Employee ${employeeId ?? "unknown"} cannot claim task for assigned team ${task.assignedTeamId}`,
        },
        { status: 400 },
      ),
    };
  }

  await taskStore.updateTaskStatus(taskId, "in_progress");

  return {
    ok: true,
    taskId,
    executionContext: withTaskId(executionContext, taskId, workOrderId),
  };
}

async function recordTaskDecisionIfPresent(args: {
  env?: OperatorAgentEnv;
  taskId: string | null;
  employeeId: string;
  result: AgentExecutionResponse;
}): Promise<void> {
  if (!args.env || !args.taskId) {
    return;
  }

  if (
    isValidationAgentResponse(args.result) &&
    args.result.decisions.some((decision) => decision.taskId === args.taskId)
  ) {
    return;
  }

  const taskStore = getTaskStore(args.env);
  const verdict = inferVerdict(args.result);

  await taskStore.recordDecision({
    id: taskDecisionId(args.taskId, args.employeeId),
    taskId: args.taskId,
    employeeId: args.employeeId,
    verdict: verdict.verdict,
    reasoning: verdict.reasoning,
    evidenceTraceId: inferEvidenceTraceId(args.result),
  });
}

export async function handleRun(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: unknown;
  let executionContext: ExecutionContext;

  try {
    executionContext = await parseExecutionContext(request);
  } catch (err) {
    return Response.json(
      {
        ok: false,
        status: "invalid_request",
        error: err instanceof Error ? err.message : "Invalid execution source",
      },
      { status: 400 }
    );
  }

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        status: "invalid_request",
        error: "Request body must be valid JSON",
      },
      { status: 400 }
    );
  }

  try {
    const routing = {
      employeeId:
        typeof asRecord(body).employeeId === "string"
          ? (asRecord(body).employeeId as string)
          : null,
      workerId:
        typeof asRecord(body).workerId === "string"
          ? (asRecord(body).workerId as string)
          : null,
      taskId:
        typeof asRecord(body).taskId === "string"
          ? (asRecord(body).taskId as string)
          : typeof asRecord(body).workOrderId === "string"
            ? (asRecord(body).workOrderId as string)
            : null,
      workOrderId:
        typeof asRecord(body).workOrderId === "string"
          ? (asRecord(body).workOrderId as string)
          : null,
    };

    const taskClaim = await claimTaskIfPresent(body, env, executionContext);
    if (!taskClaim.ok) {
      return taskClaim.response;
    }

    executionContext = taskClaim.executionContext;

    if (executionContext.executionSource === "paperclip") {
      try {
        validatePaperclipAuth(request, env);
        validatePaperclipRunRequest(body);
      } catch (err) {
        return Response.json(
          {
            ok: false,
            status: "invalid_request",
            error:
              err instanceof Error ? err.message : "Invalid Paperclip request",
          },
          { status: 400 }
        );
      }

      const paperclipPayload = body as PaperclipRunRequest;
      const adaptedRequest = adaptPaperclipRequest(paperclipPayload, env);
      try {
        const result = await executeEmployeeRun(adaptedRequest, env, executionContext);
        await recordTaskDecisionIfPresent({
          env,
          taskId: taskClaim.taskId,
          employeeId: adaptedRequest.employeeId,
          result,
        });

        const paperclipResult = adaptPaperclipResponse({
          payload: paperclipPayload,
          request: adaptedRequest,
          result,
          executionContext,
        });

        return Response.json({
          ...paperclipResult,
          executionContext,
          routing,
        });
      } catch (error) {
        if (env && taskClaim.taskId) {
          await getTaskStore(env).updateTaskStatus(taskClaim.taskId, "failed");
        }
        return toErrorResponse(error, env);
      }
    }

    try {
      const typedBody = body as EmployeeRunRequest;
      const result = await executeEmployeeRun(
        typedBody,
        env,
        executionContext
      );
      await recordTaskDecisionIfPresent({
        env,
        taskId: taskClaim.taskId,
        employeeId: typedBody.employeeId,
        result,
      });
      return Response.json({
        ...result,
        executionContext,
        routing,
      });
    } catch (error) {
      if (env && taskClaim.taskId) {
        await getTaskStore(env).updateTaskStatus(taskClaim.taskId, "failed");
      }
      return toErrorResponse(error, env);
    }
  } catch (error) {
    return toErrorResponse(error, env);
  }
}