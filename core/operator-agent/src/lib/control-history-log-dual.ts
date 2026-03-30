import { D1EmployeeControlHistoryStore } from "@aep/operator-agent/lib/control-history-log-d1";
import { KvEmployeeControlHistoryStoreAdapter } from "@aep/operator-agent/lib/kv-store-adapters";
import type { IEmployeeControlHistoryStore } from "@aep/operator-agent/lib/store-types";
import type {
  EmployeeControlHistoryRecord,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

export class DualEmployeeControlHistoryStore implements IEmployeeControlHistoryStore {
  private readonly kv: KvEmployeeControlHistoryStoreAdapter;
  private readonly d1: D1EmployeeControlHistoryStore;

  constructor(env: OperatorAgentEnv) {
    this.kv = new KvEmployeeControlHistoryStoreAdapter(env);
    this.d1 = new D1EmployeeControlHistoryStore(env);
  }

  async write(record: EmployeeControlHistoryRecord): Promise<void> {
    await this.kv.write(record);
    await this.d1.write(record);
  }

  async list(args: {
    employeeId?: string;
    limit: number;
  }): Promise<EmployeeControlHistoryRecord[]> {
    return this.d1.list(args);
  }
}