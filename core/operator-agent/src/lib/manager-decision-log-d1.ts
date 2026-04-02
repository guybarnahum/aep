import { fromJson, toJson } from "@aep/operator-agent/lib/d1-json";
import type { IManagerDecisionStore } from "@aep/operator-agent/lib/store-types";
import type {
  ManagerDecision,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type ManagerDecisionRow = {
  decision_id: string;
  timestamp: string;
  manager_employee_id: string;
  manager_employee_name: string;
  department_id: string;
  role_id: string;
  policy_version: string;
  employee_id: string;
  reason: string;
  recommendation: string;
  severity: string;
  message: string;
  approval_required: number;
  approval_id: string | null;
  approval_status: string | null;
  approval_gate_status: string | null;
  approval_execution_id: string | null;
  approval_executed_at: string | null;
  evidence_json: string;
  execution_context_json: string | null;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function managerDecisionId(entry: ManagerDecision): string {
  return `${entry.managerEmployeeId}:${entry.timestamp}:${entry.employeeId}:${entry.reason}`;
}

function rowToManagerDecision(row: ManagerDecisionRow): ManagerDecision {
  return {
    timestamp: row.timestamp,
    managerEmployeeId: row.manager_employee_id,
    managerEmployeeName: row.manager_employee_name,
    departmentId: row.department_id as ManagerDecision["departmentId"],
    roleId: row.role_id as ManagerDecision["roleId"],
    policyVersion: row.policy_version,
    employeeId: row.employee_id,
    reason: row.reason as ManagerDecision["reason"],
    recommendation: row.recommendation as ManagerDecision["recommendation"],
    severity: row.severity as ManagerDecision["severity"],
    message: row.message,
    approvalRequired: row.approval_required === 1,
    approvalId: row.approval_id ?? undefined,
    approvalStatus: row.approval_status as ManagerDecision["approvalStatus"],
    approvalGateStatus: row.approval_gate_status as ManagerDecision["approvalGateStatus"],
    approvalExecutionId: row.approval_execution_id ?? undefined,
    approvalExecutedAt: row.approval_executed_at ?? undefined,
    evidence: fromJson(row.evidence_json) ?? {
      windowEntryCount: 0,
      resultCounts: {},
    },
    executionContext: fromJson(row.execution_context_json) ?? undefined,
  };
}

export class D1ManagerDecisionStore implements IManagerDecisionStore {
  private readonly db: D1Database;

  constructor(private readonly env: OperatorAgentEnv) {
    this.db = requireDb(env);
  }

  async write(entry: ManagerDecision): Promise<void> {
    const sql = `
      INSERT INTO manager_decisions (
        decision_id,
        timestamp,
        manager_employee_id,
        manager_employee_name,
        department_id,
        role_id,
        policy_version,
        employee_id,
        reason,
        recommendation,
        severity,
        message,
        approval_required,
        approval_id,
        approval_status,
        approval_gate_status,
        approval_execution_id,
        approval_executed_at,
        evidence_json,
        execution_context_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(decision_id) DO UPDATE SET
        timestamp = excluded.timestamp,
        manager_employee_id = excluded.manager_employee_id,
        manager_employee_name = excluded.manager_employee_name,
        department_id = excluded.department_id,
        role_id = excluded.role_id,
        policy_version = excluded.policy_version,
        employee_id = excluded.employee_id,
        reason = excluded.reason,
        recommendation = excluded.recommendation,
        severity = excluded.severity,
        message = excluded.message,
        approval_required = excluded.approval_required,
        approval_id = excluded.approval_id,
        approval_status = excluded.approval_status,
        approval_gate_status = excluded.approval_gate_status,
        approval_execution_id = excluded.approval_execution_id,
        approval_executed_at = excluded.approval_executed_at,
        evidence_json = excluded.evidence_json,
        execution_context_json = excluded.execution_context_json
    `;

    await this.db.prepare(sql).bind(
      managerDecisionId(entry),
      entry.timestamp,
      entry.managerEmployeeId,
      entry.managerEmployeeName,
      entry.departmentId,
      entry.roleId,
      entry.policyVersion,
      entry.employeeId,
      entry.reason,
      entry.recommendation,
      entry.severity,
      entry.message,
      entry.approvalRequired ? 1 : 0,
      entry.approvalId ?? null,
      entry.approvalStatus ?? null,
      entry.approvalGateStatus ?? null,
      entry.approvalExecutionId ?? null,
      entry.approvalExecutedAt ?? null,
      toJson(entry.evidence) ?? "{}",
      toJson(entry.executionContext) ?? null
    ).run();
  }

  async list(args: {
    managerEmployeeId: string;
    limit: number;
  }): Promise<ManagerDecision[]> {
    const rows = await this.db
      .prepare(
        `
          SELECT * FROM manager_decisions
          WHERE manager_employee_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        `
      )
      .bind(args.managerEmployeeId, args.limit)
      .all<ManagerDecisionRow>();

    return (rows.results ?? []).map(rowToManagerDecision);
  }
}