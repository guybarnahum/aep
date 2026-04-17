import { fromJson, toJson } from "./d1-json";
import type { IEmployeeControlStore } from "@aep/operator-agent/lib/store-types";
import type {
  EmployeeControlRecord,
  OperatorAgentEnv,
  ResolvedEmployeeControl,
} from "@aep/operator-agent/types";

type EmployeeControlRow = {
  employee_id: string;
  state: string;
  transition: string;
  updated_at: string;
  updated_by_employee_id: string;
  updated_by_role_id: string;
  policy_version: string;
  reason: string;
  message: string;
  previous_state: string | null;
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

function isBlockedState(state: EmployeeControlRecord["state"]): boolean {
  return state === "disabled_pending_review" || state === "disabled_by_manager";
}

function rowToControl(row: EmployeeControlRow): EmployeeControlRecord {
  return {
    employeeId: row.employee_id,
    state: row.state as EmployeeControlRecord["state"],
    transition: row.transition as EmployeeControlRecord["transition"],
    updatedAt: row.updated_at,
    updatedByEmployeeId: row.updated_by_employee_id,
    updatedByRoleId: row.updated_by_role_id as EmployeeControlRecord["updatedByRoleId"],
    policyVersion: row.policy_version,
    reason: row.reason as EmployeeControlRecord["reason"],
    message: row.message,
    previousState: row.previous_state as EmployeeControlRecord["previousState"],
    reviewAfter: row.review_after ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    budgetOverride: fromJson(row.budget_override_json) ?? undefined,
    authorityOverride: fromJson(row.authority_override_json) ?? undefined,
    approvalId: row.approval_id ?? undefined,
    approvalExecutedAt: row.approval_executed_at ?? undefined,
    approvalExecutionId: row.approval_execution_id ?? undefined,
    evidence: fromJson(row.evidence_json) ?? undefined,
  };
}

function toResolvedControl(
  employeeId: string,
  control: EmployeeControlRecord | null
): ResolvedEmployeeControl {
  if (!control) {
    return {
      employeeId,
      state: "enabled",
      blocked: false,
      control: null,
    };
  }

  return {
    employeeId,
    state: control.state,
    blocked: isBlockedState(control.state),
    reviewAfter: control.reviewAfter,
    expiresAt: control.expiresAt,
    budgetOverride: control.budgetOverride,
    authorityOverride: control.authorityOverride,
    control,
  };
}

export class D1EmployeeControlStore implements IEmployeeControlStore {
  private readonly db: D1Database;

  constructor(private readonly env: OperatorAgentEnv) {
    this.db = requireDb(env);
  }

  async get(employeeId: string): Promise<EmployeeControlRecord | null> {
    const row = await this.db
      .prepare(`SELECT * FROM employee_controls WHERE employee_id = ?`)
      .bind(employeeId)
      .first<EmployeeControlRow>();

    return row ? rowToControl(row) : null;
  }

  async put(record: EmployeeControlRecord): Promise<void> {
    const sql = `
      INSERT INTO employee_controls (
        employee_id,
        state,
        transition,
        updated_at,
        updated_by_employee_id,
        updated_by_role_id,
        policy_version,
        reason,
        message,
        previous_state,
        review_after,
        expires_at,
        budget_override_json,
        authority_override_json,
        approval_id,
        approval_executed_at,
        approval_execution_id,
        evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_id) DO UPDATE SET
        state = excluded.state,
        transition = excluded.transition,
        updated_at = excluded.updated_at,
        updated_by_employee_id = excluded.updated_by_employee_id,
        updated_by_role_id = excluded.updated_by_role_id,
        policy_version = excluded.policy_version,
        reason = excluded.reason,
        message = excluded.message,
        previous_state = excluded.previous_state,
        review_after = excluded.review_after,
        expires_at = excluded.expires_at,
        budget_override_json = excluded.budget_override_json,
        authority_override_json = excluded.authority_override_json,
        approval_id = excluded.approval_id,
        approval_executed_at = excluded.approval_executed_at,
        approval_execution_id = excluded.approval_execution_id,
        evidence_json = excluded.evidence_json
    `;

    await this.db.prepare(sql).bind(
      record.employeeId,
      record.state,
      record.transition,
      record.updatedAt,
      record.updatedByEmployeeId,
      record.updatedByRoleId,
      record.policyVersion,
      record.reason,
      record.message,
      record.previousState ?? null,
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

  async clear(employeeId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM employee_controls WHERE employee_id = ?`)
      .bind(employeeId)
      .run();
  }

  async getEffective(employeeId: string, _nowIso: string): Promise<ResolvedEmployeeControl> {
    const control = await this.get(employeeId);
    return toResolvedControl(employeeId, control);
  }

  isBlocked(control: EmployeeControlRecord | null): boolean {
    return control ? isBlockedState(control.state) : false;
  }
}