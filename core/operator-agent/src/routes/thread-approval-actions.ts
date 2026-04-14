import {
  appendDashboardActionMessage,
  appendSystemMessage,
} from "@aep/operator-agent/lib/human-interaction-threads";
import { createStores, getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function parseBody(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body = await request.json();
    return asRecord(body);
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
}

export async function handleApproveFromThread(
  request: Request,
  env?: OperatorAgentEnv,
  threadId?: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env || !threadId) {
    return Response.json({ ok: false, error: "Missing operator-agent environment or threadId" }, { status: 500 });
  }

  const body = await parseBody(request);
  if (body instanceof Response) return body;

  const actor =
    typeof body.actor === "string" && body.actor.trim() !== ""
      ? body.actor
      : "human";

  const note =
    typeof body.note === "string" && body.note.trim() !== ""
      ? body.note
      : undefined;

  const taskStore = getTaskStore(env);
  const thread = await taskStore.getMessageThread(threadId);

  if (!thread || !thread.relatedApprovalId) {
    return Response.json({ ok: false, error: "Approval thread not found" }, { status: 404 });
  }

  const approvalStore = createStores(env).approvals;
  const result = await approvalStore.decide({
    approvalId: thread.relatedApprovalId,
    nextStatus: "approved",
    decidedBy: actor,
    decisionNote: note,
  });

  if (!result.ok && result.reason === "not_found") {
    return Response.json({ ok: false, error: "Approval not found" }, { status: 404 });
  }

  if (!result.ok && result.reason === "already_decided") {
    await appendDashboardActionMessage({
      env,
      threadId,
      companyId: thread.companyId,
      senderEmployeeId: actor,
      subject: "Approval action",
      body: `Approve-from-thread attempted by ${actor}, but approval ${thread.relatedApprovalId} was already decided${note ? `: ${note}` : "."}`,
      type: "coordination",
      responseActionType: "approve_approval",
      responseActionStatus: "rejected",
      causedStateTransition: false,
      relatedTaskId: thread.relatedTaskId,
      relatedApprovalId: thread.relatedApprovalId,
    });

    return Response.json(
      { ok: false, error: "Approval is no longer pending", approval: result.approval, threadId },
      { status: 409 },
    );
  }

  await appendDashboardActionMessage({
    env,
    threadId,
    companyId: thread.companyId,
    senderEmployeeId: actor,
    subject: "Approval action",
    body: `Approved from thread by ${actor}${note ? `: ${note}` : "."}`,
    type: "coordination",
    responseActionType: "approve_approval",
    responseActionStatus: "applied",
    causedStateTransition: true,
    relatedTaskId: thread.relatedTaskId,
    relatedApprovalId: thread.relatedApprovalId,
  });

  await appendSystemMessage({
    env,
    threadId,
    companyId: thread.companyId,
    senderEmployeeId: actor,
    subject: "Approval approved",
    body: `Approval ${thread.relatedApprovalId} was approved from thread by ${actor}${note ? `: ${note}` : "."}`,
    relatedTaskId: thread.relatedTaskId,
    relatedApprovalId: thread.relatedApprovalId,
    type: "coordination",
  });

  return Response.json({
    ok: true,
    approval: result.approval,
    threadId,
  });
}

export async function handleRejectFromThread(
  request: Request,
  env?: OperatorAgentEnv,
  threadId?: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env || !threadId) {
    return Response.json({ ok: false, error: "Missing operator-agent environment or threadId" }, { status: 500 });
  }

  const body = await parseBody(request);
  if (body instanceof Response) return body;

  const actor =
    typeof body.actor === "string" && body.actor.trim() !== ""
      ? body.actor
      : "human";

  const note =
    typeof body.note === "string" && body.note.trim() !== ""
      ? body.note
      : undefined;

  const taskStore = getTaskStore(env);
  const thread = await taskStore.getMessageThread(threadId);

  if (!thread || !thread.relatedApprovalId) {
    return Response.json({ ok: false, error: "Approval thread not found" }, { status: 404 });
  }

  const approvalStore = createStores(env).approvals;
  const result = await approvalStore.decide({
    approvalId: thread.relatedApprovalId,
    nextStatus: "rejected",
    decidedBy: actor,
    decisionNote: note,
  });

  if (!result.ok && result.reason === "not_found") {
    return Response.json({ ok: false, error: "Approval not found" }, { status: 404 });
  }

  if (!result.ok && result.reason === "already_decided") {
    await appendDashboardActionMessage({
      env,
      threadId,
      companyId: thread.companyId,
      senderEmployeeId: actor,
      subject: "Approval action",
      body: `Reject-from-thread attempted by ${actor}, but approval ${thread.relatedApprovalId} was already decided${note ? `: ${note}` : "."}`,
      type: "coordination",
      responseActionType: "reject_approval",
      responseActionStatus: "rejected",
      causedStateTransition: false,
      relatedTaskId: thread.relatedTaskId,
      relatedApprovalId: thread.relatedApprovalId,
    });

    return Response.json(
      { ok: false, error: "Approval is no longer pending", approval: result.approval, threadId },
      { status: 409 },
    );
  }

  await appendDashboardActionMessage({
    env,
    threadId,
    companyId: thread.companyId,
    senderEmployeeId: actor,
    subject: "Approval action",
    body: `Rejected from thread by ${actor}${note ? `: ${note}` : "."}`,
    type: "coordination",
    responseActionType: "reject_approval",
    responseActionStatus: "applied",
    causedStateTransition: true,
    relatedTaskId: thread.relatedTaskId,
    relatedApprovalId: thread.relatedApprovalId,
  });

  await appendSystemMessage({
    env,
    threadId,
    companyId: thread.companyId,
    senderEmployeeId: actor,
    subject: "Approval rejected",
    body: `Approval ${thread.relatedApprovalId} was rejected from thread by ${actor}${note ? `: ${note}` : "."}`,
    relatedTaskId: thread.relatedTaskId,
    relatedApprovalId: thread.relatedApprovalId,
    type: "coordination",
  });

  return Response.json({
    ok: true,
    approval: result.approval,
    threadId,
  });
}