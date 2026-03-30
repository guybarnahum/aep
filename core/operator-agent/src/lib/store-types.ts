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
  ResolvedEmployeeControl,
} from "@aep/operator-agent/types";

export interface IApprovalStore {
  write(record: ApprovalRecord): Promise<void>;
  get(approvalId: string): Promise<ApprovalRecord | null>;
  put(record: ApprovalRecord): Promise<void>;
  update(record: ApprovalRecord): Promise<void>;
  decide(args: {
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
  >;
  markExecuted(args: {
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
  >;
  list(args: {
    limit: number;
    status?: ApprovalStatus;
    employeeId?: string;
    companyId?: string;
    actionType?: string;
    targetEmployeeId?: string;
  }): Promise<ApprovalRecord[]>;
  findLatestDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null>;
  findLatestApprovedDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null>;
}

export interface IEmployeeControlStore {
  get(employeeId: string): Promise<EmployeeControlRecord | null>;
  put(record: EmployeeControlRecord): Promise<void>;
  clear(employeeId: string): Promise<void>;
  getEffective(employeeId: string, nowIso: string): Promise<ResolvedEmployeeControl>;
  isBlocked(control: EmployeeControlRecord | null): boolean;
}

export interface IEmployeeControlHistoryStore {
  write(record: EmployeeControlHistoryRecord): Promise<void>;
  list(args: { employeeId?: string; limit: number }): Promise<EmployeeControlHistoryRecord[]>;
}

export interface IEscalationStore {
  write(record: EscalationRecord): Promise<void>;
  get(escalationId: string): Promise<EscalationRecord | null>;
  put(record: EscalationRecord): Promise<void>;
  list(limit: number, stateFilter?: EscalationState): Promise<EscalationRecord[]>;
}

export interface IManagerDecisionStore {
  write(entry: ManagerDecision): Promise<void>;
}

export interface IAgentWorkLogStore {
  write(entry: AgentWorkLogEntry): Promise<void>;
  listByEmployee(args: { employeeId: string; limit: number }): Promise<AgentWorkLogEntry[]>;
}
