import { fulfillStaffingRequest } from "@aep/operator-agent/hr/staffing-fulfillment";
import { getStaffingRequest } from "@aep/operator-agent/persistence/d1/staffing-request-store-d1";
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

  const staffingRequest = await getStaffingRequest(env, staffingRequestId);
  if (!staffingRequest) return jsonError(`Unknown staffingRequestId: ${staffingRequestId}`, 404);

  if (staffingRequest.employeeSpec) {
    const spec = staffingRequest.employeeSpec;
    if (spec.roleId !== staffingRequest.roleId || spec.teamId !== staffingRequest.teamId) {
      return jsonError("Staffing request employeeSpec no longer matches request role/team");
    }
  }

  if (staffingRequest.state !== "approved") {
    return jsonError(`Staffing request is not approved (state: ${staffingRequest.state})`, 409);
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
