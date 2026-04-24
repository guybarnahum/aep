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

  const requestedManagerEmployeeId = url.searchParams.get("managerEmployeeId");
  if (!requestedManagerEmployeeId) {
    return Response.json(
      {
        ok: false,
        error: "managerEmployeeId query parameter is required",
      },
      { status: 400 },
    );
  }

  const stores = createStores(env ?? {});
  const entries = await stores.managerDecisions.list({
    managerEmployeeId: requestedManagerEmployeeId,
    limit,
  });

  return Response.json({
    ok: true,
    managerEmployeeId: requestedManagerEmployeeId,
    count: entries.length,
    entries,
  });
}