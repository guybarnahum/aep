import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { ProjectStatus } from "@aep/operator-agent/lib/store-types";
import { runTeamWorkLoop } from "@aep/operator-agent/lib/team-work-loop";
import { isTeamId } from "@aep/operator-agent/org/teams";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newId } from "@aep/shared";
import { TEAM_WEB_PRODUCT } from "../org/teams";
import { bootstrapProductInitiativeTasks } from "../product/product-initiative-bootstrap";
import {
  parseProductExternalVisibility,
  parseProductInitiativeKind,
  parseProductSurface,
} from "../product/product-initiative-contracts";

type CreateProjectBody = {
  companyId?: unknown;
  intakeRequestId?: unknown;
  createdByEmployeeId?: unknown;
  title?: unknown;
  description?: unknown;
  ownerTeamId?: unknown;
  initiativeKind?: unknown;
  productSurface?: unknown;
  externalVisibility?: unknown;
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
  ctx?: ExecutionContext,
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
  const initiativeKind = parseProductInitiativeKind(body.initiativeKind);
  const productSurface = parseProductSurface(body.productSurface);
  const externalVisibility = parseProductExternalVisibility(body.externalVisibility);
  let intakeRequestedBy: string | null = null;

  if (!companyId || !title || !ownerTeamId) {
    return jsonError("Missing required fields: companyId, title, ownerTeamId");
  }

  if (!isTeamId(ownerTeamId)) {
    return jsonError(`Unsupported ownerTeamId: ${ownerTeamId}`);
  }

  if (typeof body.initiativeKind !== "undefined" && !initiativeKind) {
    return jsonError(`Unsupported initiativeKind: ${String(body.initiativeKind)}`);
  }

  if (typeof body.productSurface !== "undefined" && !productSurface) {
    return jsonError(`Unsupported productSurface: ${String(body.productSurface)}`);
  }

  if (typeof body.externalVisibility !== "undefined" && !externalVisibility) {
    return jsonError(
      `Unsupported externalVisibility: ${String(body.externalVisibility)}`,
    );
  }

  if (initiativeKind && (!productSurface || !externalVisibility)) {
    return jsonError(
      "Product initiatives require initiativeKind, productSurface, and externalVisibility",
    );
  }

  if (!initiativeKind && (productSurface || externalVisibility)) {
    return jsonError(
      "productSurface and externalVisibility require initiativeKind",
    );
  }

  if (initiativeKind && ownerTeamId !== TEAM_WEB_PRODUCT) {
    return jsonError("Product initiatives must be owned by team_web_product");
  }

  if (initiativeKind && !createdByEmployeeId && !intakeRequestId) {
    return jsonError(
      "Product initiatives require createdByEmployeeId or linked intake provenance",
    );
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
    initiativeKind: initiativeKind ?? null,
    productSurface: productSurface ?? null,
    externalVisibility: externalVisibility ?? null,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archivedAt: null,
  };

  await store.createProject(project);

  let bootstrap: { taskIds: string[]; threadId: string; messageId: string } | null = null;

  if (initiativeKind) {
    try {
      bootstrap = await bootstrapProductInitiativeTasks({
        store,
        project,
        createdByEmployeeId:
          project.createdByEmployeeId ?? createdByEmployeeId ?? intakeRequestedBy ?? "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[projects] product initiative bootstrap failed after project creation: projectId=${project.id}, error=${message}`,
      );
      return Response.json(
        {
          ok: false,
          error: "Product initiative bootstrap failed after project creation",
          projectId: project.id,
          projectCreated: true,
          bootstrapFailed: true,
        },
        { status: 500 },
      );
    }

    if (bootstrap && ctx) {
      ctx.waitUntil(
        runTeamWorkLoop({
          env: env as OperatorAgentEnv,
          teamId: project.ownerTeamId as import("@aep/operator-agent/org/teams").TeamId,
          companyId: project.companyId as import("@aep/operator-agent/org/company").CompanyId,
        }).then(async (result) => {
          console.log(
            `[projects] bootstrap work loop result: projectId=${project.id} teamId=${project.ownerTeamId} status=${result.status} pendingTasks=${result.scanned.pendingTasks} eligibleTasks=${result.scanned.eligibleTasks} taskId=${result.taskId ?? "none"} message=${result.message}`,
          );
          if (
            result.taskId &&
            (result.status === "waiting_for_staffing" || result.status === "execution_failed")
          ) {
            await store.setTaskErrorMessage(result.taskId, result.message);
          }
        }).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            `[projects] bootstrap work loop failed: projectId=${project.id} teamId=${project.ownerTeamId} error=${message}`,
          );
        }),
      );
    }
  }

  return Response.json({ ok: true, project, bootstrap }, { status: 201 });
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

  const initiativeKindRaw = url.searchParams.get("initiativeKind");
  const initiativeKind = parseProductInitiativeKind(initiativeKindRaw);
  if (initiativeKindRaw && !initiativeKind) {
    return jsonError(`Unsupported initiativeKind: ${initiativeKindRaw}`);
  }

  const productSurfaceRaw = url.searchParams.get("productSurface");
  const productSurface = parseProductSurface(productSurfaceRaw);
  if (productSurfaceRaw && !productSurface) {
    return jsonError(`Unsupported productSurface: ${productSurfaceRaw}`);
  }

  const store = getTaskStore(env);
  const projects = await store.listProjects({
    companyId: url.searchParams.get("companyId")?.trim() || undefined,
    ownerTeamId,
    status,
    intakeRequestId: url.searchParams.get("intakeRequestId")?.trim() || undefined,
    initiativeKind,
    productSurface,
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
