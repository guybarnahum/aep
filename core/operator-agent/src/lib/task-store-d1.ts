import { fromJson, toJson } from "@aep/operator-agent/lib/d1-json";
import {
  TaskDependencyValidationError,
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
  requires_response: number | null;
  related_task_id: string | null;
  related_artifact_id: string | null;
  related_escalation_id: string | null;
  related_approval_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    companyId: row.company_id,
    originatingTeamId: row.originating_team_id ?? row.team_id ?? "",
    assignedTeamId: row.assigned_team_id ?? row.team_id ?? "",
    ownerEmployeeId: row.owner_employee_id ?? undefined,
    assignedEmployeeId: row.assigned_employee_id ?? row.employee_id ?? undefined,
    createdByEmployeeId: row.created_by_employee_id ?? undefined,
    taskType: row.task_type,
    title: row.title ?? row.task_type,
    status: row.status as TaskStatus,
    payload: fromJson<Record<string, unknown>>(row.payload) ?? {},
    blockingDependencyCount: row.blocking_dependency_count ?? 0,
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
    requiresResponse: Number(row.requires_response ?? 0) === 1,
    relatedTaskId: row.related_task_id ?? undefined,
    relatedArtifactId: row.related_artifact_id ?? undefined,
    relatedEscalationId: row.related_escalation_id ?? undefined,
    relatedApprovalId: row.related_approval_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
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

  async createTask(
    task: Omit<
      Task,
      | "status"
      | "blockingDependencyCount"
      | "createdAt"
      | "updatedAt"
      | "startedAt"
      | "completedAt"
      | "failedAt"
    >,
  ): Promise<void> {
    await this.createTaskWithDependencies({ task, dependsOnTaskIds: [] });
  }

  async createTaskWithDependencies(args: {
    task: Omit<
      Task,
      | "status"
      | "blockingDependencyCount"
      | "createdAt"
      | "updatedAt"
      | "startedAt"
      | "completedAt"
      | "failedAt"
    >;
    dependsOnTaskIds?: string[];
  }): Promise<void> {
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
            blocking_dependency_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          args.task.taskType,
          args.task.title,
          initialStatus,
          toJson(args.task.payload),
          dependsOnTaskIds.length,
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
  ): Promise<void> {
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
          requires_response,
          related_task_id,
          related_artifact_id,
          related_escalation_id,
          related_approval_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        message.requiresResponse ? 1 : 0,
        message.relatedTaskId ?? null,
        message.relatedArtifactId ?? null,
        message.relatedEscalationId ?? null,
        message.relatedApprovalId ?? null,
      )
      .run();
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