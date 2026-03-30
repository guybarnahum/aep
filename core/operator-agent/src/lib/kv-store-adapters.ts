import { ApprovalStore } from "@aep/operator-agent/lib/approval-store";
import { EmployeeControlHistoryLog } from "@aep/operator-agent/lib/control-history-log";
import { DecisionLog } from "@aep/operator-agent/lib/decision-log";
import { EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store";
import { EscalationLog } from "@aep/operator-agent/lib/escalation-log";
import { ManagerDecisionLog } from "@aep/operator-agent/lib/manager-decision-log";
import { listAgentWorkLogEntries } from "@aep/operator-agent/lib/work-log-reader";
import type {
  AgentRoleId,
  AgentWorkLogEntry,
  ApprovalRecord,
  ApprovalStatus,
  EmployeeControlHistoryRecord,
  EmployeeControlRecord,
  EscalationRecord,
  EscalationState,
  ManagerDecision,
  OperatorAgentEnv,
  ResolvedEmployeeControl,
} from "@aep/operator-agent/types";
import type {
  IAgentWorkLogStore,
  IApprovalStore,
  IEmployeeControlHistoryStore,
  IEmployeeControlStore,
  IEscalationStore,
  IManagerDecisionStore,
} from "@aep/operator-agent/lib/store-types";

function compareManagerDecisionsDescending(
  a: ManagerDecision,
  b: ManagerDecision
): number {
  return b.timestamp.localeCompare(a.timestamp);
}

function managerDecisionPrefix(managerEmployeeId: string): string {
  return `managerlog:${managerEmployeeId}:`;
}

export class KvApprovalStoreAdapter implements IApprovalStore {
  private readonly store: ApprovalStore;

  constructor(env: OperatorAgentEnv) {
    this.store = new ApprovalStore(env);
  }

  async write(record: ApprovalRecord): Promise<void> {
    await this.store.write(record);
  }

  async get(approvalId: string): Promise<ApprovalRecord | null> {
    return this.store.get(approvalId);
  }

  async put(record: ApprovalRecord): Promise<void> {
    await this.store.put(record);
  }

  async update(record: ApprovalRecord): Promise<void> {
    await this.store.update(record);
  }

  async decide(args: {
    approvalId: string;
    nextStatus: "approved" | "rejected";
    decidedBy: string;
    decisionNote?: string;
    decidedAt?: string;
  }): Promise<
    | { ok: true; approval: ApprovalRecord }
    | {
        ok: false;
        reason: "not_found" | "already_decided";
        approval?: ApprovalRecord;
      }
  > {
    return this.store.decide(args);
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
        reason:
          | "not_found"
          | "not_approved"
          | "already_executed"
          | "expired";
        approval?: ApprovalRecord;
      }
  > {
    return this.store.markExecuted(args);
  }

  async list(args: {
    limit: number;
    status?: ApprovalStatus;
    employeeId?: string;
    companyId?: string;
    actionType?: string;
    targetEmployeeId?: string;
  }): Promise<ApprovalRecord[]> {
    return this.store.list(args);
  }

  async findLatestDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null> {
    return this.store.findLatestDecisionForAction(args);
  }

  async findLatestApprovedDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null> {
    return this.store.findLatestApprovedDecisionForAction(args);
  }
}

export class KvEmployeeControlStoreAdapter implements IEmployeeControlStore {
  private readonly store: EmployeeControlStore;

  constructor(env: OperatorAgentEnv) {
    this.store = new EmployeeControlStore(env);
  }

  async get(employeeId: string): Promise<EmployeeControlRecord | null> {
    return this.store.get(employeeId);
  }

  async put(record: EmployeeControlRecord): Promise<void> {
    await this.store.put(record);
  }

  async clear(employeeId: string): Promise<void> {
    await this.store.clear(employeeId);
  }

  async getEffective(employeeId: string, nowIso: string): Promise<ResolvedEmployeeControl> {
    return this.store.getEffective(employeeId, nowIso);
  }

  isBlocked(control: EmployeeControlRecord | null): boolean {
    return this.store.isBlocked(control);
  }
}

export class KvEmployeeControlHistoryStoreAdapter
  implements IEmployeeControlHistoryStore
{
  private readonly store: EmployeeControlHistoryLog;

  constructor(env: OperatorAgentEnv) {
    this.store = new EmployeeControlHistoryLog(env);
  }

  async write(record: EmployeeControlHistoryRecord): Promise<void> {
    await this.store.write(record);
  }

  async list(args: {
    employeeId?: string;
    limit: number;
  }): Promise<EmployeeControlHistoryRecord[]> {
    return this.store.list(args);
  }
}

export class KvEscalationStoreAdapter implements IEscalationStore {
  private readonly store: EscalationLog;

  constructor(env: OperatorAgentEnv) {
    this.store = new EscalationLog(env);
  }

  async write(record: EscalationRecord): Promise<void> {
    await this.store.write(record);
  }

  async get(escalationId: string): Promise<EscalationRecord | null> {
    return this.store.get(escalationId);
  }

  async put(record: EscalationRecord): Promise<void> {
    await this.store.put(record);
  }

  async list(limit: number, stateFilter?: EscalationState): Promise<EscalationRecord[]> {
    return this.store.list(limit, stateFilter);
  }
}

export class KvManagerDecisionStoreAdapter implements IManagerDecisionStore {
  private readonly env: OperatorAgentEnv;
  private readonly store: ManagerDecisionLog;

  constructor(env: OperatorAgentEnv) {
    this.env = env;
    this.store = new ManagerDecisionLog(env);
  }

  async write(entry: ManagerDecision): Promise<void> {
    await this.store.write(entry);
  }

  async list(args: {
    managerEmployeeId: string;
    limit: number;
  }): Promise<ManagerDecision[]> {
    const listed = await this.env.OPERATOR_AGENT_KV?.list({
      prefix: managerDecisionPrefix(args.managerEmployeeId),
      limit: args.limit,
    });
    const keys = listed?.keys ?? [];
    const entries: ManagerDecision[] = [];

    for (const key of keys) {
      const raw = await this.env.OPERATOR_AGENT_KV?.get(key.name);
      if (!raw) {
        continue;
      }

      try {
        entries.push(JSON.parse(raw) as ManagerDecision);
      } catch {
        // Ignore malformed entries to preserve legacy route behavior.
      }
    }

    entries.sort(compareManagerDecisionsDescending);
    return entries.slice(0, args.limit);
  }
}

export class KvAgentWorkLogStoreAdapter implements IAgentWorkLogStore {
  private readonly env: OperatorAgentEnv;
  private readonly store: DecisionLog;

  constructor(env: OperatorAgentEnv) {
    this.env = env;
    this.store = new DecisionLog(env);
  }

  async write(entry: AgentWorkLogEntry): Promise<void> {
    await this.store.write(entry);
  }

  async listByEmployee(args: {
    employeeId: string;
    limit: number;
  }): Promise<AgentWorkLogEntry[]> {
    return listAgentWorkLogEntries({
      env: this.env,
      employeeId: args.employeeId,
      limit: args.limit,
    });
  }
}
