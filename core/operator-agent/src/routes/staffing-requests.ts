import {
  createStaffingRequest,
  getStaffingRequest,
  listStaffingRequests,
  updateStaffingRequestStatus,
} from "@aep/operator-agent/persistence/d1/staffing-request-store-d1";
import { validateRoleCatalogEntry } from "@aep/operator-agent/persistence/d1/role-catalog-store-d1";
import type {
  StaffingRequestState,
  StaffingRequestUrgency,
  StaffingSource,
} from "@aep/operator-agent/hr/staffing-contracts";
import type { AgentRoleId, OperatorAgentEnv } from "@aep/operator-agent/types";
import type { TeamId } from "@aep/operator-agent/org/teams";

const URGENCIES: StaffingRequestUrgency[] = ["low", "normal", "high", "critical"];
const CREATE_STATUSES = ["draft", "submitted"] as const;
const UPDATE_STATUSES: StaffingRequestState[] = [
  "submitted",
  "approved",
  "fulfilled",
  "rejected",
  "canceled",
];

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "50", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50;
}

function parseSource(raw: unknown): StaffingSource | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  if (source.kind === "task" && typeof source.taskId === "string") {
    return { kind: "task", taskId: source.taskId };
  }
  if (source.kind === "project" && typeof source.projectId === "string") {
    return { kind: "project", projectId: source.projectId };
  }
  if (source.kind === "thread" && typeof source.threadId === "string") {
    return { kind: "thread", threadId: source.threadId };
  }
  if (source.kind === "role" && typeof source.roleId === "string") {
    return { kind: "role", roleId: source.roleId as AgentRoleId };
  }
  if (source.kind === "review" && typeof source.reviewId === "string") {
    return { kind: "review", reviewId: source.reviewId };
  }
  if (source.kind === "manager" && typeof source.managerEmployeeId === "string") {
    return { kind: "manager", managerEmployeeId: source.managerEmployeeId };
  }
  return null;
}

export async function handleStaffingRequests(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (!env) return jsonError("Missing operator-agent environment", 500);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as StaffingRequestState | null;
    const requests = await listStaffingRequests(env, {
      companyId: url.searchParams.get("companyId") ?? undefined,
      teamId: url.searchParams.get("teamId") ?? undefined,
      status:
        status &&
        UPDATE_STATUSES.concat("draft" as StaffingRequestState).includes(status)
          ? status
          : undefined,
      limit: parseLimit(url.searchParams.get("limit")),
    });
    return Response.json({ ok: true, count: requests.length, requests });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Request body must be valid JSON");
  }

  const companyId =
    typeof body.companyId === "string" ? body.companyId.trim() : "company_internal_aep";
  const roleId = typeof body.roleId === "string" ? body.roleId.trim() : "";
  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const urgency =
    typeof body.urgency === "string" &&
    URGENCIES.includes(body.urgency as StaffingRequestUrgency)
      ? (body.urgency as StaffingRequestUrgency)
      : "normal";
  const requestedByEmployeeId =
    typeof body.requestedByEmployeeId === "string" ? body.requestedByEmployeeId.trim() : "";
  const status =
    typeof body.status === "string" &&
    CREATE_STATUSES.includes(body.status as (typeof CREATE_STATUSES)[number])
      ? (body.status as "draft" | "submitted")
      : "draft";
  const source = parseSource(body.source);

  if (!roleId || !teamId || !reason || !requestedByEmployeeId || !source) {
    return jsonError("roleId, teamId, reason, requestedByEmployeeId, and source are required");
  }

  try {
    await validateRoleCatalogEntry(env, { roleId, teamId });
    const staffingRequest = await createStaffingRequest(env, {
      companyId,
      roleId: roleId as AgentRoleId,
      teamId: teamId as TeamId,
      reason,
      urgency,
      source,
      requestedByEmployeeId,
      status,
      threadId: typeof body.threadId === "string" ? body.threadId : undefined,
    });
    return Response.json({ ok: true, staffingRequest }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create staffing request");
  }
}

export async function handleStaffingRequestDetail(
  request: Request,
  env: OperatorAgentEnv | undefined,
  id: string,
): Promise<Response> {
  if (!env) return jsonError("Missing operator-agent environment", 500);
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const staffingRequest = await getStaffingRequest(env, id);
  if (!staffingRequest) return jsonError("Not found", 404);
  return Response.json({ ok: true, staffingRequest });
}

export async function handleStaffingRequestStatus(
  request: Request,
  env: OperatorAgentEnv | undefined,
  id: string,
): Promise<Response> {
  if (!env) return jsonError("Missing operator-agent environment", 500);
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Request body must be valid JSON");
  }

  const nextStatus =
    typeof body.status === "string" &&
    UPDATE_STATUSES.includes(body.status as StaffingRequestState)
      ? (body.status as StaffingRequestState)
      : null;
  if (!nextStatus) return jsonError(`status must be one of: ${UPDATE_STATUSES.join(", ")}`);

  if (nextStatus === "approved" && typeof body.approvedByEmployeeId !== "string") {
    return jsonError("approvedByEmployeeId is required when approving a staffing request");
  }

  try {
    const staffingRequest = await updateStaffingRequestStatus(env, {
      id,
      nextStatus,
      approvedByEmployeeId:
        typeof body.approvedByEmployeeId === "string" ? body.approvedByEmployeeId : undefined,
      approvalId: typeof body.approvalId === "string" ? body.approvalId : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
    });
    return Response.json({ ok: true, staffingRequest });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update staffing request");
  }
}
