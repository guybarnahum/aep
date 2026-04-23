import { summarizeThreadVisibility } from "@aep/operator-agent/lib/human-visibility-summary";
import {
  authorizeExternalAction,
  authorizeInboundExternalReply,
} from "../adapters/external-policy";
import { resolveCanonicalThreadForExternalAction } from "../adapters/inbound-action-correlation";
import type {
  ExternalActionEnvelope,
  ExternalActionType,
} from "../adapters/inbound-action-types";
import { resolveCanonicalThreadForInbound } from "../adapters/inbound-correlation";
import type { InboundExternalMessage } from "../adapters/inbound-types";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { newId } from "@aep/shared";
import type {
  EmployeeMessage,
  ThreadExternalInteractionPolicy,
} from "@aep/operator-agent/lib/store-types";
import { approveFromThreadAction, rejectFromThreadAction } from "./thread-approval-actions";
import { acknowledgeFromThreadAction, resolveFromThreadAction } from "./thread-escalation-actions";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type CreateMessageRequest = {
  companyId?: string;
  threadId?: string;
  topic?: string;
  senderEmployeeId?: string;
  receiverEmployeeId?: string;
  receiverTeamId?: string;
  type?: "task" | "escalation" | "coordination";
  source?: "internal" | "dashboard" | "system" | "human" | "slack" | "email";
  subject?: string;
  body?: string;
  payload?: Record<string, unknown>;
  externalMessageId?: string;
  externalChannel?: "slack" | "email";
  externalAuthorId?: string;
  externalReceivedAt?: string;
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
  relatedApprovalId?: string;
  relatedEscalationId?: string;
  visibility?: "internal" | "org";
  externalInteractionPolicy?: {
    inboundRepliesAllowed?: boolean;
    externalActionsAllowed?: boolean;
    allowedChannels?: Array<"slack" | "email">;
    allowedTargets?: string[];
    allowedExternalActors?: string[];
  };
};

