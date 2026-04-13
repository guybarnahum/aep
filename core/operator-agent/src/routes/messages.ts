import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type CreateMessageRequest = {
  companyId?: string;
  threadId?: string;
  topic?: string;
  senderEmployeeId?: string;
  receiverEmployeeId?: string;
  receiverTeamId?: string;
  type?: "task" | "escalation" | "coordination";
  source?: "internal" | "dashboard" | "system";
  subject?: string;
  body?: string;
  payload?: Record<string, unknown>;
  requiresResponse?: boolean;
  responseActionType?: string;
  responseActionStatus?: "requested" | "applied" | "rejected";
  causedStateTransition?: boolean;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  relatedEscalationId?: string;
  relatedApprovalId?: string;
};

type CreateMessageThreadRequest = {
  companyId?: string;
  topic?: string;
  createdByEmployeeId?: string;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  visibility?: "internal" | "org";
};

function parseLimit(url: URL, defaultValue = 50): number {
  const raw = Number.parseInt(url.searchParams.get("limit") ?? `${defaultValue}`, 10);
  if (!Number.isFinite(raw) || raw <= 0) return defaultValue;
  return Math.min(raw, 200);
}

export async function handleCreateMessage(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  let body: CreateMessageRequest;
  try {
    body = (await request.json()) as CreateMessageRequest;
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!body.senderEmployeeId || !body.type || !body.body) {
    return Response.json(
      { ok: false, error: "senderEmployeeId, type, and body are required" },
      { status: 400 },
    );
  }

  if (!body.receiverEmployeeId && !body.receiverTeamId) {
    return Response.json(
      { ok: false, error: "receiverEmployeeId or receiverTeamId is required" },
      { status: 400 },
    );
  }

  const store = getTaskStore(env);

  let threadId = body.threadId;
  if (!threadId) {
    threadId = `thr_${crypto.randomUUID().split("-")[0]}`;
    await store.createMessageThread({
      id: threadId,
      companyId: body.companyId ?? "company_internal_aep",
      topic: body.topic ?? body.subject ?? "Untitled thread",
      createdByEmployeeId: body.senderEmployeeId,
      relatedTaskId: body.relatedTaskId,
      relatedArtifactId: body.relatedArtifactId,
      visibility: "internal",
    });
  }

  const messageId = `msg_${crypto.randomUUID().split("-")[0]}`;

  await store.createMessage({
    id: messageId,
    threadId,
    companyId: body.companyId ?? "company_internal_aep",
    senderEmployeeId: body.senderEmployeeId,
    receiverEmployeeId: body.receiverEmployeeId,
    receiverTeamId: body.receiverTeamId,
    type: body.type,
    status: "pending",
    source: body.source ?? "internal",
    subject: body.subject,
    body: body.body,
    payload: body.payload ?? {},
    requiresResponse: body.requiresResponse === true,
    responseActionType: body.responseActionType,
    responseActionStatus: body.responseActionStatus,
    causedStateTransition: body.causedStateTransition === true,
    relatedTaskId: body.relatedTaskId,
    relatedArtifactId: body.relatedArtifactId,
    relatedEscalationId: body.relatedEscalationId,
    relatedApprovalId: body.relatedApprovalId,
  });

  return Response.json({ ok: true, threadId, messageId }, { status: 201 });
}

export async function handleCreateMessageThread(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  let body: CreateMessageThreadRequest;
  try {
    body = (await request.json()) as CreateMessageThreadRequest;
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!body.topic) {
    return Response.json({ ok: false, error: "topic is required" }, { status: 400 });
  }

  const store = getTaskStore(env);
  const threadId = `thr_${crypto.randomUUID().split("-")[0]}`;

  await store.createMessageThread({
    id: threadId,
    companyId: body.companyId ?? "company_internal_aep",
    topic: body.topic,
    createdByEmployeeId: body.createdByEmployeeId,
    relatedTaskId: body.relatedTaskId,
    relatedArtifactId: body.relatedArtifactId,
    visibility: body.visibility ?? "internal",
  });

  return Response.json({ ok: true, threadId }, { status: 201 });
}

export async function handleListMessages(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  const url = new URL(request.url);
  const store = getTaskStore(env);

  const messages = await store.listMessages({
    threadId: url.searchParams.get("threadId") ?? undefined,
    senderEmployeeId: url.searchParams.get("senderEmployeeId") ?? undefined,
    receiverEmployeeId: url.searchParams.get("receiverEmployeeId") ?? undefined,
    receiverTeamId: url.searchParams.get("receiverTeamId") ?? undefined,
    relatedTaskId: url.searchParams.get("relatedTaskId") ?? undefined,
    relatedArtifactId: url.searchParams.get("relatedArtifactId") ?? undefined,
    limit: parseLimit(url),
  });

  return Response.json({
    ok: true,
    count: messages.length,
    messages,
  });
}

export async function handleListInbox(
  request: Request,
  env: OperatorAgentEnv | undefined,
  employeeId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  const url = new URL(request.url);
  const store = getTaskStore(env);

  const messages = await store.listMessages({
    receiverEmployeeId: employeeId,
    limit: parseLimit(url),
  });

  return Response.json({
    ok: true,
    employeeId,
    count: messages.length,
    messages,
  });
}

export async function handleListOutbox(
  request: Request,
  env: OperatorAgentEnv | undefined,
  employeeId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  const url = new URL(request.url);
  const store = getTaskStore(env);

  const messages = await store.listMessages({
    senderEmployeeId: employeeId,
    limit: parseLimit(url),
  });

  return Response.json({
    ok: true,
    employeeId,
    count: messages.length,
    messages,
  });
}

export async function handleListMessageThreads(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  const url = new URL(request.url);
  const store = getTaskStore(env);

  const threads = await store.listMessageThreads({
    companyId: url.searchParams.get("companyId") ?? undefined,
    createdByEmployeeId: url.searchParams.get("createdByEmployeeId") ?? undefined,
    relatedTaskId: url.searchParams.get("relatedTaskId") ?? undefined,
    relatedArtifactId: url.searchParams.get("relatedArtifactId") ?? undefined,
    participantEmployeeId: url.searchParams.get("participantEmployeeId") ?? undefined,
    limit: parseLimit(url),
  });

  return Response.json({
    ok: true,
    count: threads.length,
    threads,
  });
}

export async function handleGetMessageThread(
  request: Request,
  env: OperatorAgentEnv | undefined,
  threadId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  const store = getTaskStore(env);
  const thread = await store.getMessageThread(threadId);

  if (!thread) {
    return Response.json({ ok: false, error: "thread not found" }, { status: 404 });
  }

  const messages = await store.listMessages({
    threadId,
    limit: 200,
  });

  return Response.json({
    ok: true,
    thread,
    messages,
  });
}