import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newId } from "@aep/shared";

const INTERVENTION_ACTIONS = [
  "add_direction",
  "request_redesign",
  "change_priority",
  "review_validation",
  "review_deployment_risk",
  "pause_for_human_review",
] as const;

type InterventionAction = (typeof INTERVENTION_ACTIONS)[number];

type InterventionBody = {
  action?: unknown;
  createdByEmployeeId?: unknown;
  note?: unknown;
  targetTaskId?: unknown;
  targetArtifactId?: unknown;
  targetDeploymentId?: unknown;
};

function jsonError(message: string, status = 400, details?: unknown): Response {
  return Response.json({ ok: false, error: message, details }, { status });
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseAction(value: unknown): InterventionAction | null {
  return typeof value === "string" &&
    INTERVENTION_ACTIONS.includes(value as InterventionAction)
    ? (value as InterventionAction)
    : null;
}

export async function handleCreateProductIntervention(
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

  let body: InterventionBody;
  try {
    body = (await request.json()) as InterventionBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const action = parseAction(body.action);
  const createdByEmployeeId = stringOrEmpty(body.createdByEmployeeId);
  const note = stringOrEmpty(body.note);

  if (!action) {
    return jsonError(`action must be one of: ${INTERVENTION_ACTIONS.join(", ")}`);
  }

  if (!createdByEmployeeId) {
    return jsonError("createdByEmployeeId is required");
  }

  if (!note) {
    return jsonError("note is required");
  }

  const store = getTaskStore(env);
  const project = await store.getProject(projectId);
  if (!project) {
    return jsonError("Project not found", 404);
  }

  const threadId = newId("thread");
  await store.createMessageThread({
    id: threadId,
    companyId: project.companyId,
    topic: `Human intervention: ${project.title}`,
    createdByEmployeeId,
    visibility: "org",
  });

  const message = await store.createMessage({
    id: newId("message"),
    threadId,
    companyId: project.companyId,
    senderEmployeeId: createdByEmployeeId,
    receiverTeamId: project.ownerTeamId,
    type: "coordination",
    status: "delivered",
    source: "human",
    subject: `Human intervention requested: ${action}`,
    body: note,
    payload: {
      kind: "product_human_intervention",
      projectId,
      action,
      targetTaskId: stringOrEmpty(body.targetTaskId) || null,
      targetArtifactId: stringOrEmpty(body.targetArtifactId) || null,
      targetDeploymentId: stringOrEmpty(body.targetDeploymentId) || null,
    },
    requiresResponse: true,
    responseActionType: "delegate_task",
  });

  const coordinationTaskId = newId("task");
  await store.createTaskWithDependencies({
    task: {
      id: coordinationTaskId,
      companyId: project.companyId,
      originatingTeamId: project.ownerTeamId,
      assignedTeamId: project.ownerTeamId,
      createdByEmployeeId,
      taskType: "coordination",
      title: `Respond to human intervention: ${action}`,
      sourceThreadId: threadId,
      sourceMessageId: message.id,
      payload: {
        topic: `Human intervention for project ${project.id}: ${action}`,
        projectId,
        action,
        note,
        targetTaskId: stringOrEmpty(body.targetTaskId) || undefined,
        targetArtifactId: stringOrEmpty(body.targetArtifactId) || undefined,
        targetDeploymentId: stringOrEmpty(body.targetDeploymentId) || undefined,
      },
    },
    dependsOnTaskIds: [],
  });

  return Response.json(
    {
      ok: true,
      projectId,
      intervention: {
        action,
        threadId,
        messageId: message.id,
        coordinationTaskId,
      },
    },
    { status: 201 },
  );
}