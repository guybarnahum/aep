import { summarizeTaskVisibility } from "@aep/operator-agent/lib/human-visibility-summary";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import {
  TaskPayloadValidationError,
  TaskTypeValidationError,
  evaluateTaskArtifactExpectations,
} from "@aep/operator-agent/lib/task-contracts";
import {
  TaskDependencyValidationError,
  type Decision,
  type TaskStatus,
} from "@aep/operator-agent/lib/store-types";
import { newId } from "@aep/shared";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type CreateTaskRequest = {
  companyId?: string;
  originatingTeamId?: string;
  assignedTeamId?: string;
  ownerEmployeeId?: string;
  assignedEmployeeId?: string;
  createdByEmployeeId?: string;
  taskType?: string;
  title?: string;
  payload?: Record<string, unknown>;
  dependsOnTaskIds?: string[];
};

type ParkTaskRequest = {
  parkedByEmployeeId?: string;
  reason?: string;
  managerDecisionId?: string;
};

type DecisionRow = Decision;

function parseLimit(url: URL, defaultValue = 50): number {
  const raw = Number.parseInt(url.searchParams.get("limit") ?? `${defaultValue}`, 10);
  if (!Number.isFinite(raw) || raw <= 0) return defaultValue;
  return Math.min(raw, 200);
}

export async function handleCreateTask(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  let body: CreateTaskRequest;
  try {
    body = (await request.json()) as CreateTaskRequest;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  if (!body.originatingTeamId || !body.assignedTeamId || !body.taskType || !body.title) {
    return Response.json(
      {
        ok: false,
        error:
          "originatingTeamId, assignedTeamId, taskType, and title are required",
      },
      { status: 400 },
    );
  }

  const store = getTaskStore(env);
  const taskId = newId("task");

  try {
    await store.createTaskWithDependencies({
      task: {
        id: taskId,
        companyId: body.companyId ?? "company_internal_aep",
        originatingTeamId: body.originatingTeamId,
        assignedTeamId: body.assignedTeamId,
        ownerEmployeeId: body.ownerEmployeeId,
        assignedEmployeeId: body.assignedEmployeeId,
        createdByEmployeeId: body.createdByEmployeeId,
        taskType: body.taskType,
        title: body.title,
        payload: body.payload ?? {},
      },
      dependsOnTaskIds: body.dependsOnTaskIds ?? [],
    });
  } catch (error) {
    if (error instanceof TaskTypeValidationError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          code: "unsupported_task_type",
          details: { taskType: error.taskType },
        },
        { status: 400 },
      );
    }

    if (error instanceof TaskPayloadValidationError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          details: {
            taskType: error.taskType,
            field: error.field,
            expectedType: error.expectedType ?? null,
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof TaskDependencyValidationError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          details: error.details ?? null,
        },
        { status: 400 },
      );
    }
    throw error;
  }

  return Response.json({ ok: true, taskId }, { status: 201 });
}

export async function handleListTasks(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const store = getTaskStore(env);

  try {
    const tasks = await store.listTasks({
      companyId: url.searchParams.get("companyId") ?? undefined,
      assignedTeamId: url.searchParams.get("assignedTeamId") ?? undefined,
      assignedEmployeeId: url.searchParams.get("assignedEmployeeId") ?? undefined,
      status: (url.searchParams.get("status") as TaskStatus | null) ?? undefined,
      limit: parseLimit(url),
    });

    return Response.json({
      ok: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        error: message.includes("Failed to normalize taskType")
          ? `Data integrity error while listing tasks: ${message}`
          : `Failed to list tasks: ${message}`,
      },
      { status: 500 },
    );
  }
}

export async function handleGetTask(
  request: Request,
  env: OperatorAgentEnv | undefined,
  taskId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  const store = getTaskStore(env);
  let task;
  try {
    task = await store.getTask(taskId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        error: message.includes("Failed to normalize taskType")
          ? `Data integrity error while loading task ${taskId}: ${message}`
          : `Failed to load task ${taskId}: ${message}`,
      },
      { status: 500 },
    );
  }

  if (!task) {
    return Response.json({ ok: false, error: "task not found" }, { status: 404 });
  }

  const dependencies = await store.listDependencies(taskId);
  const artifacts = await store.listArtifacts({
    taskId,
    limit: 50,
  });
  const relatedThreads = await store.listMessageThreads({
    companyId: task.companyId,
    relatedTaskId: taskId,
    limit: 20,
  });

  let decision: DecisionRow | null = null;
  if (task.status === "completed" || task.status === "failed") {
    if (!env.OPERATOR_AGENT_DB) {
      return Response.json(
        { ok: false, error: "Missing OPERATOR_AGENT_DB binding" },
        { status: 500 },
      );
    }

    const row = await env.OPERATOR_AGENT_DB.prepare(
      `SELECT id, task_id AS taskId, employee_id AS employeeId, verdict, reasoning, evidence_trace_id AS evidenceTraceId, created_at AS createdAt
       FROM decisions
       WHERE task_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
      .bind(taskId)
      .first<DecisionRow>();

    decision = row ?? null;
  }

  const visibilitySummary = summarizeTaskVisibility({
    artifacts,
    decision,
    relatedThreads,
  });
  const artifactExpectations = evaluateTaskArtifactExpectations({
    taskType: task.taskType,
    artifactTypes: artifacts.map((artifact) => artifact.artifactType),
  });

  return Response.json({
    ok: true,
    task,
    dependencies,
    artifacts,
    artifactExpectations,
    decision,
    relatedThreads,
    visibilitySummary,
  });
}

export async function handleParkTask(
  request: Request,
  env: OperatorAgentEnv | undefined,
  taskId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  let body: ParkTaskRequest;
  try {
    body = (await request.json()) as ParkTaskRequest;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parkedByEmployeeId = body.parkedByEmployeeId?.trim();
  const reason = body.reason?.trim();
  const managerDecisionId = body.managerDecisionId?.trim();

  if (!parkedByEmployeeId || !reason || !managerDecisionId) {
    return Response.json(
      {
        ok: false,
        error: "parkedByEmployeeId, reason, and managerDecisionId are required",
      },
      { status: 400 },
    );
  }

  const store = getTaskStore(env);
  try {
    await store.parkTask({
      taskId,
      parkedByEmployeeId,
      reason,
      managerDecisionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: message.includes("unknown task") ? 404 : 400 },
    );
  }

  return Response.json({
    ok: true,
    taskId,
    status: "parked",
    managerDecisionId,
  });
}