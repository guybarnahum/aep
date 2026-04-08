import { fromJson, toJson } from "@aep/operator-agent/lib/d1-json";
import type { Decision, Task, TaskStatus, TaskStore } from "@aep/operator-agent/lib/store-types";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type TaskRow = {
  id: string;
  company_id: string;
  team_id: string;
  employee_id: string | null;
  task_type: string;
  status: string;
  payload: string | null;
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
    teamId: row.team_id,
    employeeId: row.employee_id ?? undefined,
    taskType: row.task_type,
    status: row.status as TaskStatus,
    payload: fromJson<Record<string, unknown>>(row.payload) ?? {},
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export class D1TaskStore implements TaskStore {
  private readonly db: D1Database;

  constructor(private readonly env: OperatorAgentEnv) {
    this.db = requireDb(env);
  }

  async createTask(task: Omit<Task, "status" | "createdAt" | "updatedAt">): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO tasks (
          id,
          company_id,
          team_id,
          employee_id,
          task_type,
          payload
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        task.id,
        task.companyId,
        task.teamId,
        task.employeeId ?? null,
        task.taskType,
        toJson(task.payload),
      )
      .run();
  }

  async getTask(taskId: string): Promise<Task | null> {
    const row = await this.db
      .prepare(`SELECT * FROM tasks WHERE id = ? LIMIT 1`)
      .bind(taskId)
      .first<TaskRow>();

    return row ? rowToTask(row) : null;
  }

  async getPendingTasksForEmployee(employeeId: string, teamId: string): Promise<Task[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE (employee_id = ? OR (employee_id IS NULL AND team_id = ?))
           AND status = 'pending'
         ORDER BY created_at ASC`,
      )
      .bind(employeeId, teamId)
      .all<TaskRow>();

    return (rows.results ?? []).map(rowToTask);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    await this.db
      .prepare(
        `UPDATE tasks
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(status, taskId)
      .run();
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
           SET status = 'completed', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(decision.taskId),
    ]);
  }
}