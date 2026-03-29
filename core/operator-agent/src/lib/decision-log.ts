import type { AgentWorkLogEntry, OperatorAgentEnv } from "@aep/operator-agent/types";

function workLogKey(employeeId: string, timestamp: string, jobId: string): string {
  return `worklog:${employeeId}:${timestamp}:${jobId}`;
}

export class DecisionLog {
  constructor(private readonly env: OperatorAgentEnv) {}

  async write(entry: AgentWorkLogEntry): Promise<void> {
    const key = workLogKey(entry.employeeId, entry.timestamp, entry.jobId);
    try {
      await this.env.OPERATOR_AGENT_KV?.put(key, JSON.stringify(entry), {
        expirationTtl: 60 * 60 * 24 * 14,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `decision_log_write_failed: KV put failed for ${key}: ${reason}`
      );
    }
  }
}
