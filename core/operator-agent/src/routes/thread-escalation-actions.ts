import { applyAcknowledged, applyResolved } from "@aep/operator-agent/lib/escalation-state";
import { appendSystemMessage } from "@aep/operator-agent/lib/human-interaction-threads";
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

async function acknowledgeFromThreadAction(args: {
  env: OperatorAgentEnv;
  threadId: string;
  actor: string;
}): Promise<Response> {
  const taskStore = getTaskStore(args.env);
  const thread = await taskStore.getMessageThread(args.threadId);

  if (!thread || !thread.relatedEscalationId) {
    return Response.json({ ok: false, error: "Escalation thread not found" }, { status: 404 });
  }

  const escalationStore = createStores(args.env).escalations;
  const escalation = await escalationStore.get(thread.relatedEscalationId);

  if (!escalation) {
    return Response.json({ ok: false, error: "Escalation not found" }, { status: 404 });
  }

  let updated;
  try {
    updated = applyAcknowledged(escalation, args.actor);
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }

  await escalationStore.put(updated);

  await taskStore.createMessage({
    id: `msg_${crypto.randomUUID().split("-")[0]}`,
    threadId: args.threadId,
    companyId: thread.companyId,
    senderEmployeeId: args.actor,
    receiverEmployeeId: thread.createdByEmployeeId ?? escalation.managerEmployeeId,
    type: "escalation",
    status: "acknowledged",
    source: "dashboard",
    subject: "Escalation action",
    body: `Acknowledged from thread by ${args.actor}.`,
    payload: {},
    requiresResponse: false,
    responseActionType: "acknowledge_escalation",
    responseActionStatus: "applied",
    causedStateTransition: true,
    relatedEscalationId: thread.relatedEscalationId,
  });

  await appendSystemMessage({
    env: args.env,
    threadId: args.threadId,
    companyId: thread.companyId,
    senderEmployeeId: args.actor,
    subject: "Escalation acknowledged",
    body: `Escalation ${thread.relatedEscalationId} was acknowledged from thread by ${args.actor}.`,
    relatedEscalationId: thread.relatedEscalationId,
    type: "escalation",
  });

  return Response.json({
    ok: true,
    escalation: updated,
    threadId: args.threadId,
  });
}

async function resolveFromThreadAction(args: {
  env: OperatorAgentEnv;
  threadId: string;
  actor: string;
  note?: string;
}): Promise<Response> {
  const taskStore = getTaskStore(args.env);
  const thread = await taskStore.getMessageThread(args.threadId);

  if (!thread || !thread.relatedEscalationId) {
    return Response.json({ ok: false, error: "Escalation thread not found" }, { status: 404 });
  }

  const escalationStore = createStores(args.env).escalations;
  const escalation = await escalationStore.get(thread.relatedEscalationId);

  if (!escalation) {
    return Response.json({ ok: false, error: "Escalation not found" }, { status: 404 });
  }

  let updated;
  try {
    updated = applyResolved(escalation, args.actor, args.note);
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }

  await escalationStore.put(updated);

  await taskStore.createMessage({
    id: `msg_${crypto.randomUUID().split("-")[0]}`,
    threadId: args.threadId,
    companyId: thread.companyId,
    senderEmployeeId: args.actor,
    receiverEmployeeId: thread.createdByEmployeeId ?? escalation.managerEmployeeId,
    type: "escalation",
    status: "acknowledged",
    source: "dashboard",
    subject: "Escalation action",
    body: `Resolved from thread by ${args.actor}${args.note ? `: ${args.note}` : "."}`,
    payload: {},
    requiresResponse: false,
    responseActionType: "resolve_escalation",
    responseActionStatus: "applied",
    causedStateTransition: true,
    relatedEscalationId: thread.relatedEscalationId,
  });

  await appendSystemMessage({
    env: args.env,
    threadId: args.threadId,
    companyId: thread.companyId,
    senderEmployeeId: args.actor,
    subject: "Escalation resolved",
    body: `Escalation ${thread.relatedEscalationId} was resolved from thread by ${args.actor}${args.note ? `: ${args.note}` : "."}`,
    relatedEscalationId: thread.relatedEscalationId,
    type: "escalation",
  });

  return Response.json({
    ok: true,
    escalation: updated,
    threadId: args.threadId,
  });
}

export { acknowledgeFromThreadAction, resolveFromThreadAction };

export async function handleAcknowledgeFromThread(
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

  return acknowledgeFromThreadAction({ env, threadId, actor });
}

export async function handleResolveFromThread(
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

  return resolveFromThreadAction({ env, threadId, actor, note });
}