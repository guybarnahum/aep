import { applyEmployeeLifecycleAction } from "@aep/operator-agent/persistence/d1/employee-lifecycle-store-d1";
import type { AgentRoleId, OperatorAgentEnv } from "@aep/operator-agent/types";

type LifecycleActionRequest = {
  toTeamId?: string;
  toRoleId?: AgentRoleId;
  reason?: string;
  approvedBy?: string;
  threadId?: string;
  effectiveAt?: string;
};

export async function handleEmployeeLifecycleAction(
  request: Request,
  env: OperatorAgentEnv | undefined,
  employeeId: string,
  action:
    | "activate"
    | "reassign_team"
    | "change_role"
    | "start_leave"
    | "end_leave"
    | "retire"
    | "terminate"
    | "rehire"
    | "archive",
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

  let body: LifecycleActionRequest;
  try {
    body = (await request.json()) as LifecycleActionRequest;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  try {
    const result = await applyEmployeeLifecycleAction(env, employeeId, {
      action,
      toTeamId: body.toTeamId,
      toRoleId: body.toRoleId,
      reason: body.reason,
      approvedBy: body.approvedBy,
      threadId: body.threadId,
      effectiveAt: body.effectiveAt,
    });

    return Response.json({
      ok: true,
      employeeId: result.employeeId,
      employmentStatus: result.employmentStatus,
      teamId: result.teamId,
      roleId: result.roleId,
      action,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to apply employee lifecycle action",
      },
      { status: 400 },
    );
  }
}