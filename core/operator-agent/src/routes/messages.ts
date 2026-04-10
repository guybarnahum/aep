import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type CreateMessageRequest = {
  companyId?: string;
  senderEmployeeId?: string;
  receiverEmployeeId?: string;
  receiverTeamId?: string;
  type?: "task" | "escalation" | "coordination";
  payload?: Record<string, unknown>;
  relatedTaskId?: string;
  relatedEscalationId?: string;
  relatedApprovalId?: string;
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

  if (!body.senderEmployeeId || !body.type) {
    return Response.json(
      { ok: false, error: "senderEmployeeId and type are required" },
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
  const messageId = `msg_${crypto.randomUUID().split("-")[0]}`;

  await store.createMessage({
    id: messageId,
    companyId: body.companyId ?? "company_internal_aep",
    senderEmployeeId: body.senderEmployeeId,
    receiverEmployeeId: body.receiverEmployeeId,
    receiverTeamId: body.receiverTeamId,
    type: body.type,
    status: "pending",
    payload: body.payload ?? {},
    relatedTaskId: body.relatedTaskId,
    relatedEscalationId: body.relatedEscalationId,
    relatedApprovalId: body.relatedApprovalId,
  });

  return Response.json({ ok: true, messageId }, { status: 201 });
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
    receiverEmployeeId: url.searchParams.get("receiverEmployeeId") ?? undefined,
    receiverTeamId: url.searchParams.get("receiverTeamId") ?? undefined,
    relatedTaskId: url.searchParams.get("relatedTaskId") ?? undefined,
    limit: parseLimit(url),
  });

  return Response.json({
    ok: true,
    count: messages.length,
    messages,
  });
}

export async function handleListMessagesForEmployee(
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