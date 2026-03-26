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
      return normalizeApproval(JSON.parse(raw) as Partial<ApprovalRecord>);
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

    if (isTerminalApprovalStatus(existing.status)) {
      return { ok: false, reason: "already_decided", approval: existing };
    }

    const updated: ApprovalRecord = {
      ...existing,
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
    | { ok: false; reason: "not_found" | "not_approved"; approval?: ApprovalRecord }
  > {
    const existing = await this.get(args.approvalId);

    if (!existing) {
      return { ok: false, reason: "not_found" };
    }

    if (existing.status !== "approved") {
      return { ok: false, reason: "not_approved", approval: existing };
    }

    const updated: ApprovalRecord = {
      ...existing,
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

    for (const key of list?.keys ?? []) {
      const raw = await this.env.OPERATOR_AGENT_KV?.get(key.name);
      if (!raw) continue;

      try {
        entries.push(
          normalizeApproval(JSON.parse(raw) as Partial<ApprovalRecord>)
        );
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
}