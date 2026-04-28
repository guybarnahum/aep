import { getApprovalStore, getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newId } from "@aep/shared";
import {
  isProductLifecycleAction,
  lifecycleApprovalActionType,
  lifecycleTargetStatus,
} from "../product/product-lifecycle-contracts";
import { TEAM_WEB_PRODUCT } from "../org/teams";

type ProductLifecycleRequestBody = {
  action?: unknown;
  requestedByEmployeeId?: unknown;
  reason?: unknown;
  targetState?: unknown;
};

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function handleRequestProductLifecycleAction(
  request: Request,
  env: OperatorAgentEnv | undefined,
  projectId: string,
): Promise<Response> {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!env) return jsonError("Missing operator-agent environment", 500);

  let body: ProductLifecycleRequestBody;
  try {
    body = (await request.json()) as ProductLifecycleRequestBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (!isProductLifecycleAction(body.action)) {
    return jsonError("Unsupported lifecycle action");
  }

  const requestedByEmployeeId = stringField(body.requestedByEmployeeId);
  const reason = stringField(body.reason);
  if (!requestedByEmployeeId || !reason) {
    return jsonError("requestedByEmployeeId and reason are required");
  }

  const store = getTaskStore(env);
  const project = await store.getProject(projectId);
  if (!project) return jsonError("Project not found", 404);

  const now = new Date().toISOString();
  const targetStatus = lifecycleTargetStatus(body.action);
  const approvalId = newId("approval");
  const taskId = newId("task");
  const threadId = newId("thr");
  const messageId = newId("msg");

  await getApprovalStore(env).write({
    approvalId,
    timestamp: now,
    companyId: project.companyId,
    teamId: TEAM_WEB_PRODUCT,
    requestedByEmployeeId,
    requestedByRoleId: "product-manager-web",
    source: "policy",
    actionType: lifecycleApprovalActionType(body.action),
    payload: {
      kind: "product_lifecycle_request",
      projectId,
      action: body.action,
      currentStatus: project.status,
      targetStatus,
      requestedTargetState: stringField(body.targetState) || null,
      directProjectStatusMutationAllowed: false,
    },
    status: "pending",
    reason,
    message:
      `Product lifecycle action ${body.action} requested for project ${projectId}. ` +
      "Approval is required before any canonical project lifecycle transition.",
  });

  await store.createMessageThread({
    id: threadId,
    companyId: project.companyId,
    topic: `Product lifecycle ${body.action}: ${project.title}`,
    createdByEmployeeId: requestedByEmployeeId,
    relatedApprovalId: approvalId,
    visibility: "org",
  });

  const message = await store.createMessage({
    id: messageId,
    threadId,
    companyId: project.companyId,
    senderEmployeeId: requestedByEmployeeId,
    receiverTeamId: TEAM_WEB_PRODUCT,
    type: "coordination",
    status: "delivered",
    source: "human",
    subject: `Lifecycle request: ${body.action}`,
    body: reason,
    payload: {
      kind: "product_lifecycle_request",
      projectId,
      action: body.action,
      approvalId,
      targetStatus,
      directProjectStatusMutationAllowed: false,
    },
    relatedApprovalId: approvalId,
    requiresResponse: false,
  });

  await store.createTask({
    id: taskId,
    companyId: project.companyId,
    originatingTeamId: TEAM_WEB_PRODUCT,
    assignedTeamId: TEAM_WEB_PRODUCT,
    createdByEmployeeId: requestedByEmployeeId,
    taskType: "coordination",
    title: `Lifecycle ${body.action}: ${project.title}`,
    payload: {
      topic: `Lifecycle ${body.action} for project ${projectId}`,
      projectId,
      lifecycleAction: body.action,
      approvalId,
      targetStatus,
      sourceThreadId: threadId,
      sourceMessageId: message.id,
      directProjectStatusMutationAllowed: false,
    },
    sourceThreadId: threadId,
    sourceMessageId: message.id,
    sourceApprovalId: approvalId,
  });

  return Response.json(
    {
      ok: true,
      projectId,
      action: body.action,
      targetStatus,
      approvalId,
      taskId,
      threadId,
      messageId: message.id,
      stateChanged: false,
    },
    { status: 201 },
  );
}
