import { D1EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store-d1";
import { KvEmployeeControlStoreAdapter } from "@aep/operator-agent/lib/kv-store-adapters";
import type { IEmployeeControlStore } from "@aep/operator-agent/lib/store-types";
import type {
  EmployeeControlRecord,
  OperatorAgentEnv,
  ResolvedEmployeeControl,
} from "@aep/operator-agent/types";

export class DualEmployeeControlStore implements IEmployeeControlStore {
  private readonly kv: KvEmployeeControlStoreAdapter;
  private readonly d1: D1EmployeeControlStore;

  constructor(env: OperatorAgentEnv) {
    this.kv = new KvEmployeeControlStoreAdapter(env);
    this.d1 = new D1EmployeeControlStore(env);
  }

  async get(employeeId: string): Promise<EmployeeControlRecord | null> {
    return this.d1.get(employeeId);
  }

  async put(record: EmployeeControlRecord): Promise<void> {
    await this.kv.put(record);
    await this.d1.put(record);
  }

  async clear(employeeId: string): Promise<void> {
    await this.kv.clear(employeeId);
    await this.d1.clear(employeeId);
  }

  async getEffective(employeeId: string, nowIso: string): Promise<ResolvedEmployeeControl> {
    return this.d1.getEffective(employeeId, nowIso);
  }

  isBlocked(control: EmployeeControlRecord | null): boolean {
    return this.d1.isBlocked(control);
  }
}