import { adaptPaperclipRequest, adaptPaperclipResponse } from "@aep/operator-agent/adapters/paperclip";
import { parseExecutionContext } from "@aep/operator-agent/lib/execution-context";
import { executeEmployeeRun, toErrorResponse } from "@aep/operator-agent/lib/execute-employee-run";
import { resolveRuntimeEmployeeById } from "@aep/operator-agent/persistence/d1/runtime-employee-resolver-d1";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { validatePaperclipAuth } from "@aep/operator-agent/lib/paperclip-auth";
import { validatePaperclipRunRequest } from "@aep/operator-agent/lib/validate-paperclip-request";
import { COMPANY_INTERNAL_AEP, type CompanyId } from "@aep/operator-agent/org/company";
import {
  TEAM_INFRA,
  TEAM_VALIDATION,
  TEAM_WEB_PRODUCT,
  type TeamId,
} from "@aep/operator-agent/org/teams";
import type {
  Task,
  TaskArtifact,
} from "@aep/operator-agent/lib/store-types";
import type { ExecutionContext } from "@aep/operator-agent/types/execution-provenance";
import type {
  AgentExecutionResponse,
  CoordinationTaskArtifactRecord,
  CoordinationTaskRecord,
  EmployeeRunRequest,
  OperatorAgentEnv,
  PaperclipRunRequest,
  ResolvedTaskExecutionContext,
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

function toCompanyId(companyId: string): CompanyId {
  if (companyId !== COMPANY_INTERNAL_AEP) {
    throw new Error(`Unsupported companyId in task context: ${companyId}`);
  }

  return companyId;
}

function toTeamId(teamId: string): TeamId {
  const validTeams: TeamId[] = [
    TEAM_INFRA,
    TEAM_WEB_PRODUCT,
    TEAM_VALIDATION,
  ];

  if (!validTeams.includes(teamId as TeamId)) {
    throw new Error(`Unsupported teamId in task context: ${teamId}`);
  }

  return teamId as TeamId;
}

function toCoordinationTaskRecord(task: Task): CoordinationTaskRecord {
  return {
    ...task,
    companyId: toCompanyId(task.companyId),
    originatingTeamId: toTeamId(task.originatingTeamId),
    assignedTeamId: toTeamId(task.assignedTeamId),
  };
}

function toCoordinationTaskArtifactRecord(
  artifact: TaskArtifact,
): CoordinationTaskArtifactRecord {
  return {
    ...artifact,
    companyId: toCompanyId(artifact.companyId),
  };
}

async function loadTaskExecutionContext(
  env: OperatorAgentEnv | undefined,
  taskId: string | null,
): Promise<ResolvedTaskExecutionContext | undefined> {
  if (!env || !taskId) {
    return undefined;
  }

  const taskStore = getTaskStore(env);
  const task = await taskStore.getTask(taskId);

  if (!task) {
    return undefined;
  }

  const [dependencies, artifacts] = await Promise.all([
    taskStore.listDependencies(taskId),
    taskStore.listArtifacts({
      taskId,
      limit: 50,
    }),
  ]);

  // Task, dependency, and artifact context form the bounded public substrate
  // employees can reason over without pushing private cognition into route payloads.
  return {
    task: toCoordinationTaskRecord(task),
    dependencies,
    artifacts: artifacts.map(toCoordinationTaskArtifactRecord),
  };
}

async function createPlanArtifactIfPresent(args: {
  env?: OperatorAgentEnv;
  taskContext?: ResolvedTaskExecutionContext;
  request: EmployeeRunRequest;
  executionContext: ExecutionContext;
}): Promise<void> {
  if (!args.env || !args.taskContext) {
    return;
  }

  const taskStore = getTaskStore(args.env);

  await taskStore.createArtifact({
    id: `art_${crypto.randomUUID().split("-")[0]}`,
    taskId: args.taskContext.task.id,
    companyId: args.taskContext.task.companyId,
    artifactType: "plan",
    createdByEmployeeId: args.request.employeeId,
    summary: `Execution plan for ${args.request.roleId}`,
    content: {
      employeeId: args.request.employeeId,
      roleId: args.request.roleId,
      trigger: args.request.trigger,
      executionSource: args.executionContext.executionSource,
      routingTaskId: args.executionContext.taskId ?? args.executionContext.workOrderId ?? null,
      task: {
        id: args.taskContext.task.id,
        taskType: args.taskContext.task.taskType,
        status: args.taskContext.task.status,
      },
      dependencyCount: args.taskContext.dependencies.length,
      priorArtifactCount: args.taskContext.artifacts.length,
    },
  });
}

async function createResultArtifactIfPresent(args: {
  env?: OperatorAgentEnv;
  taskContext?: ResolvedTaskExecutionContext;
  request: EmployeeRunRequest;
  result: AgentExecutionResponse;
}): Promise<void> {
  if (!args.env || !args.taskContext) {
    return;
  }

  const taskStore = getTaskStore(args.env);

  await taskStore.createArtifact({
    id: `art_${crypto.randomUUID().split("-")[0]}`,
    taskId: args.taskContext.task.id,
    companyId: args.taskContext.task.companyId,
    artifactType: "result",
    createdByEmployeeId: args.request.employeeId,
    summary: args.result.message,
    content: {
      // Route-level outputs and artifacts remain public/reviewable only.
      status: args.result.status,
      workerRole: "workerRole" in args.result ? args.result.workerRole : undefined,
      message: args.result.message,
      summary: "summary" in args.result ? args.result.summary : undefined,
      decisions: "decisions" in args.result ? args.result.decisions : undefined,
    },
  });
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
  const employee = employeeId
    ? await resolveRuntimeEmployeeById(env, employeeId)
    : undefined;
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
    const taskContext = await loadTaskExecutionContext(env, taskClaim.taskId);

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
        await createPlanArtifactIfPresent({
          env,
          taskContext,
          request: adaptedRequest,
          executionContext,
        });
        const result = await executeEmployeeRun(adaptedRequest, env, executionContext, taskContext);
        await createResultArtifactIfPresent({
          env,
          taskContext,
          request: adaptedRequest,
          result,
        });
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
      await createPlanArtifactIfPresent({
        env,
        taskContext,
        request: typedBody,
        executionContext,
      });
      const result = await executeEmployeeRun(
        typedBody,
        env,
        executionContext,
        taskContext,
      );
      await createResultArtifactIfPresent({
        env,
        taskContext,
        request: typedBody,
        result,
      });
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