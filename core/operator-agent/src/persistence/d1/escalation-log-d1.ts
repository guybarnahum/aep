import { fromJson, toJson } from "./d1-json";
import type {
  EscalationRecord,
  EscalationState,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";
import type { IEscalationStore } from "@aep/operator-agent/lib/store-types";

type EscalationRow = {
  escalation_id: string;
  timestamp: string;
  company_id: string | null;
  department_id: string;
  manager_employee_id: string;
  manager_employee_name: string;
  policy_version: string;
  severity: string;
  state: string;
  reason: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  affected_employee_ids_json: string;
  message: string;
  recommendation: string;
  evidence_json: string | null;
  execution_context_json: string | null;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function normalizeEscalation(raw: Partial<EscalationRecord>): EscalationRecord {
  return {
    ...(raw as EscalationRecord),
    state: raw.state ?? "open",
  };
}

function rowToEscalation(row: EscalationRow): EscalationRecord {
  return normalizeEscalation({
    escalationId: row.escalation_id,
    timestamp: row.timestamp,
    companyId: row.company_id ?? undefined,
    teamId: row.department_id as EscalationRecord["teamId"],
    managerEmployeeId: row.manager_employee_id,
    managerEmployeeName: row.manager_employee_name,
    policyVersion: row.policy_version,
    severity: row.severity as EscalationRecord["severity"],
    state: row.state as EscalationState,
    reason: row.reason as EscalationRecord["reason"],
    acknowledgedAt: row.acknowledged_at ?? undefined,
    acknowledgedBy: row.acknowledged_by ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    resolutionNote: row.resolution_note ?? undefined,
    affectedEmployeeIds: fromJson<string[]>(row.affected_employee_ids_json) ?? [],
    message: row.message,
    recommendation: row.recommendation as EscalationRecord["recommendation"],
    evidence: fromJson(row.evidence_json) ?? {
      windowEntryCount: 0,
    },
    executionContext: (fromJson(row.execution_context_json) ?? undefined),
  });
}

function escalationToParams(record: EscalationRecord) {
  return [
    record.escalationId,
    record.timestamp,
    record.companyId ?? null,
    record.teamId,
    record.managerEmployeeId,
    record.managerEmployeeName,
    record.policyVersion,
    record.severity,
    record.state,
    record.reason,
    record.acknowledgedAt ?? null,
    record.acknowledgedBy ?? null,
    record.resolvedAt ?? null,
    record.resolvedBy ?? null,
    record.resolutionNote ?? null,
    toJson(record.affectedEmployeeIds) ?? "[]",
    record.message,
    record.recommendation,
    toJson(record.evidence),
    toJson(record.executionContext) ?? null,
  ] as const;
}

export class D1EscalationStore implements IEscalationStore {
  private readonly db: D1Database;

  constructor(private readonly env: OperatorAgentEnv) {
    this.db = requireDb(env);
  }

  async write(record: EscalationRecord): Promise<void> {
    await this.put(record);
  }

  async put(record: EscalationRecord): Promise<void> {
    const sql = `
      INSERT INTO escalations (
        escalation_id,
        timestamp,
        company_id,
        department_id,
        manager_employee_id,
        manager_employee_name,
        policy_version,
        severity,
        state,
        reason,
        acknowledged_at,
        acknowledged_by,
        resolved_at,
        resolved_by,
        resolution_note,
        affected_employee_ids_json,
        message,
        recommendation,
        evidence_json,
        execution_context_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(escalation_id) DO UPDATE SET
        timestamp = excluded.timestamp,
        company_id = excluded.company_id,
        department_id = excluded.department_id,
        manager_employee_id = excluded.manager_employee_id,
        manager_employee_name = excluded.manager_employee_name,
        policy_version = excluded.policy_version,
        severity = excluded.severity,
        state = excluded.state,
        reason = excluded.reason,
        acknowledged_at = excluded.acknowledged_at,
        acknowledged_by = excluded.acknowledged_by,
        resolved_at = excluded.resolved_at,
        resolved_by = excluded.resolved_by,
        resolution_note = excluded.resolution_note,
        affected_employee_ids_json = excluded.affected_employee_ids_json,
        message = excluded.message,
        recommendation = excluded.recommendation,
        evidence_json = excluded.evidence_json,
        execution_context_json = excluded.execution_context_json
    `;

    await this.db.prepare(sql).bind(...escalationToParams(record)).run();
  }

  async get(escalationId: string): Promise<EscalationRecord | null> {
    const row = await this.db
      .prepare(`SELECT * FROM escalations WHERE escalation_id = ?`)
      .bind(escalationId)
      .first<EscalationRow>();

    return row ? rowToEscalation(row) : null;
  }

  async list(limit: number, stateFilter?: EscalationState): Promise<EscalationRecord[]> {
    const sql = stateFilter
      ? `
        SELECT * FROM escalations
        WHERE state = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `
      : `
        SELECT * FROM escalations
        ORDER BY timestamp DESC
        LIMIT ?
      `;

    const rows = stateFilter
      ? await this.db.prepare(sql).bind(stateFilter, limit).all<EscalationRow>()
      : await this.db.prepare(sql).bind(limit).all<EscalationRow>();

    return (rows.results ?? []).map(rowToEscalation);
  }
}
