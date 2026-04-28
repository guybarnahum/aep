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

function jsonError(message: string, status = 400, details?: unknown): Response {
  return Response.json({ ok: false, error: message, details }, { status });
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

export async function handleExecuteProductLifecycleAction(
  request: Request,
  env: OperatorAgentEnv | undefined,
  projectId: string,
): Promise<Response> {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!env) return jsonError("Missing operator-agent environment", 500);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  const approvalId = stringField(body.approvalId);
  const executedByEmployeeId = stringField(body.executedByEmployeeId);

  if (!approvalId || !executedByEmployeeId) {
    return jsonError("approvalId and executedByEmployeeId are required");
  }

  const approvals = getApprovalStore(env);
  const approval = await approvals.get(approvalId);
  if (!approval) return jsonError("Approval not found", 404);
  if (approval.status !== "approved") return jsonError("Approval is not approved", 409);

  const payload = asRecord(approval.payload);
  if (payload.kind !== "product_lifecycle_request") {
    return jsonError("Approval is not a product lifecycle request", 409);
  }
  if (payload.projectId !== projectId) {
    return jsonError("Approval projectId does not match route projectId", 409);
  }
  if (typeof payload.action !== "string" || !isProductLifecycleAction(payload.action)) {
    return jsonError("Approval lifecycle action is invalid", 409);
  }

  const targetStatus = lifecycleTargetStatus(payload.action);
  if (payload.targetStatus !== targetStatus) {
    return jsonError("Approval target status does not match lifecycle contract", 409);
  }

  // Mark approval as executed before updating project state to ensure consistency:
  // if markExecuted fails, no project state changes; if project update fails after,
  // at least the execution is recorded in approvals.
  const executed = await approvals.markExecuted({
    approvalId,
    executedAt: new Date().toISOString(),
    executionId: `project_lifecycle:${projectId}:${targetStatus}`,
    executedByEmployeeId,
  });
  if (!executed.ok) {
    return jsonError("Approval execution could not be recorded", 409, {
      reason: executed.reason,
    });
  }

  const store = getTaskStore(env);
  const updatedProject = await store.applyApprovedProjectLifecycleTransition({
    projectId,
    status: targetStatus,
    approvalId,
    executedByEmployeeId,
  });
  if (!updatedProject) return jsonError("Project not found", 404);

  const threadId = newId("thr");
  await store.createMessageThread({
    id: threadId,
    companyId: updatedProject.companyId,
    topic: `Lifecycle executed: ${updatedProject.title}`,
    createdByEmployeeId: executedByEmployeeId,
    relatedApprovalId: approvalId,
    visibility: "org",
  });

  const message = await store.createMessage({
    id: newId("msg"),
    threadId,
    companyId: updatedProject.companyId,
    senderEmployeeId: executedByEmployeeId,
    receiverTeamId: TEAM_WEB_PRODUCT,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Product lifecycle transition executed",
    body:
      `Approved lifecycle action ${payload.action} was executed for project ${projectId}. ` +
      `Project status is now ${targetStatus}.`,
    payload: {
      kind: "product_lifecycle_executed",
      projectId,
      approvalId,
      action: payload.action,
      targetStatus,
      executedByEmployeeId,
      stateChanged: true,
      approvalGated: true,
    },
    relatedApprovalId: approvalId,
    requiresResponse: false,
  });

  return Response.json({
    ok: true,
    project: updatedProject,
    approvalId,
    threadId,
    messageId: message.id,
    stateChanged: true,
  });
}
