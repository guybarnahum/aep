import { D1ManagerDecisionStore } from "@aep/operator-agent/lib/manager-decision-log-d1";
import { KvManagerDecisionStoreAdapter } from "@aep/operator-agent/lib/kv-store-adapters";
import type {
  ManagerDecision,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";
import type { IManagerDecisionStore } from "@aep/operator-agent/lib/store-types";

export class DualManagerDecisionStore implements IManagerDecisionStore {
  private readonly kv: KvManagerDecisionStoreAdapter;
  private readonly d1: D1ManagerDecisionStore;

  constructor(env: OperatorAgentEnv) {
    this.kv = new KvManagerDecisionStoreAdapter(env);
    this.d1 = new D1ManagerDecisionStore(env);
  }

  async write(entry: ManagerDecision): Promise<void> {
    await this.kv.write(entry);
    await this.d1.write(entry);
  }

  async list(args: {
    managerEmployeeId: string;
    limit: number;
  }): Promise<ManagerDecision[]> {
    return this.d1.list(args);
  }
}