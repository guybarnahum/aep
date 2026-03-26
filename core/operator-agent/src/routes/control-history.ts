import { EmployeeControlHistoryLog } from "@aep/operator-agent/lib/control-history-log";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleControlHistory(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(100, limitParam ? Number(limitParam) || 20 : 20)
  );

  const history = new EmployeeControlHistoryLog(env ?? {});
  const entries = await history.list({ employeeId, limit });

  return Response.json({
    ok: true,
    employeeId,
    count: entries.length,
    entries,
  });
}
