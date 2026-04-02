import { timeoutRecoveryEmployee } from "@aep/operator-agent/org/employees";
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

  const employeeId =
    url.searchParams.get("employeeId") ??
    timeoutRecoveryEmployee.identity.employeeId;

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
