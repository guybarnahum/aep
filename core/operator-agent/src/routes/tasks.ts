import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { Decision } from "@aep/operator-agent/lib/store-types";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type CreateTaskRequest = {
  companyId?: string;
  teamId?: string;
  employeeId?: string;
  taskType?: string;
  payload?: Record<string, unknown>;
};

type DecisionRow = Decision;

export async function handleCreateTask(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
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

  const store = getTaskStore(env);
  const workOrderId = `task_${crypto.randomUUID().split("-")[0]}`;

  await store.createTask({
    id: workOrderId,
    companyId: body.companyId ?? "company_internal_aep",
    teamId: body.teamId ?? "team_validation",
    employeeId: body.employeeId,
    taskType: body.taskType ?? "validate-deployment",
    payload: body.payload ?? {},
  });

  return Response.json({ ok: true, workOrderId }, { status: 201 });
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
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  const store = getTaskStore(env);
  const task = await store.getTask(taskId);

  if (!task) {
    return Response.json({ ok: false, error: "task not found" }, { status: 404 });
  }

  let decision: DecisionRow | null = null;
  if (task.status === "completed" || task.status === "failed") {
    if (!env.OPERATOR_AGENT_DB) {
      return Response.json({ ok: false, error: "Missing OPERATOR_AGENT_DB binding" }, { status: 500 });
    }

    const row = await env.OPERATOR_AGENT_DB
      .prepare(
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

  return Response.json({ ok: true, task, decision });
}