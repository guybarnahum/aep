import { listAgentWorkLogEntries } from "@aep/operator-agent/lib/work-log-reader";
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
  if (!requestedEmployeeId) {
    return Response.json(
      {
        ok: false,
        error: "employeeId query parameter is required",
      },
      { status: 400 },
    );
  }

  const entries = await listAgentWorkLogEntries({
    env,
    employeeId: requestedEmployeeId,
    limit,
  });

  return Response.json({
    ok: true,
    employeeId: requestedEmployeeId,
    count: entries.length,
    entries,
  });
}
