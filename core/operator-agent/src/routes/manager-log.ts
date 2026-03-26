import type { ManagerDecision, OperatorAgentEnv } from "@aep/operator-agent/types";

function managerLogPrefix(managerEmployeeId: string): string {
  return `managerlog:${managerEmployeeId}:`;
}

function compareDescendingByTimestamp(
  a: ManagerDecision,
  b: ManagerDecision
): number {
  return b.timestamp.localeCompare(a.timestamp);
}

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

  const prefix = managerLogPrefix(managerEmployeeId);
  const list = await env?.OPERATOR_AGENT_KV?.list({ prefix, limit });
  const keys = list?.keys ?? [];

  const entries: ManagerDecision[] = [];

  for (const key of keys) {
    const raw = await env?.OPERATOR_AGENT_KV?.get(key.name);
    if (!raw) {
      continue;
    }

    try {
      entries.push(JSON.parse(raw) as ManagerDecision);
    } catch {
      // ignore malformed entries
    }
  }

  entries.sort(compareDescendingByTimestamp);

  return Response.json({
    ok: true,
    managerEmployeeId,
    count: entries.length,
    entries,
  });
}