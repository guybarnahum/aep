import { fulfillStaffingRequest } from "@aep/operator-agent/hr/staffing-fulfillment";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

export async function handleFulfillStaffingRequest(
  request: Request,
  env: OperatorAgentEnv | undefined,
  staffingRequestId: string,
): Promise<Response> {
  if (!env) return jsonError("Missing operator-agent environment", 500);
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Request body must be valid JSON");
  }

  const employeeName =
    typeof body.employeeName === "string" ? body.employeeName.trim() : "";
  const fulfilledByEmployeeId =
    typeof body.fulfilledByEmployeeId === "string"
      ? body.fulfilledByEmployeeId.trim()
      : "";

  if (!employeeName || !fulfilledByEmployeeId) {
    return jsonError("employeeName and fulfilledByEmployeeId are required");
  }

  try {
    const result = await fulfillStaffingRequest(env, staffingRequestId, {
      employeeName,
      fulfilledByEmployeeId,
      runtimeStatus:
        body.runtimeStatus === "planned" ||
        body.runtimeStatus === "active" ||
        body.runtimeStatus === "disabled"
          ? body.runtimeStatus
          : "planned",
      employmentStatus:
        body.employmentStatus === "draft" ||
        body.employmentStatus === "active" ||
        body.employmentStatus === "on_leave" ||
        body.employmentStatus === "retired" ||
        body.employmentStatus === "terminated" ||
        body.employmentStatus === "archived"
          ? body.employmentStatus
          : "draft",
      schedulerMode:
        typeof body.schedulerMode === "string" ? body.schedulerMode : "manual_only",
      bio: typeof body.bio === "string" ? body.bio : undefined,
      tone: typeof body.tone === "string" ? body.tone : undefined,
      skills: Array.isArray(body.skills)
        ? body.skills.filter((value): value is string => typeof value === "string")
        : undefined,
      avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : undefined,
      appearanceSummary:
        typeof body.appearanceSummary === "string"
          ? body.appearanceSummary
          : undefined,
      birthYear: typeof body.birthYear === "number" ? body.birthYear : undefined,
      effectiveAt:
        typeof body.effectiveAt === "string" ? body.effectiveAt : undefined,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to fulfill staffing request",
    );
  }
}
