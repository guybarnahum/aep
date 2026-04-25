import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { TaskDependencyValidationError } from "@aep/operator-agent/lib/store-types";
import { isTeamId } from "@aep/operator-agent/org/teams";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newId } from "@aep/shared";

type ProjectTaskPlanItem = {
  clientTaskId?: unknown;
  title?: unknown;
  taskType?: unknown;
  assignedTeamId?: unknown;
  ownerEmployeeId?: unknown;
  assignedEmployeeId?: unknown;
  payload?: unknown;
  dependsOnClientTaskIds?: unknown;
};

type CreateProjectTaskGraphBody = {
  createdByEmployeeId?: unknown;
  rationale?: unknown;
  tasks?: unknown;
};

type ParsedTaskPlanItem = {
  clientTaskId: string;
  title: string;
  taskType: string;
  assignedTeamId: string;
  ownerEmployeeId?: string;
  assignedEmployeeId?: string;
  payload: Record<string, unknown>;
  dependsOnClientTaskIds: string[];
};

function jsonError(message: string, status = 400, details?: unknown): Response {
  return Response.json({ ok: false, error: message, details }, { status });
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => stringOrEmpty(item))
    .filter((item) => item.length > 0);
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseTaskPlanItems(value: unknown): ParsedTaskPlanItem[] | Response {
  if (!Array.isArray(value) || value.length === 0) {
    return jsonError("tasks must be a non-empty array");
  }

  if (value.length > 25) {
    return jsonError("tasks must contain at most 25 items");
  }

  const seenClientIds = new Set<string>();
  const parsed: ParsedTaskPlanItem[] = [];

  for (const rawItem of value) {
    const item = rawItem as ProjectTaskPlanItem;
    const clientTaskId = stringOrEmpty(item.clientTaskId);
    const title = stringOrEmpty(item.title);
    const taskType = stringOrEmpty(item.taskType);
    const assignedTeamId = stringOrEmpty(item.assignedTeamId);

    if (!clientTaskId || !title || !taskType || !assignedTeamId) {
      return jsonError(
        "Each task requires clientTaskId, title, taskType, and assignedTeamId",
      );
    }

    if (seenClientIds.has(clientTaskId)) {
      return jsonError(`Duplicate clientTaskId: ${clientTaskId}`);
    }

    if (!isTeamId(assignedTeamId)) {
      return jsonError(`Unsupported assignedTeamId: ${assignedTeamId}`);
    }

    seenClientIds.add(clientTaskId);
    parsed.push({
      clientTaskId,
      title,
      taskType,
      assignedTeamId,
      ownerEmployeeId: stringOrEmpty(item.ownerEmployeeId) || undefined,
      assignedEmployeeId: stringOrEmpty(item.assignedEmployeeId) || undefined,
      payload: parsePayload(item.payload),
      dependsOnClientTaskIds: parseStringArray(item.dependsOnClientTaskIds),
    });
  }

  for (const item of parsed) {
    for (const dependsOnClientTaskId of item.dependsOnClientTaskIds) {
      if (!seenClientIds.has(dependsOnClientTaskId)) {
        return jsonError(
          `Dependency references unknown clientTaskId: ${dependsOnClientTaskId}`,
        );
      }
    }
  }

  return parsed;
}

export async function handleCreateProjectTaskGraph(
  request: Request,
  env: OperatorAgentEnv | undefined,
  projectId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  let body: CreateProjectTaskGraphBody;
  try {
    body = (await request.json()) as CreateProjectTaskGraphBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const createdByEmployeeId = stringOrEmpty(body.createdByEmployeeId);
  if (!createdByEmployeeId) {
    return jsonError("createdByEmployeeId is required");
  }

  const parsedTasks = parseTaskPlanItems(body.tasks);
  if (parsedTasks instanceof Response) {
    return parsedTasks;
  }

  const store = getTaskStore(env);
  const project = await store.getProject(projectId);
  if (!project) {
    return jsonError("Project not found", 404);
  }

  if (project.status !== "active") {
    return jsonError("Only active projects can receive task graphs", 409);
  }

  const taskIdByClientId = new Map<string, string>();
  for (const item of parsedTasks) {
    taskIdByClientId.set(item.clientTaskId, newId("task"));
  }

  const createdTaskIds: string[] = [];

  try {
    for (const item of parsedTasks) {
      const taskId = taskIdByClientId.get(item.clientTaskId);
      if (!taskId) {
        return jsonError(`Missing generated task ID for ${item.clientTaskId}`);
      }

      const dependsOnTaskIds = item.dependsOnClientTaskIds.map((clientTaskId) => {
        const dependsOnTaskId = taskIdByClientId.get(clientTaskId);
        if (!dependsOnTaskId) {
          throw new Error(`Missing generated dependency task ID for ${clientTaskId}`);
        }
        return dependsOnTaskId;
      });

      await store.createTaskWithDependencies({
        task: {
          id: taskId,
          companyId: project.companyId,
          originatingTeamId: project.ownerTeamId,
          assignedTeamId: item.assignedTeamId,
          ownerEmployeeId: item.ownerEmployeeId,
          assignedEmployeeId: item.assignedEmployeeId,
          createdByEmployeeId,
          taskType: item.taskType,
          title: item.title,
          payload: {
            ...item.payload,
            projectId: project.id,
            intakeRequestId: project.intakeRequestId ?? undefined,
            projectTaskClientId: item.clientTaskId,
          },
        },
        dependsOnTaskIds,
      });

      createdTaskIds.push(taskId);
    }
  } catch (error) {
    if (error instanceof TaskDependencyValidationError) {
      return jsonError(error.message, 400, {
        code: error.code,
        details: error.details ?? null,
      });
    }

    throw error;
  }

  const rationale =
    stringOrEmpty(body.rationale) ||
    "PM created a canonical task graph for this project.";
  const threadId = newId("thread");
  const messageId = newId("message");

  await store.createMessageThread({
    id: threadId,
    companyId: project.companyId,
    topic: `Project task graph: ${project.title}`,
    createdByEmployeeId,
    visibility: "org",
  });

  const message = await store.createMessage({
    id: messageId,
    threadId,
    companyId: project.companyId,
    senderEmployeeId: createdByEmployeeId,
    receiverTeamId: project.ownerTeamId,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Project task graph created",
    body: rationale,
    payload: {
      kind: "project_task_graph_created",
      projectId: project.id,
      intakeRequestId: project.intakeRequestId ?? null,
      taskIds: createdTaskIds,
      taskCount: createdTaskIds.length,
    },
    requiresResponse: false,
  });

  return Response.json(
    {
      ok: true,
      project,
      taskIds: createdTaskIds,
      taskCount: createdTaskIds.length,
      threadId,
      messageId: message.id,
    },
    { status: 201 },
  );
}