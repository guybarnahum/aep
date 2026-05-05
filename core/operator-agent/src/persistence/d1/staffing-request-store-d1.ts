import { newId } from "@aep/shared";
import type {
  StaffingRequestContract,
  StaffingRequestState,
  StaffingRequestUrgency,
  StaffingSource,
} from "@aep/operator-agent/hr/staffing-contracts";
import type { AgentRoleId, OperatorAgentEnv } from "@aep/operator-agent/types";

type StaffingRequestRow = {
  id: string;
  company_id: string;
  role_id: string;
  team_id: string;
  reason: string;
  urgency: StaffingRequestUrgency;
  source_kind: StaffingSource["kind"];
  source_id: string;
  requested_by_employee_id: string;
  approved_by_employee_id?: string | null;
  status: StaffingRequestState;
  approval_id?: string | null;
  thread_id?: string | null;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  fulfilled_at?: string | null;
  rejected_at?: string | null;
  canceled_at?: string | null;
  rejection_reason?: string | null;
  cancellation_reason?: string | null;
  fulfillment_message_id?: string | null;
  fulfilled_employee_id?: string | null;
  employee_spec?: string | null;
};

export type StaffingRequestFulfillmentLink = {
  staffingRequestId: string;
  employeeId?: string;
  messageId?: string;
};

export type CreateStaffingRequestInput = {
  companyId: string;
  roleId: StaffingRequestContract["roleId"];
  teamId: StaffingRequestContract["teamId"];
  reason: string;
  urgency: StaffingRequestUrgency;
  source: StaffingSource;
  requestedByEmployeeId: string;
  status?: "draft" | "submitted";
  threadId?: string;
  employeeSpec?: Record<string, unknown>;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) throw new Error("Missing OPERATOR_AGENT_DB binding");
  return env.OPERATOR_AGENT_DB;
}

function sourceId(source: StaffingSource): string {
  switch (source.kind) {
    case "task":
      return source.taskId;
    case "project":
      return source.projectId;
    case "thread":
      return source.threadId;
    case "role":
      return source.roleId;
    case "review":
      return source.reviewId;
    case "manager":
      return source.managerEmployeeId;
  }
}

function rowToContract(row: StaffingRequestRow): StaffingRequestContract {
  const source: StaffingSource =
    row.source_kind === "task"
      ? { kind: "task", taskId: row.source_id }
      : row.source_kind === "project"
        ? { kind: "project", projectId: row.source_id }
        : row.source_kind === "thread"
          ? { kind: "thread", threadId: row.source_id }
          : row.source_kind === "role"
            ? { kind: "role", roleId: row.source_id as AgentRoleId }
            : row.source_kind === "review"
              ? { kind: "review", reviewId: row.source_id }
              : { kind: "manager", managerEmployeeId: row.source_id };

  return {
    kind: "staffing_request",
    staffingRequestId: row.id,
    companyId: row.company_id as StaffingRequestContract["companyId"],
    roleId: row.role_id as StaffingRequestContract["roleId"],
    teamId: row.team_id as StaffingRequestContract["teamId"],
    reason: row.reason,
    urgency: row.urgency,
    requestedByEmployeeId: row.requested_by_employee_id,
    source,
    ownership: {
      canonicalOwner: "aep",
      owningTeamId: row.team_id as StaffingRequestContract["teamId"],
      requestedByEmployeeId: row.requested_by_employee_id,
      approvedByEmployeeId: row.approved_by_employee_id ?? undefined,
      directEmployeeMutationAllowed: false,
      parallelHrDatabaseAllowed: false,
    },
    state: row.status,
    approval: {
      approvalRequired: true,
      approvalSurface: "canonical_approval",
      directFulfillmentAllowed: false,
      employeeCreationRoute: "POST /agent/employees",
      lifecycleRouteRequired: true,
    },
    employeeSpec: row.employee_spec ? (JSON.parse(row.employee_spec) as Record<string, unknown>) : undefined,
  };
}

