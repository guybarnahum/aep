import type { ManagerDecision, OperatorAgentEnv } from "@aep/operator-agent/types";

function managerDecisionKey(
  managerEmployeeId: string,
  timestamp: string,
  employeeId: string,
  reason: string
): string {
  return `managerlog:${managerEmployeeId}:${timestamp}:${employeeId}:${reason}`;
}

export class ManagerDecisionLog {
  constructor(private readonly env: OperatorAgentEnv) {}

  async write(entry: ManagerDecision): Promise<void> {
    await this.env.OPERATOR_AGENT_KV?.put(
      managerDecisionKey(
        entry.managerEmployeeId,
        entry.timestamp,
        entry.employeeId,
        entry.reason
      ),
      JSON.stringify(entry),
      {
        expirationTtl: 60 * 60 * 24 * 14,
      }
    );
  }
}