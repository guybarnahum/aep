import { createStores } from "@aep/operator-agent/lib/store-factory";
import { COMPANY_INTERNAL_AEP } from "@aep/operator-agent/org/company";
import { TEAM_INFRA } from "@aep/operator-agent/org/teams";
import { resolveRuntimeEmployeeByRole } from "@aep/operator-agent/persistence/d1/runtime-employee-resolver-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleManagerLog(
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

  const requestedManagerEmployeeId = url.searchParams.get("managerEmployeeId");
  let managerEmployeeId = requestedManagerEmployeeId;

  if (!managerEmployeeId) {
    if (!env?.OPERATOR_AGENT_DB) {
      return Response.json(
        {
          ok: false,
          error: "managerEmployeeId is required when OPERATOR_AGENT_DB is unavailable",
        },
        { status: 503 },
      );
    }

    const manager = await resolveRuntimeEmployeeByRole({
      env,
      companyId: COMPANY_INTERNAL_AEP,
      teamId: TEAM_INFRA,
      roleId: "infra-ops-manager",
    });

    if (!manager) {
      return Response.json(
        {
          ok: false,
          error: "Unable to resolve default infra-ops-manager",
        },
        { status: 404 },
      );
    }

    managerEmployeeId = manager.identity.employeeId;
  }

  const stores = createStores(env ?? {});
  const entries = await stores.managerDecisions.list({
    managerEmployeeId,
    limit,
  });

  return Response.json({
    ok: true,
    managerEmployeeId,
    count: entries.length,
    entries,
  });
}