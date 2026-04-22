import { listAgentWorkLogEntries } from "@aep/operator-agent/lib/work-log-reader";
import { COMPANY_INTERNAL_AEP } from "@aep/operator-agent/org/company";
import { TEAM_INFRA } from "@aep/operator-agent/org/teams";
import { resolveRuntimeEmployeeByRole } from "@aep/operator-agent/persistence/d1/runtime-employee-resolver-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleWorkLog(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(100, limitParam ? Number(limitParam) || 20 : 20)
  );

  const requestedEmployeeId = url.searchParams.get("employeeId");
  let employeeId = requestedEmployeeId;

  if (!employeeId) {
    if (!env?.OPERATOR_AGENT_DB) {
      return Response.json(
        {
          ok: false,
          error: "employeeId is required when OPERATOR_AGENT_DB is unavailable",
        },
        { status: 503 },
      );
    }

    const employee = await resolveRuntimeEmployeeByRole({
      env,
      companyId: COMPANY_INTERNAL_AEP,
      teamId: TEAM_INFRA,
      roleId: "timeout-recovery-operator",
    });

    if (!employee) {
      return Response.json(
        {
          ok: false,
          error: "Unable to resolve default timeout-recovery-operator",
        },
        { status: 404 },
      );
    }

    employeeId = employee.identity.employeeId;
  }

  const entries = await listAgentWorkLogEntries({
    env,
    employeeId,
    limit,
  });

  return Response.json({
    ok: true,
    employeeId,
    count: entries.length,
    entries,
  });
}
