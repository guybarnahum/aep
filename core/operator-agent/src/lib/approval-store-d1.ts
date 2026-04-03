import { getApprovalPolicy } from "@aep/operator-agent/lib/approval-policy";
import { fromJson, toJson } from "@aep/operator-agent/lib/d1-json";
import type { IApprovalStore } from "@aep/operator-agent/lib/store-types";
import type {
  AgentRoleId,
  ApprovalRecord,
  ApprovalStatus,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type ApprovalRow = {
  approval_id: string;
  timestamp: string;
  company_id: string | null;
  task_id: string | null;
  heartbeat_id: string | null;
  department_id: string;
  requested_by_employee_id: string;
  requested_by_employee_name: string | null;
  requested_by_role_id: string;
  source: string;
  action_type: string;
  payload_json: string;
  status: string;
  expires_at: string | null;
  reason: string;
  message: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  executed_at: string | null;
  execution_id: string | null;
  executed_by_employee_id: string | null;
  executed_by_role_id: string | null;
  execution_context_json: string | null;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function normalizeApproval(raw: Partial<ApprovalRecord>): ApprovalRecord {
  return {
    ...(raw as ApprovalRecord),
    status: raw.status ?? "pending",
  };
}

function rowToApproval(row: ApprovalRow): ApprovalRecord {
  return normalizeApproval({
    approvalId: row.approval_id,
    timestamp: row.timestamp,
    companyId: row.company_id ?? undefined,
    taskId: row.task_id ?? undefined,
    heartbeatId: row.heartbeat_id ?? undefined,
    teamId: row.department_id as ApprovalRecord["teamId"],
    requestedByEmployeeId: row.requested_by_employee_id,
    requestedByEmployeeName: row.requested_by_employee_name ?? undefined,
    requestedByRoleId: row.requested_by_role_id as ApprovalRecord["requestedByRoleId"],
    source: row.source as ApprovalRecord["source"],
    actionType: row.action_type,
    payload: fromJson<Record<string, unknown>>(row.payload_json) ?? {},
    status: row.status as ApprovalStatus,
    expiresAt: row.expires_at ?? undefined,
    reason: row.reason,
    message: row.message,
    decidedAt: row.decided_at ?? undefined,
    decidedBy: row.decided_by ?? undefined,
    decisionNote: row.decision_note ?? undefined,
    executedAt: row.executed_at ?? undefined,
    executionId: row.execution_id ?? undefined,
    executedByEmployeeId: row.executed_by_employee_id ?? undefined,
    executedByRoleId: row.executed_by_role_id as AgentRoleId | undefined,
    executionContext: fromJson(row.execution_context_json) ?? undefined,
  });
}

function approvalToParams(record: ApprovalRecord) {
  return [
    record.approvalId,
    record.timestamp,
    record.companyId ?? null,
    record.taskId ?? null,
    record.heartbeatId ?? null,
    record.teamId,
    record.requestedByEmployeeId,
    record.requestedByEmployeeName ?? null,
    record.requestedByRoleId,
    record.source,
    record.actionType,
    toJson(record.payload),
    record.status,
    record.expiresAt ?? null,
    record.reason,
    record.message,
    record.decidedAt ?? null,
    record.decidedBy ?? null,
    record.decisionNote ?? null,
    record.executedAt ?? null,
    record.executionId ?? null,
    record.executedByEmployeeId ?? null,
    record.executedByRoleId ?? null,
    record.executionContext ? toJson(record.executionContext) : null,
  ] as const;
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

export class D1ApprovalStore implements IApprovalStore {
  private readonly db: D1Database;

  constructor(private readonly env: OperatorAgentEnv) {
    this.db = requireDb(env);
  }

  async write(record: ApprovalRecord): Promise<void> {
    await this.put(record);
  }

  async put(record: ApprovalRecord): Promise<void> {
    const sql = `
      INSERT INTO approvals (
        approval_id,
        timestamp,
        company_id,
        task_id,
        heartbeat_id,
        department_id,
        requested_by_employee_id,
        requested_by_employee_name,
        requested_by_role_id,
        source,
        action_type,
        payload_json,
        status,
        expires_at,
        reason,
        message,
        decided_at,
        decided_by,
        decision_note,
        executed_at,
        execution_id,
        executed_by_employee_id,
        executed_by_role_id,
        execution_context_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(approval_id) DO UPDATE SET
        timestamp = excluded.timestamp,
        company_id = excluded.company_id,
        task_id = excluded.task_id,
        heartbeat_id = excluded.heartbeat_id,
        department_id = excluded.department_id,
        requested_by_employee_id = excluded.requested_by_employee_id,
        requested_by_employee_name = excluded.requested_by_employee_name,
        requested_by_role_id = excluded.requested_by_role_id,
        source = excluded.source,
        action_type = excluded.action_type,
        payload_json = excluded.payload_json,
        status = excluded.status,
        expires_at = excluded.expires_at,
        reason = excluded.reason,
        message = excluded.message,
        decided_at = excluded.decided_at,
        decided_by = excluded.decided_by,
        decision_note = excluded.decision_note,
        executed_at = excluded.executed_at,
        execution_id = excluded.execution_id,
        executed_by_employee_id = excluded.executed_by_employee_id,
        executed_by_role_id = excluded.executed_by_role_id,
        execution_context_json = excluded.execution_context_json
    `;

    await this.db.prepare(sql).bind(...approvalToParams(record)).run();
  }

  async update(record: ApprovalRecord): Promise<void> {
    await this.put(record);
  }

  async get(approvalId: string): Promise<ApprovalRecord | null> {
    const row = await this.db
      .prepare(`SELECT * FROM approvals WHERE approval_id = ?`)
      .bind(approvalId)
      .first<ApprovalRow>();

    if (!row) {
      return null;
    }

    const normalized = rowToApproval(row);
    return this.expireIfNeededInternal({
      approval: normalized,
      nowIso: new Date().toISOString(),
    });
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

    const normalized = await this.expireIfNeededInternal({
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
        reason: "not_found" | "not_approved" | "already_executed" | "expired";
        approval?: ApprovalRecord;
      }
  > {
    const existing = await this.get(args.approvalId);

    if (!existing) {
      return { ok: false, reason: "not_found" };
    }

    const normalized = await this.expireIfNeededInternal({
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
    const where: string[] = [];
    const params: Array<string | number | null> = [];

    if (args.status) {
      where.push(`status = ?`);
      params.push(args.status);
    }

    if (args.employeeId) {
      where.push(`requested_by_employee_id = ?`);
      params.push(args.employeeId);
    }

    if (args.companyId) {
      where.push(`company_id = ?`);
      params.push(args.companyId);
    }

    if (args.actionType) {
      where.push(`action_type = ?`);
      params.push(args.actionType);
    }

    const sql = `
      SELECT * FROM approvals
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    params.push(Math.max(1, args.limit * 3));

    const rows = await this.db.prepare(sql).bind(...params).all<ApprovalRow>();
    const nowIso = new Date().toISOString();

    let entries = (rows.results ?? []).map(rowToApproval);

    const expiredAware: ApprovalRecord[] = [];
    for (const entry of entries) {
      expiredAware.push(
        await this.expireIfNeededInternal({
          approval: entry,
          nowIso,
        })
      );
    }
    entries = expiredAware;

    if (args.targetEmployeeId) {
      entries = entries.filter((entry) => {
        const target = entry.payload?.targetEmployeeId;
        return typeof target === "string" && target === args.targetEmployeeId;
      });
    }

    return entries.slice(0, args.limit);
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

  private async expireIfNeededInternal(args: {
    approval: ApprovalRecord;
    nowIso: string;
  }): Promise<ApprovalRecord> {
    if (args.approval.status !== "pending" && args.approval.status !== "approved") {
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