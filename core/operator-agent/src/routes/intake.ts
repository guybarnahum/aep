import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { newId } from "@aep/shared";
import type { IntakeRequestStatus } from "@aep/operator-agent/lib/store-types";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type CreateIntakeBody = {
  companyId?: unknown;
  title?: unknown;
  description?: unknown;
  requestedBy?: unknown;
  source?: unknown;
};

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function parseLimit(raw: string | null, fallback = 50): number {
  const parsed = Number.parseInt(raw ?? `${fallback}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, 200);
}

export async function handleCreateIntake(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  let body: CreateIntakeBody;
  try {
    body = (await request.json()) as CreateIntakeBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const requestedBy =
    typeof body.requestedBy === "string" ? body.requestedBy.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!companyId || !title || !requestedBy || !source) {
    return jsonError("Missing required fields: companyId, title, requestedBy, source");
  }

  const store = getTaskStore(env);
  const intake = {
    id: newId("intake"),
    companyId,
    title,
    description: description || null,
    requestedBy,
    source,
    status: "submitted" as const,
    createdAt: new Date().toISOString(),
  };

  await store.createIntakeRequest(intake);

  return Response.json({ ok: true, intake }, { status: 201 });
}

export async function handleListIntake(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim() || undefined;

  const store = getTaskStore(env);
  const items = await store.listIntakeRequests({
    companyId,
    limit: parseLimit(url.searchParams.get("limit"), 50),
  });

  return Response.json({ ok: true, count: items.length, items });
}

export async function handleGetIntake(
  request: Request,
  env: OperatorAgentEnv | undefined,
  id: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  const store = getTaskStore(env);
  const item = await store.getIntakeRequest(id);

  if (!item) {
    return jsonError("Not found", 404);
  }

  return Response.json({ ok: true, item });
}

type UpdateIntakeStatusBody = {
  status?: unknown;
};

const INTAKE_STATUSES: IntakeRequestStatus[] = [
  "submitted",
  "triaged",
  "converted",
  "rejected",
];

function parseIntakeStatus(raw: unknown): IntakeRequestStatus | null {
  if (typeof raw === "string" && (INTAKE_STATUSES as string[]).includes(raw)) {
    return raw as IntakeRequestStatus;
  }
  return null;
}

export async function handleUpdateIntakeStatus(
  request: Request,
  env: OperatorAgentEnv | undefined,
  id: string,
): Promise<Response> {
  if (request.method !== "PATCH") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  let body: UpdateIntakeStatusBody;
  try {
    body = (await request.json()) as UpdateIntakeStatusBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const status = parseIntakeStatus(body.status);
  if (!status) {
    return jsonError(
      `status must be one of: ${INTAKE_STATUSES.join(", ")}`,
    );
  }

  const store = getTaskStore(env);
  const existing = await store.getIntakeRequest(id);
  if (!existing) {
    return jsonError("Not found", 404);
  }

  await store.updateIntakeRequestStatus({ id, status });
  const updated = await store.getIntakeRequest(id);

  return Response.json({ ok: true, item: updated });
}
