import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { createProductExecutionGraph } from "../product/product-execution-loop";

type ProductExecutionBody = {
  createdByEmployeeId?: unknown;
  environment?: unknown;
  targetUrl?: unknown;
  requirementsRef?: unknown;
  testPlanRef?: unknown;
  artifactRef?: unknown;
};

function jsonError(message: string, status = 400, details?: unknown): Response {
  return Response.json({ ok: false, error: message, details }, { status });
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function handleCreateProductExecutionGraph(
  request: Request,
  env: OperatorAgentEnv | undefined,
  projectId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  let body: ProductExecutionBody;
  try {
    body = (await request.json()) as ProductExecutionBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const createdByEmployeeId = stringOrEmpty(body.createdByEmployeeId);
  const environment = stringOrEmpty(body.environment) || "staging";

  if (!createdByEmployeeId) {
    return jsonError("createdByEmployeeId is required");
  }

  const store = getTaskStore(env);
  const project = await store.getProject(projectId);

  if (!project) {
    return jsonError("Project not found", 404);
  }

  if (!project.initiativeKind || !project.productSurface) {
    return jsonError(
      "Product execution graph can only be created for product initiative projects",
      422,
    );
  }

  const execution = await createProductExecutionGraph({
    store,
    project,
    createdByEmployeeId,
    environment,
    targetUrl: stringOrEmpty(body.targetUrl) || undefined,
    requirementsRef: stringOrEmpty(body.requirementsRef) || undefined,
    testPlanRef: stringOrEmpty(body.testPlanRef) || undefined,
    artifactRef: stringOrEmpty(body.artifactRef) || undefined,
  });

  return Response.json({ ok: true, projectId, execution }, { status: 201 });
}