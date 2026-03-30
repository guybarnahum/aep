import { createStores } from "@aep/operator-agent/lib/store-factory";
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
    url.searchParams.get("managerEmployeeId") ?? "emp_infra_ops_manager_01";

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