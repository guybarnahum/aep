import { fromJson, toJson } from "@aep/operator-agent/lib/d1-json";
import type { IEmployeeControlHistoryStore } from "@aep/operator-agent/lib/store-types";
import type {
  EmployeeControlHistoryRecord,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type EmployeeControlHistoryRow = {
  history_id: string;
  timestamp: string;
  employee_id: string;
  department_id: string;
  updated_by_employee_id: string;
  updated_by_role_id: string;
  policy_version: string;
  transition: string;
  previous_state: string | null;
  next_state: string;
  reason: string;
  message: string;
  review_after: string | null;
  expires_at: string | null;
  budget_override_json: string | null;
  authority_override_json: string | null;
  approval_id: string | null;
  approval_executed_at: string | null;
  approval_execution_id: string | null;
  evidence_json: string | null;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function rowToHistory(row: EmployeeControlHistoryRow): EmployeeControlHistoryRecord {
  return {
    historyId: row.history_id,
    timestamp: row.timestamp,
    employeeId: row.employee_id,
    departmentId: row.department_id as EmployeeControlHistoryRecord["departmentId"],
    updatedByEmployeeId: row.updated_by_employee_id,
    updatedByRoleId: row.updated_by_role_id as EmployeeControlHistoryRecord["updatedByRoleId"],
    policyVersion: row.policy_version,
    transition: row.transition as EmployeeControlHistoryRecord["transition"],
    previousState: row.previous_state as EmployeeControlHistoryRecord["previousState"],
    nextState: row.next_state as EmployeeControlHistoryRecord["nextState"],
    reason: row.reason as EmployeeControlHistoryRecord["reason"],
    message: row.message,
    reviewAfter: row.review_after ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    budgetOverride: fromJson(row.budget_override_json),
    authorityOverride: fromJson(row.authority_override_json),
    approvalId: row.approval_id ?? undefined,
    approvalExecutedAt: row.approval_executed_at ?? undefined,
    approvalExecutionId: row.approval_execution_id ?? undefined,
    evidence: fromJson(row.evidence_json),
  };
}

export class D1EmployeeControlHistoryStore implements IEmployeeControlHistoryStore {
  private readonly db: D1Database;

  constructor(private readonly env: OperatorAgentEnv) {
    this.db = requireDb(env);
  }

  async write(record: EmployeeControlHistoryRecord): Promise<void> {
    const sql = `
      INSERT INTO employee_control_history (
        history_id,
        timestamp,
        employee_id,
        department_id,
        updated_by_employee_id,
        updated_by_role_id,
        policy_version,
        transition,
        previous_state,
        next_state,
        reason,
        message,
        review_after,
        expires_at,
        budget_override_json,
        authority_override_json,
        approval_id,
        approval_executed_at,
        approval_execution_id,
        evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(history_id) DO NOTHING
    `;

    await this.db.prepare(sql).bind(
      record.historyId,
      record.timestamp,
      record.employeeId,
      record.departmentId,
      record.updatedByEmployeeId,
      record.updatedByRoleId,
      record.policyVersion,
      record.transition,
      record.previousState ?? null,
      record.nextState,
      record.reason,
      record.message,
      record.reviewAfter ?? null,
      record.expiresAt ?? null,
      toJson(record.budgetOverride),
      toJson(record.authorityOverride),
      record.approvalId ?? null,
      record.approvalExecutedAt ?? null,
      record.approvalExecutionId ?? null,
      toJson(record.evidence)
    ).run();
  }

  async list(args: {
    employeeId?: string;
    limit: number;
  }): Promise<EmployeeControlHistoryRecord[]> {
    const where = args.employeeId ? `WHERE employee_id = ?` : ``;
    const stmt = this.db.prepare(`
      SELECT * FROM employee_control_history
      ${where}
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = args.employeeId
      ? await stmt.bind(args.employeeId, args.limit).all<EmployeeControlHistoryRow>()
      : await stmt.bind(args.limit).all<EmployeeControlHistoryRow>();

    return (rows.results ?? []).map(rowToHistory);
  }
}