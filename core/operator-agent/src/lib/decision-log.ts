import type { AgentWorkLogEntry, OperatorAgentEnv } from "../types";

function workLogKey(employeeId: string, timestamp: string, jobId: string): string {
  return `worklog:${employeeId}:${timestamp}:${jobId}`;
}

export class DecisionLog {
  constructor(private readonly env: OperatorAgentEnv) {}

  async write(entry: AgentWorkLogEntry): Promise<void> {
    await this.env.OPERATOR_AGENT_KV?.put(
      workLogKey(entry.employeeId, entry.timestamp, entry.jobId),
      JSON.stringify(entry),
      {
        expirationTtl: 60 * 60 * 24 * 14,
      }
    );
  }
}
