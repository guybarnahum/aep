import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { ProjectStatus } from "@aep/operator-agent/lib/store-types";
import { isTeamId } from "@aep/operator-agent/org/teams";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newId } from "@aep/shared";

type CreateProjectBody = {
  companyId?: unknown;
  intakeRequestId?: unknown;
  createdByEmployeeId?: unknown;
  title?: unknown;
  description?: unknown;
  ownerTeamId?: unknown;
};

const PROJECT_STATUSES: ProjectStatus[] = [
  "active",
  "paused",
  "completed",
  "archived",
];

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

function parseProjectStatus(value: string | null): ProjectStatus | undefined {
  if (!value) {
    return undefined;
  }
  return PROJECT_STATUSES.includes(value as ProjectStatus)
    ? (value as ProjectStatus)
    : undefined;
}

export async function handleCreateProject(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  let body: CreateProjectBody;
  try {
    body = (await request.json()) as CreateProjectBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const ownerTeamId =
    typeof body.ownerTeamId === "string" ? body.ownerTeamId.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const createdByEmployeeId =
    typeof body.createdByEmployeeId === "string"
      ? body.createdByEmployeeId.trim()
      : "";
  const intakeRequestId =
    typeof body.intakeRequestId === "string" && body.intakeRequestId.trim()
      ? body.intakeRequestId.trim()
      : null;
  let intakeRequestedBy: string | null = null;

  if (!companyId || !title || !ownerTeamId) {
    return jsonError("Missing required fields: companyId, title, ownerTeamId");
  }

  if (!isTeamId(ownerTeamId)) {
    return jsonError(`Unsupported ownerTeamId: ${ownerTeamId}`);
  }

  const store = getTaskStore(env);

  if (intakeRequestId) {
    const intake = await store.getIntakeRequest(intakeRequestId);
    if (!intake) {
      return jsonError(`Intake request not found: ${intakeRequestId}`, 404);
    }
    if (intake.companyId !== companyId) {
      return jsonError(
        "Project companyId must match linked intake request companyId",
      );
    }
    intakeRequestedBy = intake.requestedBy;
  }

  const now = new Date().toISOString();
  const project = {
    id: newId("project"),
    companyId,
    intakeRequestId,
    createdByEmployeeId: createdByEmployeeId || intakeRequestedBy,
    title,
    description: description || null,
    ownerTeamId,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archivedAt: null,
  };

  await store.createProject(project);

  return Response.json({ ok: true, project }, { status: 201 });
}

export async function handleListProjects(
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
  const statusRaw = url.searchParams.get("status");
  const status = parseProjectStatus(statusRaw);

  if (statusRaw && !status) {
    return jsonError(`Unsupported project status: ${statusRaw}`);
  }

  const ownerTeamId = url.searchParams.get("ownerTeamId")?.trim() || undefined;
  if (ownerTeamId && !isTeamId(ownerTeamId)) {
    return jsonError(`Unsupported ownerTeamId: ${ownerTeamId}`);
  }

  const store = getTaskStore(env);
  const projects = await store.listProjects({
    companyId: url.searchParams.get("companyId")?.trim() || undefined,
    ownerTeamId,
    status,
    intakeRequestId: url.searchParams.get("intakeRequestId")?.trim() || undefined,
    limit: parseLimit(url.searchParams.get("limit"), 50),
  });

  return Response.json({ ok: true, count: projects.length, projects });
}

export async function handleGetProject(
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
  const project = await store.getProject(id);

  if (!project) {
    return jsonError("Not found", 404);
  }

  return Response.json({ ok: true, project });
}
