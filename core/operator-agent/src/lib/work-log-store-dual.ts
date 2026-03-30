import { KvAgentWorkLogStoreAdapter } from "@aep/operator-agent/lib/kv-store-adapters";
import { D1AgentWorkLogStore } from "@aep/operator-agent/lib/work-log-store-d1";
import type { IAgentWorkLogStore } from "@aep/operator-agent/lib/store-types";
import type {
  AgentWorkLogEntry,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

export class DualAgentWorkLogStore implements IAgentWorkLogStore {
  private readonly kv: KvAgentWorkLogStoreAdapter;
  private readonly d1: D1AgentWorkLogStore;

  constructor(env: OperatorAgentEnv) {
    this.kv = new KvAgentWorkLogStoreAdapter(env);
    this.d1 = new D1AgentWorkLogStore(env);
  }

  async write(entry: AgentWorkLogEntry): Promise<void> {
    await this.kv.write(entry);
    await this.d1.write(entry);
  }

  async listByEmployee(args: {
    employeeId: string;
    limit: number;
  }): Promise<AgentWorkLogEntry[]> {
    return this.d1.listByEmployee(args);
  }
}