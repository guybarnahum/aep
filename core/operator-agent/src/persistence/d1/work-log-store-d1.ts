import { fromJson, toJson } from "./d1-json";
import type { IAgentWorkLogStore } from "@aep/operator-agent/lib/store-types";
import { COMPANY_INTERNAL_AEP } from "@aep/operator-agent/org/company";
import type {
  AgentWorkLogEntry,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type AgentWorkLogRow = {
  entry_id: string;
  timestamp: string;
  employee_id: string;
  employee_name: string;
  department_id: string;
  role_id: string;
  policy_version: string;
  trigger: string;
  run_id: string;
  job_id: string;
  tenant: string | null;
  service: string | null;
  action: string;
  mode: string;
  eligible: number;
  reason: string;
  result: string;
  budget_snapshot_json: string;
  trace_evidence_json: string | null;
  error_message: string | null;
  execution_context_json: string | null;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function agentWorkLogEntryId(entry: AgentWorkLogEntry): string {
  return `${entry.employeeId}:${entry.timestamp}:${entry.jobId}`;
}

function rowToEntry(row: AgentWorkLogRow): AgentWorkLogEntry {
  return {
    timestamp: row.timestamp,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    companyId: COMPANY_INTERNAL_AEP,
    teamId: row.department_id as AgentWorkLogEntry["teamId"],
    roleId: row.role_id as AgentWorkLogEntry["roleId"],
    policyVersion: row.policy_version,
    trigger: row.trigger as AgentWorkLogEntry["trigger"],
    runId: row.run_id,
    jobId: row.job_id,
    tenant: row.tenant ?? undefined,
    service: row.service ?? undefined,
    action: row.action as AgentWorkLogEntry["action"],
    mode: row.mode as AgentWorkLogEntry["mode"],
    eligible: row.eligible === 1,
    reason: row.reason as AgentWorkLogEntry["reason"],
    result: row.result as AgentWorkLogEntry["result"],
    budgetSnapshot: fromJson(row.budget_snapshot_json) ?? {
      actionsUsedThisScan: 0,
      actionsUsedThisHour: 0,
      tenantActionsUsedThisHour: 0,
    },
    traceEvidence: fromJson(row.trace_evidence_json) ?? undefined,
    errorMessage: row.error_message ?? undefined,
    executionContext: fromJson(row.execution_context_json) ?? undefined,
  };
}

export class D1AgentWorkLogStore implements IAgentWorkLogStore {
  private readonly db: D1Database;

  constructor(private readonly env: OperatorAgentEnv) {
    this.db = requireDb(env);
  }

  async write(entry: AgentWorkLogEntry): Promise<void> {
    const sql = `
      INSERT INTO agent_work_log (
        entry_id,
        timestamp,
        employee_id,
        employee_name,
        department_id,
        role_id,
        policy_version,
        trigger,
        run_id,
        job_id,
        tenant,
        service,
        action,
        mode,
        eligible,
        reason,
        result,
        budget_snapshot_json,
        trace_evidence_json,
        error_message,
        execution_context_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET
        timestamp = excluded.timestamp,
        employee_id = excluded.employee_id,
        employee_name = excluded.employee_name,
        department_id = excluded.department_id,
        role_id = excluded.role_id,
        policy_version = excluded.policy_version,
        trigger = excluded.trigger,
        run_id = excluded.run_id,
        job_id = excluded.job_id,
        tenant = excluded.tenant,
        service = excluded.service,
        action = excluded.action,
        mode = excluded.mode,
        eligible = excluded.eligible,
        reason = excluded.reason,
        result = excluded.result,
        budget_snapshot_json = excluded.budget_snapshot_json,
        trace_evidence_json = excluded.trace_evidence_json,
        error_message = excluded.error_message,
        execution_context_json = excluded.execution_context_json
    `;

    await this.db
      .prepare(sql)
      .bind(
        agentWorkLogEntryId(entry),
        entry.timestamp,
        entry.employeeId,
        entry.employeeName,
        entry.teamId,
        entry.roleId,
        entry.policyVersion,
        entry.trigger,
        entry.runId,
        entry.jobId,
        entry.tenant ?? null,
        entry.service ?? null,
        entry.action,
        entry.mode,
        entry.eligible ? 1 : 0,
        entry.reason,
        entry.result,
        toJson(entry.budgetSnapshot) ?? "{}",
        toJson(entry.traceEvidence),
        entry.errorMessage ?? null,
        toJson(entry.executionContext)
      )
      .run();
  }

  async listByEmployee(args: {
    employeeId: string;
    limit: number;
  }): Promise<AgentWorkLogEntry[]> {
    const rows = await this.db
      .prepare(
        `
          SELECT * FROM agent_work_log
          WHERE employee_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        `
      )
      .bind(args.employeeId, args.limit)
      .all<AgentWorkLogRow>();

    return (rows.results ?? []).map(rowToEntry);
  }
}