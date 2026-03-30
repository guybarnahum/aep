import { D1ApprovalStore } from "@aep/operator-agent/lib/approval-store-d1";
import { KvApprovalStoreAdapter } from "@aep/operator-agent/lib/kv-store-adapters";
import type { IApprovalStore } from "@aep/operator-agent/lib/store-types";
import type {
  AgentRoleId,
  ApprovalRecord,
  ApprovalStatus,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

export class DualApprovalStore implements IApprovalStore {
  private readonly kv: KvApprovalStoreAdapter;
  private readonly d1: D1ApprovalStore;

  constructor(env: OperatorAgentEnv) {
    this.kv = new KvApprovalStoreAdapter(env);
    this.d1 = new D1ApprovalStore(env);
  }

  async write(record: ApprovalRecord): Promise<void> {
    await this.kv.write(record);
    await this.d1.write(record);
  }

  async put(record: ApprovalRecord): Promise<void> {
    await this.kv.put(record);
    await this.d1.put(record);
  }

  async update(record: ApprovalRecord): Promise<void> {
    await this.kv.update(record);
    await this.d1.update(record);
  }

  async get(approvalId: string): Promise<ApprovalRecord | null> {
    return this.d1.get(approvalId);
  }

  async list(args: {
    limit: number;
    status?: ApprovalStatus;
    employeeId?: string;
    companyId?: string;
    actionType?: string;
    targetEmployeeId?: string;
  }): Promise<ApprovalRecord[]> {
    return this.d1.list(args);
  }

  async decide(args: {
    approvalId: string;
    nextStatus: "approved" | "rejected";
    decidedBy: string;
    decisionNote?: string;
    decidedAt?: string;
  }): Promise<
    | { ok: true; approval: ApprovalRecord }
    | { ok: false; reason: "not_found" | "already_decided"; approval?: ApprovalRecord }
  > {
    const result = await this.d1.decide(args);

    if (!result.ok) {
      return result;
    }

    await this.kv.put(result.approval);
    return result;
  }

  async markExecuted(args: {
    approvalId: string;
    executedAt: string;
    executionId: string;
    executedByEmployeeId?: string;
    executedByRoleId?: AgentRoleId;
  }): Promise<
    | { ok: true; approval: ApprovalRecord }
    | {
        ok: false;
        reason: "not_found" | "not_approved" | "already_executed" | "expired";
        approval?: ApprovalRecord;
      }
  > {
    const result = await this.d1.markExecuted(args);

    if (!result.ok) {
      return result;
    }

    await this.kv.put(result.approval);
    return result;
  }

  async findLatestDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null> {
    return this.d1.findLatestDecisionForAction(args);
  }

  async findLatestApprovedDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null> {
    return this.d1.findLatestApprovedDecisionForAction(args);
  }
}