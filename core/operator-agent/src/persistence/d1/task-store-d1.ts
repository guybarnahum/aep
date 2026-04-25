import { fromJson, toJson } from "./d1-json";
import { dispatchMessageMirrors } from "@aep/operator-agent/adapters/mirror-dispatcher";
import type {
  ExternalMessageProjection,
  ExternalThreadProjection,
  MirrorChannel,
  MirrorDeliveryRecord,
} from "@aep/operator-agent/adapters/types";
import {
  type IntakeListQuery,
  type IntakeRequest,
  type IntakeStatusUpdate,
  type Project,
  type ProjectListQuery,
  type ExternalInteractionAuditRecord,
  type TaskCreateInput,
  TaskDependencyValidationError,
  type ThreadExternalInteractionPolicy,
  type Decision,
  type EmployeeMessage,
  type MessageThread,
  type MessageListQuery,
  type ThreadListQuery,
  type Task,
  type TaskArtifact,
  type TaskArtifactListQuery,
  type TaskDependency,
  type TaskListQuery,
  type TaskStatus,
  type TaskStore,
} from "@aep/operator-agent/lib/store-types";
import {
  normalizeTaskType,
  validateTaskPayloadContract,
} from "@aep/operator-agent/lib/task-contracts";
import { newId } from "@aep/shared";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type TaskRow = {
  id: string;
  company_id: string;
  originating_team_id: string | null;
  assigned_team_id: string | null;
  owner_employee_id: string | null;
  assigned_employee_id: string | null;
  created_by_employee_id: string | null;
  task_type: string;
  title: string | null;
  status: string;
  payload: string | null;
  blocking_dependency_count: number | null;
  source_thread_id: string | null;
  source_message_id: string | null;
  source_approval_id: string | null;
  source_escalation_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;

  // Legacy compatibility columns may still exist in older local/staging DBs.
  team_id?: string | null;
  employee_id?: string | null;
};

type TaskDependencyRow = {
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  created_at: string | null;
};