function syntheticExternalSenderEmployeeId(channel: "slack" | "email", externalAuthorId?: string): string {
  const normalizedAuthor = (externalAuthorId?.trim() || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `external_${channel}_${normalizedAuthor}`;
}

function isExternalActionType(value: unknown): value is ExternalActionType {
  return (
    value === "approval_approve" ||
    value === "approval_reject" ||
    value === "escalation_acknowledge" ||
    value === "escalation_resolve"
  );
}

function isAllowedChannelList(value: unknown): value is Array<"slack" | "email"> {
  return (
    Array.isArray(value) &&
    value.every((entry) => entry === "slack" || entry === "email")
  );
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function buildThreadExternalInteractionPolicy(args: {
  threadId: string;
  input?: CreateMessageThreadRequest["externalInteractionPolicy"];
}): ThreadExternalInteractionPolicy | null {
  if (!args.input) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    threadId: args.threadId,
    inboundRepliesAllowed: args.input.inboundRepliesAllowed !== false,
    externalActionsAllowed: args.input.externalActionsAllowed !== false,
    allowedChannels: args.input.allowedChannels,
    allowedTargets: args.input.allowedTargets,
    allowedExternalActors: args.input.allowedExternalActors,
    createdAt: now,
    updatedAt: now,
  };
}

type MessageWithMirrorDeliveries = EmployeeMessage & {
  mirrorDeliveries: Awaited<ReturnType<ReturnType<typeof getTaskStore>["listMessageMirrorDeliveries"]>>;
  externalMessageProjections: Awaited<
    ReturnType<ReturnType<typeof getTaskStore>["listExternalMessageProjections"]>
  >;
};

async function attachMirrorDeliveries(
  store: ReturnType<typeof getTaskStore>,
  messages: EmployeeMessage[],
): Promise<MessageWithMirrorDeliveries[]> {
  return Promise.all(
    messages.map(async (message) => {
      const mirrorDeliveries = await store.listMessageMirrorDeliveries(message.id);
      const externalMessageProjections = await store.listExternalMessageProjections(message.id);
      return {
        ...message,
        mirrorDeliveries,
        externalMessageProjections,
      };
    }),
  );
}

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

  if (body.externalChannel) {
    const source = body.source ?? "internal";
    if (source !== "human" && source !== "slack" && source !== "email") {
      return Response.json(
        { ok: false, error: 'externalChannel requires source to be "human", "slack", or "email"' },
        { status: 400 },
      );
    }
  }

  if (body.source === "slack" && body.externalChannel !== "slack") {
    return Response.json(
      { ok: false, error: 'source "slack" requires externalChannel "slack"' },
      { status: 400 },
    );
  }

  if (body.source === "email" && body.externalChannel !== "email") {
    return Response.json(
      { ok: false, error: 'source "email" requires externalChannel "email"' },
      { status: 400 },
    );
  }

  if (body.source === "system") {
    if (typeof body.externalMessageId !== "undefined") {
      return Response.json(
        { ok: false, error: 'source "system" must not include externalMessageId' },
        { status: 400 },
      );
    }

    if (typeof body.externalChannel !== "undefined") {
      return Response.json(
        { ok: false, error: 'source "system" must not include externalChannel' },
        { status: 400 },
      );
    }
  }

  if (
    typeof body.externalReceivedAt !== "undefined" &&
    (typeof body.externalReceivedAt !== "string" || body.externalReceivedAt.trim().length === 0)
  ) {
    return Response.json(
      { ok: false, error: "externalReceivedAt must be a non-empty string when provided" },
      { status: 400 },
    );
  }

  const store = getTaskStore(env);

  let threadId = body.threadId;
  if (!threadId) {
    threadId = newId("thr");
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

  const messageId = newId("msg");

  const createdMessage = await store.createMessage({
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
    externalMessageId: body.externalMessageId,
    externalChannel: body.externalChannel,
    externalAuthorId: body.externalAuthorId,
    externalReceivedAt: body.externalReceivedAt,
    requiresResponse: body.requiresResponse === true,
    responseActionType: body.responseActionType,
    responseActionStatus: body.responseActionStatus,
    causedStateTransition: body.causedStateTransition === true,
    relatedTaskId: body.relatedTaskId,
    relatedArtifactId: body.relatedArtifactId,
    relatedEscalationId: body.relatedEscalationId,
    relatedApprovalId: body.relatedApprovalId,
  });

  const wasDuplicate = createdMessage.id !== messageId;

  return Response.json(
    { ok: true, threadId, messageId: createdMessage.id },
    { status: wasDuplicate ? 200 : 201 },
  );
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

  if (
    typeof body.relatedApprovalId !== "undefined" &&
    typeof body.relatedApprovalId !== "string"
  ) {
    return Response.json({ ok: false, error: "invalid external interaction policy" }, { status: 400 });
  }

  if (
    typeof body.relatedEscalationId !== "undefined" &&
    typeof body.relatedEscalationId !== "string"
  ) {
    return Response.json({ ok: false, error: "invalid external interaction policy" }, { status: 400 });
  }

  if (typeof body.externalInteractionPolicy !== "undefined") {
    const policy = body.externalInteractionPolicy;

    if (
      !policy ||
      typeof policy !== "object" ||
      Array.isArray(policy) ||
      (typeof policy.inboundRepliesAllowed !== "undefined" && typeof policy.inboundRepliesAllowed !== "boolean") ||
      (typeof policy.externalActionsAllowed !== "undefined" && typeof policy.externalActionsAllowed !== "boolean") ||
      (typeof policy.allowedChannels !== "undefined" && !isAllowedChannelList(policy.allowedChannels)) ||
      (typeof policy.allowedTargets !== "undefined" && !isStringList(policy.allowedTargets)) ||
      (typeof policy.allowedExternalActors !== "undefined" && !isStringList(policy.allowedExternalActors))
    ) {
      return Response.json({ ok: false, error: "invalid external interaction policy" }, { status: 400 });
    }
  }

  const store = getTaskStore(env);
  const threadId = newId("thr");

  await store.createMessageThread({
    id: threadId,
    companyId: body.companyId ?? "company_internal_aep",
    topic: body.topic,
    createdByEmployeeId: body.createdByEmployeeId,
    relatedTaskId: body.relatedTaskId,
    relatedArtifactId: body.relatedArtifactId,
      relatedApprovalId: body.relatedApprovalId,
      relatedEscalationId: body.relatedEscalationId,
    visibility: body.visibility ?? "internal",
  });

  const policy = buildThreadExternalInteractionPolicy({
    threadId,
    input: body.externalInteractionPolicy,
  });

  if (policy) {
    await store.upsertThreadExternalInteractionPolicy(policy);
  }

  return Response.json({ ok: true, threadId }, { status: 201 });
}

export async function handleIngestExternalMessage(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  let body: InboundExternalMessage;
  try {
    body = (await request.json()) as InboundExternalMessage;
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (
    (body.channel !== "slack" && body.channel !== "email") ||
    typeof body.externalThreadId !== "string" ||
    body.externalThreadId.trim().length === 0 ||
    typeof body.externalMessageId !== "string" ||
    body.externalMessageId.trim().length === 0 ||
    typeof body.body !== "string" ||
    body.body.trim().length === 0 ||
    typeof body.externalReceivedAt !== "string" ||
    body.externalReceivedAt.trim().length === 0
  ) {
    return Response.json({ ok: false, error: "invalid inbound message" }, { status: 400 });
  }

  if (typeof body.subject !== "undefined" && typeof body.subject !== "string") {
    return Response.json({ ok: false, error: "invalid inbound message" }, { status: 400 });
  }

  if (typeof body.target !== "undefined" && typeof body.target !== "string") {
    return Response.json({ ok: false, error: "invalid inbound message" }, { status: 400 });
  }

  const store = getTaskStore(env);
  const resolved = await resolveCanonicalThreadForInbound(store, {
    channel: body.channel,
    externalThreadId: body.externalThreadId,
    target: body.target,
  });

  if (!resolved) {
    return Response.json(
      {
        ok: false,
        error: "thread_not_found",
        externalThreadId: body.externalThreadId,
      },
      { status: 404 },
    );
  }

  const thread = await store.getMessageThread(resolved.threadId);
  if (!thread) {
    return Response.json(
      {
        ok: false,
        error: "thread_not_found",
        externalThreadId: body.externalThreadId,
      },
      { status: 404 },
    );
  }

  const authorization = await authorizeInboundExternalReply({
    store,
    threadId: resolved.threadId,
    channel: body.channel,
    externalActorId: body.externalAuthorId,
    target: body.target,
  });

  await store.createExternalInteractionAudit({
    id: newId("eia"),
    threadId: resolved.threadId,
    channel: body.channel,
    interactionKind: "reply",
    externalActorId: body.externalAuthorId,
    externalMessageId: body.externalMessageId,
    decision: authorization.ok ? "allowed" : "denied",
    reasonCode: authorization.ok ? "allowed" : authorization.reasonCode,
    createdAt: new Date().toISOString(),
  });

  if (!authorization.ok) {
    return Response.json({ ok: false, error: authorization.reasonCode }, { status: 403 });
  }

  const threadMessages = await store.listMessages({
    threadId: resolved.threadId,
    limit: 200,
  });

  const canonicalRecipient = [...threadMessages]
    .reverse()
    .find((message) => message.source === "internal" || message.source === "dashboard")
    ?.senderEmployeeId ?? thread.createdByEmployeeId;

  if (!canonicalRecipient) {
    return Response.json(
      {
        ok: false,
        error: "thread_recipient_not_resolved",
        threadId: resolved.threadId,
      },
      { status: 409 },
    );
  }

  const created = await store.createMessage({
    id: newId("msg"),
    threadId: resolved.threadId,
    companyId: thread.companyId,
    senderEmployeeId: syntheticExternalSenderEmployeeId(body.channel, body.externalAuthorId),
    receiverEmployeeId: canonicalRecipient,
    type: "coordination",
    status: "delivered",
    source: body.channel,
    subject: body.subject,
    body: body.body,
    payload: body.target ? { target: body.target } : {},
    externalMessageId: body.externalMessageId,
    externalChannel: body.channel,
    externalAuthorId: body.externalAuthorId,
    externalReceivedAt: body.externalReceivedAt,
    requiresResponse: false,
  });

  return Response.json(
    {
      ok: true,
      messageId: created.id,
      threadId: resolved.threadId,
    },
    { status: 200 },
  );
}

export async function handleExternalAction(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  let body: ExternalActionEnvelope;
  try {
    body = (await request.json()) as ExternalActionEnvelope;
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (
    (body.source !== "slack" && body.source !== "email") ||
    typeof body.externalActionId !== "string" ||
    body.externalActionId.trim().length === 0 ||
    typeof body.externalThreadId !== "string" ||
    body.externalThreadId.trim().length === 0 ||
    typeof body.externalAuthorId !== "string" ||
    body.externalAuthorId.trim().length === 0 ||
    typeof body.receivedAt !== "string" ||
    body.receivedAt.trim().length === 0
  ) {
    return Response.json({ ok: false, error: "invalid external action" }, { status: 400 });
  }

  if (!isExternalActionType(body.actionType)) {
    return Response.json({ ok: false, error: "unsupported_action_type" }, { status: 400 });
  }

  if (
    typeof body.metadata !== "undefined" &&
    (!body.metadata || typeof body.metadata !== "object" || Array.isArray(body.metadata))
  ) {
    return Response.json({ ok: false, error: "invalid external action" }, { status: 400 });
  }

  const store = getTaskStore(env);
  const resolved = await resolveCanonicalThreadForExternalAction(
    store,
    body.externalThreadId,
    body.source,
  );

  if (!resolved.ok) {
    return Response.json({ ok: false, error: resolved.error }, { status: 404 });
  }

  const authorization = await authorizeExternalAction({
    store,
    threadId: resolved.thread.id,
    channel: body.source,
    externalActorId: body.externalAuthorId,
    actionType: body.actionType,
  });

  await store.createExternalInteractionAudit({
    id: newId("eia"),
    threadId: resolved.thread.id,
    channel: body.source,
    interactionKind: "action",
    externalActorId: body.externalAuthorId,
    externalActionId: body.externalActionId,
    decision: authorization.ok ? "allowed" : "denied",
    reasonCode: authorization.ok ? "allowed" : authorization.reasonCode,
    createdAt: new Date().toISOString(),
  });

  if (!authorization.ok) {
    return Response.json({ ok: false, error: authorization.reasonCode }, { status: 403 });
  }

  const idempotency = await store.createExternalActionRecord({
    externalActionId: body.externalActionId,
    source: body.source,
    threadId: resolved.thread.id,
    actionType: body.actionType,
  });

  if (idempotency.alreadyExists) {
    return Response.json({ ok: true, deduped: true, threadId: resolved.thread.id });
  }

  const actor = syntheticExternalSenderEmployeeId(body.source, body.externalAuthorId);

  switch (body.actionType) {
    case "approval_approve":
      return approveFromThreadAction({
        env,
        threadId: resolved.thread.id,
        actor,
      });
    case "approval_reject":
      return rejectFromThreadAction({
        env,
        threadId: resolved.thread.id,
        actor,
      });
    case "escalation_acknowledge":
      return acknowledgeFromThreadAction({
        env,
        threadId: resolved.thread.id,
        actor,
      });
    case "escalation_resolve":
      return resolveFromThreadAction({
        env,
        threadId: resolved.thread.id,
        actor,
      });
  }
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

  const messagesWithDeliveries = await attachMirrorDeliveries(
    store,
    messages,
  );

  return Response.json({
    ok: true,
    count: messagesWithDeliveries.length,
    messages: messagesWithDeliveries,
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

  const messagesWithDeliveries = await attachMirrorDeliveries(
    store,
    messages,
  );

  return Response.json({
    ok: true,
    employeeId,
    count: messagesWithDeliveries.length,
    messages: messagesWithDeliveries,
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

  const messagesWithDeliveries = await attachMirrorDeliveries(
    store,
    messages,
  );

  return Response.json({
    ok: true,
    employeeId,
    count: messagesWithDeliveries.length,
    messages: messagesWithDeliveries,
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

  const messagesWithDeliveries = await attachMirrorDeliveries(
    store,
    messages,
  );
  const externalThreadProjections = await store.listExternalThreadProjections(thread.id);
  const externalInteractionPolicy = await store.getThreadExternalInteractionPolicy(thread.id);
  const externalInteractionAudit = await store.listExternalInteractionAudit(thread.id);
  const visibilitySummary = summarizeThreadVisibility({
    thread,
    messages,
    externalThreadProjections,
    externalInteractionPolicy,
  });

  return Response.json({
    ok: true,
    thread,
    externalThreadProjections,
    externalInteractionPolicy,
    externalInteractionAudit,
    messages: messagesWithDeliveries,
    visibilitySummary,
  });
}