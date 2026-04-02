import { createStores } from "@aep/operator-agent/lib/store-factory";
import type { AgentWorkLogEntry, OperatorAgentEnv } from "@aep/operator-agent/types";

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