type TaskArtifactRow = {
  id: string;
  task_id: string;
  company_id: string;
  artifact_type: string;
  created_by_employee_id: string | null;
  summary: string | null;
  content_json: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MessageThreadRow = {
  thread_id: string;
  company_id: string;
  topic: string;
  created_by_employee_id: string | null;
  related_task_id: string | null;
  related_artifact_id: string | null;
  related_approval_id: string | null;
  related_escalation_id: string | null;
  visibility: string;
  created_at: string | null;
  updated_at: string | null;
};

type DependencyTaskRow = {
  id: string;
  company_id: string;
};

type EmployeeMessageRow = {
  message_id: string;
  thread_id: string | null;
  company_id: string;
  sender_employee_id: string;
  receiver_employee_id: string | null;
  receiver_team_id: string | null;
  message_type: string;
  status: string;
  source: string | null;
  subject: string | null;
  body: string | null;
  payload_json: string | null;
  external_message_id: string | null;
  external_channel: string | null;
  external_author_id: string | null;
  external_received_at: string | null;
  requires_response: number | null;
  response_action_type: string | null;
  response_action_status: string | null;
  caused_state_transition: number | null;
  related_task_id: string | null;
  related_artifact_id: string | null;
  related_escalation_id: string | null;
  related_approval_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MessageMirrorDeliveryRow = {
  delivery_id: string;
  message_id: string;
  thread_id: string;
  channel: string;
  target: string;
  status: string;
  external_message_id: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string;
};

type ExternalThreadProjectionRow = {
  projection_id: string;
  thread_id: string;
  channel: string;
  target: string;
  external_thread_id: string;
  created_at: string;
  updated_at: string;
};

type ExternalMessageProjectionRow = {
  projection_id: string;
  message_id: string;
  thread_id: string;
  channel: string;
  target: string;
  external_thread_id: string;
  external_message_id: string;
  created_at: string;
};

type ExternalActionRecordRow = {
  id: string;
  external_action_id: string;
  external_channel: string;
  thread_id: string;
  action_type: string;
  created_at: string;
};

type ThreadExternalInteractionPolicyRow = {
  thread_id: string;
  inbound_replies_allowed: number;
  external_actions_allowed: number;
  allowed_channels_json: string | null;
  allowed_targets_json: string | null;
  allowed_external_actors_json: string | null;
  created_at: string;
  updated_at: string;
};

type ExternalInteractionAuditRow = {
  audit_id: string;
  thread_id: string | null;
  channel: string;
  interaction_kind: string;
  external_actor_id: string | null;
  external_message_id: string | null;
  external_action_id: string | null;
  decision: string;
  reason_code: string;
  created_at: string;
};

type IntakeRequestRow = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  requested_by: string;
  source: string;
  status: string;
  created_at: string;
};

type ProjectRow = {
  id: string;
  company_id: string;
  intake_request_id: string | null;
  title: string;
  description: string | null;
  owner_team_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function rowToTask(row: TaskRow): Task {
  const canonicalTaskType = normalizeTaskType(row.task_type);

  return {
    id: row.id,
    companyId: row.company_id,
    originatingTeamId: row.originating_team_id ?? row.team_id ?? "",
    assignedTeamId: row.assigned_team_id ?? row.team_id ?? "",
    ownerEmployeeId: row.owner_employee_id ?? undefined,
    assignedEmployeeId: row.assigned_employee_id ?? row.employee_id ?? undefined,
    createdByEmployeeId: row.created_by_employee_id ?? undefined,
    taskType: canonicalTaskType,
    title: row.title ?? row.task_type,
    status: row.status as TaskStatus,
    payload: fromJson<Record<string, unknown>>(row.payload) ?? {},
    blockingDependencyCount: row.blocking_dependency_count ?? 0,
    sourceThreadId: row.source_thread_id ?? undefined,
    sourceMessageId: row.source_message_id ?? undefined,
    sourceApprovalId: row.source_approval_id ?? undefined,
    sourceEscalationId: row.source_escalation_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    failedAt: row.failed_at ?? undefined,
  };
}

function rowToDependency(row: TaskDependencyRow): TaskDependency {
  return {
    taskId: row.task_id,
    dependsOnTaskId: row.depends_on_task_id,
    dependencyType: "completion",
    createdAt: row.created_at ?? undefined,
  };
}

function rowToArtifact(row: TaskArtifactRow): TaskArtifact {
  return {
    id: row.id,
    taskId: row.task_id,
    companyId: row.company_id,
    artifactType: row.artifact_type as TaskArtifact["artifactType"],
    createdByEmployeeId: row.created_by_employee_id ?? undefined,
    summary: row.summary ?? undefined,
    content: fromJson<Record<string, unknown>>(row.content_json) ?? {},
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function rowToMessageThread(row: MessageThreadRow): MessageThread {
  return {
    id: row.thread_id,
    companyId: row.company_id,
    topic: row.topic,
    createdByEmployeeId: row.created_by_employee_id ?? undefined,
    relatedTaskId: row.related_task_id ?? undefined,
    relatedArtifactId: row.related_artifact_id ?? undefined,
    relatedApprovalId: row.related_approval_id ?? undefined,
    relatedEscalationId: row.related_escalation_id ?? undefined,
    visibility: row.visibility as MessageThread["visibility"],
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function rowToMessage(row: EmployeeMessageRow): EmployeeMessage {
  return {
    id: row.message_id,
    threadId: row.thread_id ?? "",
    companyId: row.company_id,
    senderEmployeeId: row.sender_employee_id,
    receiverEmployeeId: row.receiver_employee_id ?? undefined,
    receiverTeamId: row.receiver_team_id ?? undefined,
    type: row.message_type as EmployeeMessage["type"],
    status: row.status as EmployeeMessage["status"],
    source: (row.source ?? "internal") as EmployeeMessage["source"],
    subject: row.subject ?? undefined,
    body: row.body ?? "",
    payload: fromJson<Record<string, unknown>>(row.payload_json) ?? {},
    externalMessageId: row.external_message_id ?? undefined,
    externalChannel: (row.external_channel as EmployeeMessage["externalChannel"]) ?? undefined,
    externalAuthorId: row.external_author_id ?? undefined,
    externalReceivedAt: row.external_received_at ?? undefined,
    requiresResponse: Number(row.requires_response ?? 0) === 1,
    responseActionType: row.response_action_type ?? undefined,
    responseActionStatus:
      (row.response_action_status as EmployeeMessage["responseActionStatus"]) ?? undefined,
    causedStateTransition: Number(row.caused_state_transition ?? 0) === 1,
    relatedTaskId: row.related_task_id ?? undefined,
    relatedArtifactId: row.related_artifact_id ?? undefined,
    relatedEscalationId: row.related_escalation_id ?? undefined,
    relatedApprovalId: row.related_approval_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function rowToMirrorDelivery(row: MessageMirrorDeliveryRow): MirrorDeliveryRecord {
  return {
    id: row.delivery_id,
    messageId: row.message_id,
    threadId: row.thread_id,
    channel: row.channel as MirrorDeliveryRecord["channel"],
    target: row.target,
    status: row.status as MirrorDeliveryRecord["status"],
    externalMessageId: row.external_message_id ?? undefined,
    failureCode: row.failure_code ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    createdAt: row.created_at,
  };
}

function rowToExternalThreadProjection(
  row: ExternalThreadProjectionRow,
): ExternalThreadProjection {
  return {
    id: row.projection_id,
    threadId: row.thread_id,
    channel: row.channel as MirrorChannel,
    target: row.target,
    externalThreadId: row.external_thread_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToExternalMessageProjection(
  row: ExternalMessageProjectionRow,
): ExternalMessageProjection {
  return {
    id: row.projection_id,
    messageId: row.message_id,
    threadId: row.thread_id,
    channel: row.channel as MirrorChannel,
    target: row.target,
    externalThreadId: row.external_thread_id,
    externalMessageId: row.external_message_id,
    createdAt: row.created_at,
  };
}

function rowToThreadExternalInteractionPolicy(
  row: ThreadExternalInteractionPolicyRow,
): ThreadExternalInteractionPolicy {
  return {
    threadId: row.thread_id,
    inboundRepliesAllowed: Number(row.inbound_replies_allowed) === 1,
    externalActionsAllowed: Number(row.external_actions_allowed) === 1,
    allowedChannels:
      fromJson<Array<"slack" | "email">>(row.allowed_channels_json) ?? undefined,
    allowedTargets: fromJson<string[]>(row.allowed_targets_json) ?? undefined,
    allowedExternalActors:
      fromJson<string[]>(row.allowed_external_actors_json) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToExternalInteractionAuditRecord(
  row: ExternalInteractionAuditRow,
): ExternalInteractionAuditRecord {
  return {
    id: row.audit_id,
    threadId: row.thread_id ?? undefined,
    channel: row.channel as ExternalInteractionAuditRecord["channel"],
    interactionKind: row.interaction_kind as ExternalInteractionAuditRecord["interactionKind"],
    externalActorId: row.external_actor_id ?? undefined,
    externalMessageId: row.external_message_id ?? undefined,
    externalActionId: row.external_action_id ?? undefined,
    decision: row.decision as ExternalInteractionAuditRecord["decision"],
    reasonCode: row.reason_code,
    createdAt: row.created_at,
  };
}

function rowToIntakeRequest(row: IntakeRequestRow): IntakeRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    description: row.description,
    requestedBy: row.requested_by,
    source: row.source,
    status: row.status as IntakeRequest["status"],
    createdAt: row.created_at,
  };
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    companyId: row.company_id,
    intakeRequestId: row.intake_request_id,
    title: row.title,
    description: row.description,
    ownerTeamId: row.owner_team_id,
    status: row.status as Project["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
  };
}

export class D1TaskStore implements TaskStore {
  private readonly db: D1Database;

  constructor(private readonly env: OperatorAgentEnv) {
    this.db = requireDb(env);
  }

  private normalizeDependencyIds(dependsOnTaskIds: string[]): string[] {
    return dependsOnTaskIds
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  private assertNoDuplicateDependencies(dependsOnTaskIds: string[]): void {
    const seen = new Set<string>();

    for (const dependencyId of dependsOnTaskIds) {
      if (seen.has(dependencyId)) {
        throw new TaskDependencyValidationError(
          "duplicate_dependency",
          `Duplicate dependency task ID: ${dependencyId}`,
          { dependencyTaskId: dependencyId },
        );
      }
      seen.add(dependencyId);
    }
  }

  private assertNoSelfDependency(taskId: string, dependsOnTaskIds: string[]): void {
    if (dependsOnTaskIds.includes(taskId)) {
      throw new TaskDependencyValidationError(
        "self_dependency",
        `Task ${taskId} cannot depend on itself`,
        { taskId },
      );
    }
  }

  private async loadDependencyTasks(
    dependencyIds: string[],
  ): Promise<Map<string, DependencyTaskRow>> {
    if (dependencyIds.length === 0) {
      return new Map();
    }

    const placeholders = dependencyIds.map(() => "?").join(", ");
    const rows = await this.db
      .prepare(
        `SELECT id, company_id
         FROM tasks
         WHERE id IN (${placeholders})`,
      )
      .bind(...dependencyIds)
      .all<DependencyTaskRow>();

    const map = new Map<string, DependencyTaskRow>();
    for (const row of rows.results ?? []) {
      map.set(row.id, row);
    }
    return map;
  }

  private assertDependenciesExistAndMatchCompany(args: {
    companyId: string;
    dependencyIds: string[];
    dependencyTaskMap: Map<string, DependencyTaskRow>;
  }): void {
    const missingIds = args.dependencyIds.filter(
      (id) => !args.dependencyTaskMap.has(id),
    );

    if (missingIds.length > 0) {
      throw new TaskDependencyValidationError(
        "dependency_not_found",
        `Dependency task(s) not found: ${missingIds.join(", ")}`,
        { missingDependencyTaskIds: missingIds },
      );
    }

    const crossCompanyIds = args.dependencyIds.filter((id) => {
      const task = args.dependencyTaskMap.get(id);
      return task?.company_id !== args.companyId;
    });

    if (crossCompanyIds.length > 0) {
      throw new TaskDependencyValidationError(
        "cross_company_dependency",
        `Dependency task(s) belong to a different company: ${crossCompanyIds.join(", ")}`,
        { crossCompanyDependencyTaskIds: crossCompanyIds },
      );
    }
  }

  private async assertNoDependencyCycles(args: {
    taskId: string;
    dependencyIds: string[];
  }): Promise<void> {
    for (const dependencyId of args.dependencyIds) {
      const stack: string[] = [dependencyId];
      const visited = new Set<string>();

      while (stack.length > 0) {
        const currentTaskId = stack.pop();
        if (!currentTaskId) continue;

        if (currentTaskId === args.taskId) {
          throw new TaskDependencyValidationError(
            "dependency_cycle",
            `Dependency cycle detected for task ${args.taskId}`,
            {
              taskId: args.taskId,
              dependencyTaskId: dependencyId,
            },
          );
        }

        if (visited.has(currentTaskId)) {
          continue;
        }
        visited.add(currentTaskId);

        const rows = await this.db
          .prepare(
            `SELECT depends_on_task_id
             FROM task_dependencies
             WHERE task_id = ?`,
          )
          .bind(currentTaskId)
          .all<{ depends_on_task_id: string }>();

        for (const row of rows.results ?? []) {
          if (!visited.has(row.depends_on_task_id)) {
            stack.push(row.depends_on_task_id);
          }
        }
      }
    }
  }

  private async validateDependencies(args: {
    taskId: string;
    companyId: string;
    dependsOnTaskIds: string[];
  }): Promise<string[]> {
    const dependencyIds = this.normalizeDependencyIds(args.dependsOnTaskIds);

    this.assertNoSelfDependency(args.taskId, dependencyIds);
    this.assertNoDuplicateDependencies(dependencyIds);

    const dependencyTaskMap = await this.loadDependencyTasks(dependencyIds);

    this.assertDependenciesExistAndMatchCompany({
      companyId: args.companyId,
      dependencyIds,
      dependencyTaskMap,
    });

    await this.assertNoDependencyCycles({
      taskId: args.taskId,
      dependencyIds,
    });

    return dependencyIds;
  }

  private async assertTaskExists(taskId: string): Promise<void> {
    const row = await this.db
      .prepare(`SELECT id FROM tasks WHERE id = ? LIMIT 1`)
      .bind(taskId)
      .first<{ id: string }>();

    if (!row?.id) {
      throw new Error(`Task not found: ${taskId}`);
    }
  }

  async createTask(task: TaskCreateInput): Promise<void> {
    await this.createTaskWithDependencies({ task, dependsOnTaskIds: [] });
  }

  async createTaskWithDependencies(args: {
    task: TaskCreateInput;
    dependsOnTaskIds?: string[];
  }): Promise<void> {
    const canonicalTaskType = validateTaskPayloadContract({
      taskType: args.task.taskType,
      payload: args.task.payload,
    });

    const dependsOnTaskIds = await this.validateDependencies({
      taskId: args.task.id,
      companyId: args.task.companyId,
      dependsOnTaskIds: args.dependsOnTaskIds ?? [],
    });
    const initialStatus: TaskStatus = dependsOnTaskIds.length > 0 ? "blocked" : "ready";

    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO tasks (
            id,
            company_id,
            originating_team_id,
            assigned_team_id,
            owner_employee_id,
            assigned_employee_id,
            created_by_employee_id,
            team_id,
            employee_id,
            task_type,
            title,
            status,
            payload,
            blocking_dependency_count,
            source_thread_id,
            source_message_id,
            source_approval_id,
            source_escalation_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          args.task.id,
          args.task.companyId,
          args.task.originatingTeamId,
          args.task.assignedTeamId,
          args.task.ownerEmployeeId ?? null,
          args.task.assignedEmployeeId ?? null,
          args.task.createdByEmployeeId ?? null,
          args.task.assignedTeamId,
          args.task.assignedEmployeeId ?? null,
          canonicalTaskType,
          args.task.title,
          initialStatus,
          toJson(args.task.payload),
          dependsOnTaskIds.length,
          args.task.sourceThreadId ?? null,
          args.task.sourceMessageId ?? null,
          args.task.sourceApprovalId ?? null,
          args.task.sourceEscalationId ?? null,
        ),
    ];

    for (const dependsOnTaskId of dependsOnTaskIds) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO task_dependencies (
              task_id,
              depends_on_task_id,
              dependency_type
            ) VALUES (?, ?, 'completion')`,
          )
          .bind(args.task.id, dependsOnTaskId),
      );
    }

    await this.db.batch(statements);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const row = await this.db
      .prepare(`SELECT * FROM tasks WHERE id = ? LIMIT 1`)
      .bind(taskId)
      .first<TaskRow>();

    return row ? rowToTask(row) : null;
  }

  async listTasks(query: TaskListQuery): Promise<Task[]> {
    const clauses: string[] = [];
    const binds: Array<string | number> = [];

    if (query.companyId) {
      clauses.push(`company_id = ?`);
      binds.push(query.companyId);
    }
    if (query.assignedTeamId) {
      clauses.push(`assigned_team_id = ?`);
      binds.push(query.assignedTeamId);
    }
    if (query.assignedEmployeeId) {
      clauses.push(`assigned_employee_id = ?`);
      binds.push(query.assignedEmployeeId);
    }
    if (query.status) {
      clauses.push(`status = ?`);
      binds.push(query.status);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await this.db
      .prepare(
        `SELECT * FROM tasks
         ${where}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(...binds, query.limit)
      .all<TaskRow>();

    return (rows.results ?? []).map(rowToTask);
  }

  async listDependencies(taskId: string): Promise<TaskDependency[]> {
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM task_dependencies
         WHERE task_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(taskId)
      .all<TaskDependencyRow>();

    return (rows.results ?? []).map(rowToDependency);
  }

  async getPendingTasksForEmployee(employeeId: string, teamId: string): Promise<Task[]> {
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM tasks
         WHERE (assigned_employee_id = ? OR (assigned_employee_id IS NULL AND assigned_team_id = ?))
           AND status IN ('queued', 'ready')
         ORDER BY created_at ASC`,
      )
      .bind(employeeId, teamId)
      .all<TaskRow>();

    return (rows.results ?? []).map(rowToTask);
  }

  async getPendingTasksForTeam(args: {
    teamId: string;
    limit: number;
  }): Promise<Task[]> {
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM tasks
         WHERE assigned_team_id = ?
           AND status IN ('queued', 'ready')
         ORDER BY created_at ASC
         LIMIT ?`,
      )
      .bind(args.teamId, args.limit)
      .all<TaskRow>();

    return (rows.results ?? []).map(rowToTask);
  }

  async createIntakeRequest(args: IntakeRequest): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO intake_requests (
          id, company_id, title, description,
          requested_by, source, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        args.id,
        args.companyId,
        args.title,
        args.description ?? null,
        args.requestedBy,
        args.source,
        args.status,
        args.createdAt,
      )
      .run();
  }

  async getIntakeRequest(id: string): Promise<IntakeRequest | null> {
    const row = await this.db
      .prepare(`SELECT * FROM intake_requests WHERE id = ?`)
      .bind(id)
      .first<IntakeRequestRow>();

    if (!row) {
      return null;
    }

    return rowToIntakeRequest(row);
  }

  async listIntakeRequests(query: IntakeListQuery): Promise<IntakeRequest[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM intake_requests
         WHERE (? IS NULL OR company_id = ?)
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(
        query.companyId ?? null,
        query.companyId ?? null,
        query.limit ?? 50,
      )
      .all<IntakeRequestRow>();

    return (rows.results ?? []).map(rowToIntakeRequest);
  }

  async updateIntakeRequestStatus(args: IntakeStatusUpdate): Promise<void> {
    await this.db
      .prepare(`UPDATE intake_requests SET status = ? WHERE id = ?`)
      .bind(args.status, args.id)
      .run();
  }

  async createProject(args: Project): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO projects (
          id,
          company_id,
          intake_request_id,
          title,
          description,
          owner_team_id,
          status,
          created_at,
          updated_at,
          completed_at,
          archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        args.id,
        args.companyId,
        args.intakeRequestId ?? null,
        args.title,
        args.description ?? null,
        args.ownerTeamId,
        args.status,
        args.createdAt,
        args.updatedAt,
        args.completedAt ?? null,
        args.archivedAt ?? null,
      )
      .run();
  }

  async getProject(id: string): Promise<Project | null> {
    const row = await this.db
      .prepare(`SELECT * FROM projects WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<ProjectRow>();

    return row ? rowToProject(row) : null;
  }

  async listProjects(query: ProjectListQuery): Promise<Project[]> {
    const clauses: string[] = [];
    const binds: Array<string | number> = [];

    if (query.companyId) {
      clauses.push("company_id = ?");
      binds.push(query.companyId);
    }

    if (query.ownerTeamId) {
      clauses.push("owner_team_id = ?");
      binds.push(query.ownerTeamId);
    }

    if (query.status) {
      clauses.push("status = ?");
      binds.push(query.status);
    }

    if (query.intakeRequestId) {
      clauses.push("intake_request_id = ?");
      binds.push(query.intakeRequestId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM projects
         ${where}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(...binds, query.limit ?? 50)
      .all<ProjectRow>();

    return (rows.results ?? []).map(rowToProject);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    const startedAtExpr =
      status === "in_progress" ? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : "started_at";
    const completedAtExpr =
      status === "completed" ? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : "completed_at";
    const failedAtExpr =
      status === "failed" ? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : "failed_at";

    await this.db
      .prepare(
        `UPDATE tasks
         SET status = ?,
             started_at = ${startedAtExpr},
             completed_at = ${completedAtExpr},
             failed_at = ${failedAtExpr},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(status, taskId)
      .run();

    if (status === "completed") {
      await this.releaseCompletedDependency(taskId);
    }
  }

  private async releaseCompletedDependency(completedTaskId: string): Promise<void> {
    const dependents = await this.db
      .prepare(
        `SELECT task_id
         FROM task_dependencies
         WHERE depends_on_task_id = ?`,
      )
      .bind(completedTaskId)
      .all<{ task_id: string }>();

    for (const row of dependents.results ?? []) {
      const remaining = await this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM task_dependencies td
           JOIN tasks t ON t.id = td.depends_on_task_id
           WHERE td.task_id = ?
             AND t.status != 'completed'`,
        )
        .bind(row.task_id)
        .first<{ count: number }>();

      const remainingCount = Number(remaining?.count ?? 0);

      await this.db
        .prepare(
          `UPDATE tasks
           SET blocking_dependency_count = ?,
               status = CASE WHEN ? = 0 AND status = 'blocked' THEN 'ready' ELSE status END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(remainingCount, remainingCount, row.task_id)
        .run();
    }
  }

  async recordDecision(decision: Decision): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO decisions (
            id,
            task_id,
            employee_id,
            verdict,
            reasoning,
            internal_monologue,
            evidence_trace_id,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        )
        .bind(
          decision.id,
          decision.taskId,
          decision.employeeId,
          decision.verdict,
          decision.reasoning,
          decision.internalMonologue ?? null,
          decision.evidenceTraceId ?? null,
          decision.createdAt ?? null,
        ),
      this.db
        .prepare(
          `UPDATE tasks
           SET status = 'completed',
               completed_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(decision.taskId),
    ]);

    await this.releaseCompletedDependency(decision.taskId);
  }

  async createArtifact(
    artifact: Omit<TaskArtifact, "createdAt" | "updatedAt">,
  ): Promise<void> {
    await this.assertTaskExists(artifact.taskId);

    await this.db
      .prepare(
        `INSERT INTO task_artifacts (
          id,
          task_id,
          company_id,
          artifact_type,
          created_by_employee_id,
          summary,
          content_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        artifact.id,
        artifact.taskId,
        artifact.companyId,
        artifact.artifactType,
        artifact.createdByEmployeeId ?? null,
        artifact.summary ?? null,
        toJson(artifact.content),
      )
      .run();
  }

  async listArtifacts(query: TaskArtifactListQuery): Promise<TaskArtifact[]> {
    const clauses: string[] = [`task_id = ?`];
    const binds: Array<string | number> = [query.taskId];

    if (query.artifactType) {
      clauses.push(`artifact_type = ?`);
      binds.push(query.artifactType);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM task_artifacts
         ${where}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(...binds, query.limit)
      .all<TaskArtifactRow>();

    return (rows.results ?? []).map(rowToArtifact);
  }

  async createMessageThread(
    thread: Omit<MessageThread, "createdAt" | "updatedAt">,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO message_threads (
          thread_id,
          company_id,
          topic,
          created_by_employee_id,
          related_task_id,
          related_artifact_id,
          related_approval_id,
          related_escalation_id,
          visibility
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        thread.id,
        thread.companyId,
        thread.topic,
        thread.createdByEmployeeId ?? null,
        thread.relatedTaskId ?? null,
        thread.relatedArtifactId ?? null,
        thread.relatedApprovalId ?? null,
        thread.relatedEscalationId ?? null,
        thread.visibility,
      )
      .run();
  }

  async listMessageThreads(query: ThreadListQuery): Promise<MessageThread[]> {
    const clauses: string[] = [];
    const binds: Array<string | number> = [];

    if (query.companyId) {
      clauses.push(`company_id = ?`);
      binds.push(query.companyId);
    }
    if (query.createdByEmployeeId) {
      clauses.push(`created_by_employee_id = ?`);
      binds.push(query.createdByEmployeeId);
    }
    if (query.relatedTaskId) {
      clauses.push(`related_task_id = ?`);
      binds.push(query.relatedTaskId);
    }
    if (query.relatedArtifactId) {
      clauses.push(`related_artifact_id = ?`);
      binds.push(query.relatedArtifactId);
    }
    if (query.relatedApprovalId) {
      clauses.push(`related_approval_id = ?`);
      binds.push(query.relatedApprovalId);
    }
    if (query.relatedEscalationId) {
      clauses.push(`related_escalation_id = ?`);
      binds.push(query.relatedEscalationId);
    }
    if (query.participantEmployeeId) {
      clauses.push(
        `thread_id IN (
          SELECT DISTINCT thread_id
          FROM employee_messages
          WHERE sender_employee_id = ? OR receiver_employee_id = ?
        )`,
      );
      binds.push(query.participantEmployeeId, query.participantEmployeeId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM message_threads
         ${where}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(...binds, query.limit)
      .all<MessageThreadRow>();

    return (rows.results ?? []).map(rowToMessageThread);
  }

  async getMessageThread(threadId: string): Promise<MessageThread | null> {
    const row = await this.db
      .prepare(`SELECT * FROM message_threads WHERE thread_id = ? LIMIT 1`)
      .bind(threadId)
      .first<MessageThreadRow>();

    return row ? rowToMessageThread(row) : null;
  }

  async getMessage(messageId: string): Promise<EmployeeMessage | null> {
    const row = await this.db
      .prepare(`SELECT * FROM employee_messages WHERE message_id = ? LIMIT 1`)
      .bind(messageId)
      .first<EmployeeMessageRow>();

    return row ? rowToMessage(row) : null;
  }

  async createMessageMirrorDelivery(delivery: MirrorDeliveryRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO message_mirror_deliveries (
          delivery_id,
          message_id,
          thread_id,
          channel,
          target,
          status,
          external_message_id,
          failure_code,
          failure_reason,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        delivery.id,
        delivery.messageId,
        delivery.threadId,
        delivery.channel,
        delivery.target,
        delivery.status,
        delivery.externalMessageId ?? null,
        delivery.failureCode ?? null,
        delivery.failureReason ?? null,
        delivery.createdAt,
      )
      .run();
  }

  async listMessageMirrorDeliveries(messageId: string): Promise<MirrorDeliveryRecord[]> {
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM message_mirror_deliveries
         WHERE message_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(messageId)
      .all<MessageMirrorDeliveryRow>();

    return (rows.results ?? []).map(rowToMirrorDelivery);
  }

  async createExternalThreadProjection(projection: ExternalThreadProjection): Promise<void> {
    const existing = await this.getExternalThreadProjection({
      threadId: projection.threadId,
      channel: projection.channel,
      target: projection.target,
    });

    if (existing) {
      return;
    }

    try {
      await this.db
        .prepare(
          `INSERT INTO external_thread_projections (
            projection_id,
            thread_id,
            channel,
            target,
            external_thread_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          projection.id,
          projection.threadId,
          projection.channel,
          projection.target,
          projection.externalThreadId,
          projection.createdAt,
          projection.updatedAt,
        )
        .run();
    } catch {
      const current = await this.getExternalThreadProjection({
        threadId: projection.threadId,
        channel: projection.channel,
        target: projection.target,
      });

      if (!current) {
        throw new Error(`Failed to create external thread projection for ${projection.threadId}`);
      }
    }
  }

  async getExternalThreadProjection(args: {
    threadId: string;
    channel: MirrorChannel;
    target: string;
  }): Promise<ExternalThreadProjection | null> {
    const row = await this.db
      .prepare(
        `SELECT *
         FROM external_thread_projections
         WHERE thread_id = ?
           AND channel = ?
           AND target = ?
         LIMIT 1`,
      )
      .bind(args.threadId, args.channel, args.target)
      .first<ExternalThreadProjectionRow>();

    return row ? rowToExternalThreadProjection(row) : null;
  }

  async listExternalThreadProjections(threadId: string): Promise<ExternalThreadProjection[]> {
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM external_thread_projections
         WHERE thread_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(threadId)
      .all<ExternalThreadProjectionRow>();

    return (rows.results ?? []).map(rowToExternalThreadProjection);
  }

  async listExternalThreadProjectionsByExternal(input: {
    channel: MirrorChannel;
    externalThreadId: string;
    target?: string;
  }): Promise<ExternalThreadProjection[]> {
    const clauses = ["channel = ?", "external_thread_id = ?"];
    const binds: Array<string> = [input.channel, input.externalThreadId];

    if (input.target) {
      clauses.push("target = ?");
      binds.push(input.target);
    }

    const rows = await this.db
      .prepare(
        `SELECT *
         FROM external_thread_projections
         WHERE ${clauses.join(" AND ")}
         ORDER BY created_at ASC`,
      )
      .bind(...binds)
      .all<ExternalThreadProjectionRow>();

    return (rows.results ?? []).map(rowToExternalThreadProjection);
  }

  async findThreadByExternalThreadId(input: {
    externalThreadId: string;
    source: "slack" | "email";
  }): Promise<MessageThread | null> {
    const row = await this.db
      .prepare(
        `SELECT thread_id
         FROM external_thread_projections
         WHERE external_thread_id = ?
           AND channel = ?
         LIMIT 1`,
      )
      .bind(input.externalThreadId, input.source)
      .first<{ thread_id: string }>();

    if (!row?.thread_id) {
      return null;
    }

    return this.getMessageThread(row.thread_id);
  }

  async getThreadExternalInteractionPolicy(
    threadId: string,
  ): Promise<ThreadExternalInteractionPolicy | null> {
    const row = await this.db
      .prepare(
        `SELECT *
         FROM thread_external_interaction_policy
         WHERE thread_id = ?
         LIMIT 1`,
      )
      .bind(threadId)
      .first<ThreadExternalInteractionPolicyRow>();

    return row ? rowToThreadExternalInteractionPolicy(row) : null;
  }

  async upsertThreadExternalInteractionPolicy(
    policy: ThreadExternalInteractionPolicy,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO thread_external_interaction_policy (
          thread_id,
          inbound_replies_allowed,
          external_actions_allowed,
          allowed_channels_json,
          allowed_targets_json,
          allowed_external_actors_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(thread_id) DO UPDATE SET
          inbound_replies_allowed = excluded.inbound_replies_allowed,
          external_actions_allowed = excluded.external_actions_allowed,
          allowed_channels_json = excluded.allowed_channels_json,
          allowed_targets_json = excluded.allowed_targets_json,
          allowed_external_actors_json = excluded.allowed_external_actors_json,
          updated_at = excluded.updated_at`,
      )
      .bind(
        policy.threadId,
        policy.inboundRepliesAllowed ? 1 : 0,
        policy.externalActionsAllowed ? 1 : 0,
        policy.allowedChannels ? toJson(policy.allowedChannels) : null,
        policy.allowedTargets ? toJson(policy.allowedTargets) : null,
        policy.allowedExternalActors ? toJson(policy.allowedExternalActors) : null,
        policy.createdAt,
        policy.updatedAt,
      )
      .run();
  }

  async createExternalMessageProjection(projection: ExternalMessageProjection): Promise<void> {
    const existing = await this.getExternalMessageProjection({
      messageId: projection.messageId,
      channel: projection.channel,
      target: projection.target,
    });

    if (existing) {
      return;
    }

    try {
      await this.db
        .prepare(
          `INSERT INTO external_message_projections (
            projection_id,
            message_id,
            thread_id,
            channel,
            target,
            external_thread_id,
            external_message_id,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          projection.id,
          projection.messageId,
          projection.threadId,
          projection.channel,
          projection.target,
          projection.externalThreadId,
          projection.externalMessageId,
          projection.createdAt,
        )
        .run();
    } catch {
      const current = await this.getExternalMessageProjection({
        messageId: projection.messageId,
        channel: projection.channel,
        target: projection.target,
      });

      if (!current) {
        throw new Error(`Failed to create external message projection for ${projection.messageId}`);
      }
    }
  }

  async getExternalMessageProjection(args: {
    messageId: string;
    channel: MirrorChannel;
    target: string;
  }): Promise<ExternalMessageProjection | null> {
    const row = await this.db
      .prepare(
        `SELECT *
         FROM external_message_projections
         WHERE message_id = ?
           AND channel = ?
           AND target = ?
         LIMIT 1`,
      )
      .bind(args.messageId, args.channel, args.target)
      .first<ExternalMessageProjectionRow>();

    return row ? rowToExternalMessageProjection(row) : null;
  }

  async listExternalMessageProjections(messageId: string): Promise<ExternalMessageProjection[]> {
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM external_message_projections
         WHERE message_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(messageId)
      .all<ExternalMessageProjectionRow>();

    return (rows.results ?? []).map(rowToExternalMessageProjection);
  }

  async createExternalActionRecord(input: {
    externalActionId: string;
    source: "slack" | "email";
    threadId: string;
    actionType: string;
  }): Promise<{ alreadyExists: boolean }> {
    const result = await this.db
      .prepare(
        `INSERT INTO external_action_records (
          id,
          external_action_id,
          external_channel,
          thread_id,
          action_type
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(external_action_id, external_channel) DO NOTHING`,
      )
      .bind(
        newId(`ear_${input.source}`),
        input.externalActionId,
        input.source,
        input.threadId,
        input.actionType,
      )
      .run();

    return {
      alreadyExists: Number(result.meta.changes ?? 0) === 0,
    };
  }

  async createExternalInteractionAudit(
    record: ExternalInteractionAuditRecord,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO external_interaction_audit (
          audit_id,
          thread_id,
          channel,
          interaction_kind,
          external_actor_id,
          external_message_id,
          external_action_id,
          decision,
          reason_code,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.id,
        record.threadId ?? null,
        record.channel,
        record.interactionKind,
        record.externalActorId ?? null,
        record.externalMessageId ?? null,
        record.externalActionId ?? null,
        record.decision,
        record.reasonCode,
        record.createdAt,
      )
      .run();
  }

  async listExternalInteractionAudit(
    threadId: string,
  ): Promise<ExternalInteractionAuditRecord[]> {
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM external_interaction_audit
         WHERE thread_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(threadId)
      .all<ExternalInteractionAuditRow>();

    return (rows.results ?? []).map(rowToExternalInteractionAuditRecord);
  }

  private async getMessageByExternalId(args: {
    threadId: string;
    externalMessageId: string;
  }): Promise<EmployeeMessage | null> {
    const row = await this.db
      .prepare(
        `SELECT *
         FROM employee_messages
         WHERE thread_id = ?
           AND external_message_id = ?
         LIMIT 1`,
      )
      .bind(args.threadId, args.externalMessageId)
      .first<EmployeeMessageRow>();

    return row ? rowToMessage(row) : null;
  }

  async findMessageThreadByApprovalId(approvalId: string): Promise<MessageThread | null> {
    const row = await this.db
      .prepare(
        `SELECT *
         FROM message_threads
         WHERE related_approval_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(approvalId)
      .first<MessageThreadRow>();

    return row ? rowToMessageThread(row) : null;
  }

  async findMessageThreadByEscalationId(escalationId: string): Promise<MessageThread | null> {
    const row = await this.db
      .prepare(
        `SELECT *
         FROM message_threads
         WHERE related_escalation_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(escalationId)
      .first<MessageThreadRow>();

    return row ? rowToMessageThread(row) : null;
  }

  async createMessage(
    message: Omit<EmployeeMessage, "createdAt" | "updatedAt">,
  ): Promise<EmployeeMessage> {
    if (message.externalMessageId) {
      const existing = await this.getMessageByExternalId({
        threadId: message.threadId,
        externalMessageId: message.externalMessageId,
      });

      if (existing) {
        return existing;
      }
    }

    try {
      await this.db
        .prepare(
          `INSERT INTO employee_messages (
          message_id,
          thread_id,
          company_id,
          sender_employee_id,
          receiver_employee_id,
          receiver_team_id,
          message_type,
          status,
          source,
          subject,
          body,
          payload_json,
          external_message_id,
          external_channel,
          external_author_id,
          external_received_at,
          requires_response,
          response_action_type,
          response_action_status,
          caused_state_transition,
          related_task_id,
          related_artifact_id,
          related_escalation_id,
          related_approval_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          message.id,
          message.threadId,
          message.companyId,
          message.senderEmployeeId,
          message.receiverEmployeeId ?? null,
          message.receiverTeamId ?? null,
          message.type,
          message.status,
          message.source,
          message.subject ?? null,
          message.body,
          toJson(message.payload),
          message.externalMessageId ?? null,
          message.externalChannel ?? null,
          message.externalAuthorId ?? null,
          message.externalReceivedAt ?? null,
          message.requiresResponse ? 1 : 0,
          message.responseActionType ?? null,
          message.responseActionStatus ?? null,
          message.causedStateTransition ? 1 : 0,
          message.relatedTaskId ?? null,
          message.relatedArtifactId ?? null,
          message.relatedEscalationId ?? null,
          message.relatedApprovalId ?? null,
        )
        .run();
    } catch (error) {
      if (message.externalMessageId) {
        const existing = await this.getMessageByExternalId({
          threadId: message.threadId,
          externalMessageId: message.externalMessageId,
        });

        if (existing) {
          return existing;
        }
      }

      throw error;
    }

    const created = await this.getMessage(message.id);
    if (!created) {
      throw new Error(`Failed to load created message ${message.id}`);
    }

    if (created.source === "internal") {
      let relatedTask: Task | null = null;
      if (created.relatedTaskId) {
        relatedTask = await this.getTask(created.relatedTaskId);
      }

      try {
        await dispatchMessageMirrors({
          env: this.env,
          store: this,
          input: {
            messageId: created.id,
            threadId: created.threadId,
            body: created.body,
            subject: created.subject,
            senderEmployeeId: created.senderEmployeeId,
            createdAt: created.createdAt ?? new Date().toISOString(),
            routing: {
              threadId: created.threadId,
              threadType: created.relatedApprovalId
                ? "approval"
                : created.relatedEscalationId
                  ? "escalation"
                  : undefined,
              taskId: created.relatedTaskId,
              taskType: relatedTask?.taskType,
              teamId: relatedTask?.assignedTeamId,
              subject: created.subject,
              messageType: created.type,
              senderEmployeeId: created.senderEmployeeId,
              humanVisibilityRequired: true,
            },
          },
        });
      } catch (error) {
        console.error("message mirror dispatch failed", error);
        await this.createMessageMirrorDelivery({
          id: newId(`mdl_${created.id}_dispatch_error`),
          messageId: created.id,
          threadId: created.threadId,
          channel: "slack",
          target: "dispatch_exception",
          status: "failed",
          failureCode: "mirror_dispatch_failed",
          failureReason: error instanceof Error ? error.message : String(error),
          createdAt: new Date().toISOString(),
        });
      }
    }

    return created;
  }

  async listMessages(query: MessageListQuery): Promise<EmployeeMessage[]> {
    const clauses: string[] = [];
    const binds: Array<string | number> = [];

    if (query.threadId) {
      clauses.push(`thread_id = ?`);
      binds.push(query.threadId);
    }
    if (query.senderEmployeeId) {
      clauses.push(`sender_employee_id = ?`);
      binds.push(query.senderEmployeeId);
    }
    if (query.receiverEmployeeId) {
      clauses.push(`receiver_employee_id = ?`);
      binds.push(query.receiverEmployeeId);
    }
    if (query.receiverTeamId) {
      clauses.push(`receiver_team_id = ?`);
      binds.push(query.receiverTeamId);
    }
    if (query.relatedTaskId) {
      clauses.push(`related_task_id = ?`);
      binds.push(query.relatedTaskId);
    }
    if (query.relatedArtifactId) {
      clauses.push(`related_artifact_id = ?`);
      binds.push(query.relatedArtifactId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await this.db
      .prepare(
        `SELECT *
         FROM employee_messages
         ${where}
         ORDER BY created_at ASC
         LIMIT ?`,
      )
      .bind(...binds, query.limit)
      .all<EmployeeMessageRow>();

    return (rows.results ?? []).map(rowToMessage);
  }
}