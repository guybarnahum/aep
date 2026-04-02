import { createStores } from "@aep/operator-agent/lib/store-factory";
import type { AgentWorkLogEntry, OperatorAgentEnv } from "@aep/operator-agent/types";

export class DecisionLog {
  constructor(private readonly env: OperatorAgentEnv) {}

  async write(entry: AgentWorkLogEntry): Promise<void> {
    const stores = createStores(this.env);
    try {
      await stores.agentWorkLog.write(entry);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `decision_log_write_failed: agentWorkLog write failed: ${reason}`
      );
    }
  }
}
