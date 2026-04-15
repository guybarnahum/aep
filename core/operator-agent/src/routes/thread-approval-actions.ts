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

async function approveFromThreadAction(args: {
  env: OperatorAgentEnv;
  threadId: string;
  actor: string;
  note?: string;
}): Promise<Response> {
  const taskStore = getTaskStore(args.env);
  const thread = await taskStore.getMessageThread(args.threadId);

  if (!thread || !thread.relatedApprovalId) {
    return Response.json({ ok: false, error: "Approval thread not found" }, { status: 404 });
  }

  const approvalStore = createStores(args.env).approvals;
  const result = await approvalStore.decide({
    approvalId: thread.relatedApprovalId,
    nextStatus: "approved",
    decidedBy: args.actor,
    decisionNote: args.note,
  });

  if (!result.ok && result.reason === "not_found") {
    return Response.json({ ok: false, error: "Approval not found" }, { status: 404 });
  }

  if (!result.ok && result.reason === "already_decided") {
    await appendDashboardActionMessage({
      env: args.env,
      threadId: args.threadId,
      companyId: thread.companyId,
      senderEmployeeId: args.actor,
      subject: "Approval action",
      body: `Approve-from-thread attempted by ${args.actor}, but approval ${thread.relatedApprovalId} was already decided${args.note ? `: ${args.note}` : "."}`,
      type: "coordination",
      responseActionType: "approve_approval",
      responseActionStatus: "rejected",
      causedStateTransition: false,
      relatedTaskId: thread.relatedTaskId,
      relatedApprovalId: thread.relatedApprovalId,
    });

    return Response.json(
      { ok: false, error: "Approval is no longer pending", approval: result.approval, threadId: args.threadId },
      { status: 409 },
    );
  }

  await appendDashboardActionMessage({
    env: args.env,
    threadId: args.threadId,
    companyId: thread.companyId,
    senderEmployeeId: args.actor,
    subject: "Approval action",
    body: `Approved from thread by ${args.actor}${args.note ? `: ${args.note}` : "."}`,
    type: "coordination",
    responseActionType: "approve_approval",
    responseActionStatus: "applied",
    causedStateTransition: true,
    relatedTaskId: thread.relatedTaskId,
    relatedApprovalId: thread.relatedApprovalId,
  });

  await appendSystemMessage({
    env: args.env,
    threadId: args.threadId,
    companyId: thread.companyId,
    senderEmployeeId: args.actor,
    subject: "Approval approved",
    body: `Approval ${thread.relatedApprovalId} was approved from thread by ${args.actor}${args.note ? `: ${args.note}` : "."}`,
    relatedTaskId: thread.relatedTaskId,
    relatedApprovalId: thread.relatedApprovalId,
    type: "coordination",
  });

  return Response.json({
    ok: true,
    approval: result.approval,
    threadId: args.threadId,
  });
}

async function rejectFromThreadAction(args: {
  env: OperatorAgentEnv;
  threadId: string;
  actor: string;
  note?: string;
}): Promise<Response> {
  const taskStore = getTaskStore(args.env);
  const thread = await taskStore.getMessageThread(args.threadId);

  if (!thread || !thread.relatedApprovalId) {
    return Response.json({ ok: false, error: "Approval thread not found" }, { status: 404 });
  }

  const approvalStore = createStores(args.env).approvals;
  const result = await approvalStore.decide({
    approvalId: thread.relatedApprovalId,
    nextStatus: "rejected",
    decidedBy: args.actor,
    decisionNote: args.note,
  });

  if (!result.ok && result.reason === "not_found") {
    return Response.json({ ok: false, error: "Approval not found" }, { status: 404 });
  }

  if (!result.ok && result.reason === "already_decided") {
    await appendDashboardActionMessage({
      env: args.env,
      threadId: args.threadId,
      companyId: thread.companyId,
      senderEmployeeId: args.actor,
      subject: "Approval action",
      body: `Reject-from-thread attempted by ${args.actor}, but approval ${thread.relatedApprovalId} was already decided${args.note ? `: ${args.note}` : "."}`,
      type: "coordination",
      responseActionType: "reject_approval",
      responseActionStatus: "rejected",
      causedStateTransition: false,
      relatedTaskId: thread.relatedTaskId,
      relatedApprovalId: thread.relatedApprovalId,
    });

    return Response.json(
      { ok: false, error: "Approval is no longer pending", approval: result.approval, threadId: args.threadId },
      { status: 409 },
    );
  }

  await appendDashboardActionMessage({
    env: args.env,
    threadId: args.threadId,
    companyId: thread.companyId,
    senderEmployeeId: args.actor,
    subject: "Approval action",
    body: `Rejected from thread by ${args.actor}${args.note ? `: ${args.note}` : "."}`,
    type: "coordination",
    responseActionType: "reject_approval",
    responseActionStatus: "applied",
    causedStateTransition: true,
    relatedTaskId: thread.relatedTaskId,
    relatedApprovalId: thread.relatedApprovalId,
  });

  await appendSystemMessage({
    env: args.env,
    threadId: args.threadId,
    companyId: thread.companyId,
    senderEmployeeId: args.actor,
    subject: "Approval rejected",
    body: `Approval ${thread.relatedApprovalId} was rejected from thread by ${args.actor}${args.note ? `: ${args.note}` : "."}`,
    relatedTaskId: thread.relatedTaskId,
    relatedApprovalId: thread.relatedApprovalId,
    type: "coordination",
  });

  return Response.json({
    ok: true,
    approval: result.approval,
    threadId: args.threadId,
  });
}

export { approveFromThreadAction, rejectFromThreadAction };

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

  return approveFromThreadAction({ env, threadId, actor, note });
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

  return rejectFromThreadAction({ env, threadId, actor, note });
}