import { timeoutRecoveryEmployee } from "@aep/operator-agent/org/employees";
import type { AgentWorkLogEntry, OperatorAgentEnv } from "@aep/operator-agent/types";

function workLogPrefix(employeeId: string): string {
  return `worklog:${employeeId}:`;
}

function compareDescendingByTimestamp(
  a: AgentWorkLogEntry,
  b: AgentWorkLogEntry
): number {
  return b.timestamp.localeCompare(a.timestamp);
}

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

  const employeeId = timeoutRecoveryEmployee.identity.employeeId;
  const prefix = workLogPrefix(employeeId);

  const list = await env?.OPERATOR_AGENT_KV?.list({ prefix, limit });
  const keys = list?.keys ?? [];

  const entries: AgentWorkLogEntry[] = [];

  for (const key of keys) {
    const raw = await env?.OPERATOR_AGENT_KV?.get(key.name);
    if (!raw) {
      continue;
    }

    try {
      entries.push(JSON.parse(raw) as AgentWorkLogEntry);
    } catch {
      // ignore malformed entries
    }
  }

  entries.sort(compareDescendingByTimestamp);

  return Response.json({
    ok: true,
    employeeId,
    count: entries.length,
    entries
  });
}
