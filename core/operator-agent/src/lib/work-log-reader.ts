import { createStores } from "@aep/operator-agent/lib/store-factory";
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
  const stores = createStores(args.env ?? {});
  return stores.agentWorkLog.listByEmployee({
    employeeId: args.employeeId,
    limit: args.limit,
  });
}