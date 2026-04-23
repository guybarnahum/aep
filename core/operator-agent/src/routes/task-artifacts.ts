import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { TaskArtifactType } from "@aep/operator-agent/lib/store-types";
import { newId } from "@aep/shared";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type CreateTaskArtifactRequest = {
  companyId?: string;
  createdByEmployeeId?: string;
  artifactType?: TaskArtifactType;
  summary?: string;
  content?: Record<string, unknown>;
};

function parseLimit(url: URL, defaultValue = 50): number {
  const raw = Number.parseInt(url.searchParams.get("limit") ?? `${defaultValue}`, 10);
  if (!Number.isFinite(raw) || raw <= 0) return defaultValue;
  return Math.min(raw, 200);
}

export async function handleCreateTaskArtifact(
  request: Request,
  env: OperatorAgentEnv | undefined,
  taskId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  let body: CreateTaskArtifactRequest;
  try {
    body = (await request.json()) as CreateTaskArtifactRequest;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  if (!body.artifactType) {
    return Response.json(
      { ok: false, error: "artifactType is required" },
      { status: 400 },
    );
  }

  if (!["plan", "result", "evidence"].includes(body.artifactType)) {
    return Response.json(
      { ok: false, error: "artifactType must be one of plan, result, evidence" },
      { status: 400 },
    );
  }

  const store = getTaskStore(env);
  const artifactId = newId("art");

  try {
    await store.createArtifact({
      id: artifactId,
      taskId,
      companyId: body.companyId ?? "company_internal_aep",
      artifactType: body.artifactType,
      createdByEmployeeId: body.createdByEmployeeId,
      summary: body.summary,
      content: body.content ?? {},
    });
  } catch (error: any) {
    const message = String(error?.message ?? error);
    if (message.startsWith("Task not found:")) {
      return Response.json(
        { ok: false, error: "task not found" },
        { status: 404 },
      );
    }
    throw error;
  }

  return Response.json({ ok: true, artifactId }, { status: 201 });
}

export async function handleListTaskArtifacts(
  request: Request,
  env: OperatorAgentEnv | undefined,
  taskId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const store = getTaskStore(env);

  const artifacts = await store.listArtifacts({
    taskId,
    artifactType: (url.searchParams.get("artifactType") as TaskArtifactType | null) ?? undefined,
    limit: parseLimit(url),
  });

  return Response.json({
    ok: true,
    taskId,
    count: artifacts.length,
    artifacts,
  });
}