export async function createStaffingRequest(
  env: OperatorAgentEnv,
  input: CreateStaffingRequestInput,
): Promise<StaffingRequestContract> {
  const db = requireDb(env);
  const now = new Date().toISOString();
  const status = input.status ?? "draft";
  const id = newId("staffreq");

  await db
    .prepare(
      `INSERT INTO staffing_requests (
      id, company_id, role_id, team_id, reason, urgency,
      source_kind, source_id, requested_by_employee_id, status,
      thread_id, employee_spec, created_at, updated_at, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.companyId,
      input.roleId,
      input.teamId,
      input.reason,
      input.urgency,
      input.source.kind,
      sourceId(input.source),
      input.requestedByEmployeeId,
      status,
      input.threadId ?? null,
      input.employeeSpec != null ? JSON.stringify(input.employeeSpec) : null,
      now,
      now,
      status === "submitted" ? now : null,
    )
    .run();

  const created = await getStaffingRequest(env, id);
  if (!created) throw new Error(`Failed to create staffing request ${id}`);
  return created;
}

export async function listStaffingRequests(
  env: OperatorAgentEnv,
  filters?: {
    companyId?: string;
    teamId?: string;
    status?: StaffingRequestState;
    limit?: number;
  },
): Promise<StaffingRequestContract[]> {
  const db = requireDb(env);
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (filters?.companyId) {
    clauses.push("company_id = ?");
    bindings.push(filters.companyId);
  }

  if (filters?.teamId) {
    clauses.push("team_id = ?");
    bindings.push(filters.teamId);
  }

  if (filters?.status) {
    clauses.push("status = ?");
    bindings.push(filters.status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);

  const rows = await db
    .prepare(`SELECT * FROM staffing_requests ${where} ORDER BY updated_at DESC LIMIT ?`)
    .bind(...bindings, limit)
    .all<StaffingRequestRow>();

  return (rows.results ?? []).map(rowToContract);
}

export async function getStaffingRequest(
  env: OperatorAgentEnv,
  id: string,
): Promise<StaffingRequestContract | null> {
  const row = await requireDb(env)
    .prepare(`SELECT * FROM staffing_requests WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<StaffingRequestRow>();
  return row ? rowToContract(row) : null;
}

export async function linkStaffingRequestFulfillment(
  env: OperatorAgentEnv,
  args: {
    id: string;
    employeeId: string;
    messageId?: string;
  },
): Promise<StaffingRequestContract> {
  const existing = await getStaffingRequest(env, args.id);
  if (!existing) throw new Error(`Staffing request not found: ${args.id}`);
  if (existing.state !== "approved") {
    throw new Error(`Only approved staffing requests can be fulfilled; got ${existing.state}`);
  }

  const now = new Date().toISOString();
  await requireDb(env)
    .prepare(
      `UPDATE staffing_requests
       SET status = 'fulfilled',
           fulfilled_at = ?,
           updated_at = ?,
           fulfilled_employee_id = ?,
           fulfillment_message_id = COALESCE(?, fulfillment_message_id)
       WHERE id = ?`,
    )
    .bind(now, now, args.employeeId, args.messageId ?? null, args.id)
    .run();

  const updated = await getStaffingRequest(env, args.id);
  if (!updated) throw new Error(`Staffing request disappeared: ${args.id}`);
  return updated;
}

export async function updateStaffingRequestStatus(
  env: OperatorAgentEnv,
  args: {
    id: string;
    nextStatus: StaffingRequestState;
    approvedByEmployeeId?: string;
    approvalId?: string;
    reason?: string;
  },
): Promise<StaffingRequestContract> {
  const existing = await getStaffingRequest(env, args.id);
  if (!existing) throw new Error(`Staffing request not found: ${args.id}`);

  const allowed: Record<StaffingRequestState, StaffingRequestState[]> = {
    draft: ["submitted", "canceled"],
    submitted: ["approved", "rejected", "canceled"],
    approved: ["fulfilled", "canceled"],
    fulfilled: [],
    rejected: [],
    canceled: [],
  };

  if (!allowed[existing.state].includes(args.nextStatus)) {
    throw new Error(`Invalid staffing request transition ${existing.state} -> ${args.nextStatus}`);
  }

  const now = new Date().toISOString();
  await requireDb(env)
    .prepare(
      `UPDATE staffing_requests
     SET status = ?,
         updated_at = ?,
         submitted_at = CASE WHEN ? = 'submitted' THEN ? ELSE submitted_at END,
         approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END,
         fulfilled_at = CASE WHEN ? = 'fulfilled' THEN ? ELSE fulfilled_at END,
         rejected_at = CASE WHEN ? = 'rejected' THEN ? ELSE rejected_at END,
         canceled_at = CASE WHEN ? = 'canceled' THEN ? ELSE canceled_at END,
         approved_by_employee_id = COALESCE(?, approved_by_employee_id),
         approval_id = COALESCE(?, approval_id),
         rejection_reason = CASE WHEN ? = 'rejected' THEN ? ELSE rejection_reason END,
         cancellation_reason = CASE WHEN ? = 'canceled' THEN ? ELSE cancellation_reason END
     WHERE id = ?`,
    )
    .bind(
      args.nextStatus,
      now,
      args.nextStatus,
      now,
      args.nextStatus,
      now,
      args.nextStatus,
      now,
      args.nextStatus,
      now,
      args.nextStatus,
      now,
      args.approvedByEmployeeId ?? null,
      args.approvalId ?? null,
      args.nextStatus,
      args.reason ?? null,
      args.nextStatus,
      args.reason ?? null,
      args.id,
    )
    .run();

  const updated = await getStaffingRequest(env, args.id);
  if (!updated) throw new Error(`Staffing request disappeared: ${args.id}`);
  return updated;
}
