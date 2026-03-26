import { getApprovalPolicy } from "@aep/operator-agent/lib/approval-policy";
import type {
  AgentRoleId,
  ApprovalRecord,
  ApprovalStatus,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

function approvalKey(approvalId: string): string {
  return `approval:${approvalId}`;
}

function approvalListPrefix(): string {
  return "approval:";
}

function normalizeApproval(raw: Partial<ApprovalRecord>): ApprovalRecord {
  return {
    ...(raw as ApprovalRecord),
    status: raw.status ?? "pending",
  };
}

function compareDescendingByTimestamp(
  a: ApprovalRecord,
  b: ApprovalRecord
): number {
  return b.timestamp.localeCompare(a.timestamp);
}

function isTerminalApprovalStatus(status: ApprovalStatus): boolean {
  return status === "approved" || status === "rejected" || status === "expired";
}

function isExpiredApproval(record: ApprovalRecord, nowIso: string): boolean {
  return Boolean(record.expiresAt && record.expiresAt <= nowIso);
}

function isApprovalConsumed(record: ApprovalRecord): boolean {
  return Boolean(record.executionId || record.executedAt);
}

export class ApprovalStore {
  constructor(private readonly env: OperatorAgentEnv) {}

  async write(record: ApprovalRecord): Promise<void> {
    await this.env.OPERATOR_AGENT_KV?.put(
      approvalKey(record.approvalId),
      JSON.stringify(record),
      {
        expirationTtl: 60 * 60 * 24 * 30,
      }
    );
  }

  async get(approvalId: string): Promise<ApprovalRecord | null> {
    const raw = await this.env.OPERATOR_AGENT_KV?.get(approvalKey(approvalId));
    if (!raw) return null;
    try {
      const normalized = normalizeApproval(JSON.parse(raw) as Partial<ApprovalRecord>);
      return this.expireIfNeeded({
        approval: normalized,
        nowIso: new Date().toISOString(),
      });
    } catch {
      return null;
    }
  }

  async put(record: ApprovalRecord): Promise<void> {
    await this.write(record);
  }

  async update(record: ApprovalRecord): Promise<void> {
    await this.put(record);
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
    const existing = await this.get(args.approvalId);

    if (!existing) {
      return { ok: false, reason: "not_found" };
    }

    const normalized = await this.expireIfNeeded({
      approval: existing,
      nowIso: new Date().toISOString(),
    });

    if (isTerminalApprovalStatus(normalized.status)) {
      return { ok: false, reason: "already_decided", approval: normalized };
    }

    const updated: ApprovalRecord = {
      ...normalized,
      status: args.nextStatus,
      decidedAt: args.decidedAt ?? new Date().toISOString(),
      decidedBy: args.decidedBy,
      decisionNote: args.decisionNote,
    };

    await this.put(updated);

    return { ok: true, approval: updated };
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
    const existing = await this.get(args.approvalId);

    if (!existing) {
      return { ok: false, reason: "not_found" };
    }

    const normalized = await this.expireIfNeeded({
      approval: existing,
      nowIso: args.executedAt,
    });

    if (normalized.status === "expired") {
      return { ok: false, reason: "expired", approval: normalized };
    }

    if (normalized.status !== "approved") {
      return { ok: false, reason: "not_approved", approval: normalized };
    }

    const policy = getApprovalPolicy(normalized.actionType);
    if (policy.singleUse && isApprovalConsumed(normalized)) {
      return { ok: false, reason: "already_executed", approval: normalized };
    }

    const updated: ApprovalRecord = {
      ...normalized,
      executedAt: args.executedAt,
      executionId: args.executionId,
      executedByEmployeeId: args.executedByEmployeeId,
      executedByRoleId: args.executedByRoleId,
    };

    await this.put(updated);

    return { ok: true, approval: updated };
  }

  async list(args: {
    limit: number;
    status?: ApprovalStatus;
    employeeId?: string;
    companyId?: string;
    actionType?: string;
    targetEmployeeId?: string;
  }): Promise<ApprovalRecord[]> {
    const list = await this.env.OPERATOR_AGENT_KV?.list({
      prefix: approvalListPrefix(),
      limit: 100,
    });

    const entries: ApprovalRecord[] = [];
    const nowIso = new Date().toISOString();

    for (const key of list?.keys ?? []) {
      const raw = await this.env.OPERATOR_AGENT_KV?.get(key.name);
      if (!raw) continue;

      try {
        const normalized = normalizeApproval(JSON.parse(raw) as Partial<ApprovalRecord>);
        const expiredAware = await this.expireIfNeeded({
          approval: normalized,
          nowIso,
        });
        entries.push(expiredAware);
      } catch {
        // ignore malformed entries
      }
    }

    entries.sort(compareDescendingByTimestamp);

    return entries
      .filter((entry) =>
        args.status ? entry.status === args.status : true
      )
      .filter((entry) =>
        args.employeeId ? entry.requestedByEmployeeId === args.employeeId : true
      )
      .filter((entry) =>
        args.companyId ? entry.companyId === args.companyId : true
      )
      .filter((entry) =>
        args.actionType ? entry.actionType === args.actionType : true
      )
      .filter((entry) => {
        if (!args.targetEmployeeId) {
          return true;
        }
        const target = entry.payload?.targetEmployeeId;
        return typeof target === "string" && target === args.targetEmployeeId;
      })
      .slice(0, args.limit);
  }

  async findLatestDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null> {
    const entries = await this.list({
      limit: 20,
      actionType: args.actionType,
      targetEmployeeId: args.targetEmployeeId,
    });

    return entries[0] ?? null;
  }

  async findLatestApprovedDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null> {
    const entries = await this.list({
      limit: 20,
      status: "approved",
      actionType: args.actionType,
      targetEmployeeId: args.targetEmployeeId,
    });

    return entries[0] ?? null;
  }

  async expireIfNeeded(args: {
    approval: ApprovalRecord;
    nowIso: string;
  }): Promise<ApprovalRecord> {
    if (
      args.approval.status !== "pending" &&
      args.approval.status !== "approved"
    ) {
      return args.approval;
    }

    if (!isExpiredApproval(args.approval, args.nowIso)) {
      return args.approval;
    }

    const updated: ApprovalRecord = {
      ...args.approval,
      status: "expired",
    };

    await this.put(updated);
    return updated;
  }
}
