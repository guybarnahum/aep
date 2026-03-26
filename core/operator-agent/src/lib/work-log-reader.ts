import type { AgentWorkLogEntry, OperatorAgentEnv } from "@aep/operator-agent/types";

export function workLogPrefix(employeeId: string): string {
  return `worklog:${employeeId}:`;
}

export function compareWorkLogEntriesDescending(
  a: AgentWorkLogEntry,
  b: AgentWorkLogEntry
): number {
  return b.timestamp.localeCompare(a.timestamp);
}

export async function listAgentWorkLogEntries(args: {
  env?: OperatorAgentEnv;
  employeeId: string;
  limit: number;
}): Promise<AgentWorkLogEntry[]> {
  const prefix = workLogPrefix(args.employeeId);
  const list = await args.env?.OPERATOR_AGENT_KV?.list({
    prefix,
    limit: args.limit,
  });
  const keys = list?.keys ?? [];

  const entries: AgentWorkLogEntry[] = [];

  for (const key of keys) {
    const raw = await args.env?.OPERATOR_AGENT_KV?.get(key.name);
    if (!raw) {
      continue;
    }

    try {
      entries.push(JSON.parse(raw) as AgentWorkLogEntry);
    } catch {
      // ignore malformed entries
    }
  }

  entries.sort(compareWorkLogEntriesDescending);
  return entries;
}