import {
  delegateTaskFromSource,
  TaskDelegationError,
} from "@aep/operator-agent/lib/task-delegation";
import {
  TaskPayloadValidationError,
  TaskTypeValidationError,
} from "@aep/operator-agent/lib/task-contracts";
import { TaskDependencyValidationError } from "@aep/operator-agent/lib/store-types";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type DelegateTaskRequest = {
  delegatedByEmployeeId?: string;
  taskType?: string;
  title?: string;
  assignedTeamId?: string;
  payload?: Record<string, unknown>;
  dependsOnSourceTask?: boolean;
};

export async function handleDelegateTaskFromTask(
  request: Request,
  env: OperatorAgentEnv | undefined,
  sourceTaskId: string,
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

  let body: DelegateTaskRequest;
  try {
    body = (await request.json()) as DelegateTaskRequest;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  if (!body.delegatedByEmployeeId || !body.taskType || !body.title) {
    return Response.json(
      {
        ok: false,
        error: "delegatedByEmployeeId, taskType, and title are required",
      },
      { status: 400 },
    );
  }

  try {
    const result = await delegateTaskFromSource({
      env,
      sourceTaskId,
      delegatedByEmployeeId: body.delegatedByEmployeeId,
      delegatedTaskType: body.taskType,
      title: body.title,
      assignedTeamId: body.assignedTeamId,
      payload: body.payload ?? {},
      dependsOnSourceTask: body.dependsOnSourceTask,
    });

    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof TaskDelegationError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          details: error.details ?? null,
        },
        { status: error.code === "source_task_not_found" ? 404 : 400 },
      );
    }

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
}
