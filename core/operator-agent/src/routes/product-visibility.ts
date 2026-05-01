import { getApprovalStore, getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { buildProductVisibilitySummary } from "../product/product-visibility-summary";

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function parseLimit(raw: string | null, fallback = 50): number {
  const parsed = Number.parseInt(raw ?? `${fallback}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

export async function handleGetProductVisibility(
  request: Request,
  env: OperatorAgentEnv | undefined,
  projectId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  const url = new URL(request.url);
  const summary = await buildProductVisibilitySummary({
    store: getTaskStore(env),
    approvalStore: getApprovalStore(env),
    projectId,
    limit: parseLimit(url.searchParams.get("limit")),
  });

  if (!summary) {
    return jsonError("Project not found", 404);
  }

  return Response.json({ ok: true, summary });
}