import { D1EscalationStore } from "@aep/operator-agent/lib/escalation-log-d1";
import { KvEscalationStoreAdapter } from "@aep/operator-agent/lib/kv-store-adapters";
import type {
  EscalationRecord,
  EscalationState,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";
import type { IEscalationStore } from "@aep/operator-agent/lib/store-types";

export class DualEscalationStore implements IEscalationStore {
  private readonly kv: KvEscalationStoreAdapter;
  private readonly d1: D1EscalationStore;

  constructor(env: OperatorAgentEnv) {
    this.kv = new KvEscalationStoreAdapter(env);
    this.d1 = new D1EscalationStore(env);
  }

  async write(record: EscalationRecord): Promise<void> {
    await this.kv.write(record);
    await this.d1.write(record);
  }

  async put(record: EscalationRecord): Promise<void> {
    await this.kv.put(record);
    await this.d1.put(record);
  }

  async get(escalationId: string): Promise<EscalationRecord | null> {
    return this.d1.get(escalationId);
  }

  async list(limit: number, stateFilter?: EscalationState): Promise<EscalationRecord[]> {
    return this.d1.list(limit, stateFilter);
  }
}
