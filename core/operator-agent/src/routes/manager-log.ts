import { createStores } from "@aep/operator-agent/lib/store-factory";
import { EMPLOYEE_INFRA_OPS_MANAGER_ID } from "@aep/operator-agent/org/employee-ids";
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

  const managerEmployeeId =
    url.searchParams.get("managerEmployeeId") ?? EMPLOYEE_INFRA_OPS_MANAGER_ID;

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