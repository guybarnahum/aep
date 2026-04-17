import type {
  OperatorAgentEnv,
  TaskReassignmentReason,
} from "@aep/operator-agent/types";

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

export async function listActiveTasksForEmployee(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<string[]> {
  const db = requireDb(env);

  const rows = await db
    .prepare(
      `SELECT id
       FROM tasks
       WHERE assigned_employee_id = ?
         AND status NOT IN ('completed', 'failed')`,
    )
    .bind(employeeId)
    .all<{ id: string }>();

  return (rows.results ?? []).map((row) => row.id);
}

export async function reassignTask(
  env: OperatorAgentEnv,
  args: {
    taskId: string;
    fromEmployeeId: string;
    toEmployeeId: string;
    reason: TaskReassignmentReason;
    triggeredByEventId?: string;
    threadId?: string;
  },
): Promise<void> {
  const db = requireDb(env);

  await db
    .prepare(
      `UPDATE tasks
       SET assigned_employee_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(args.toEmployeeId, args.taskId)
    .run();

  await db
    .prepare(
      `INSERT INTO task_reassignments (
         reassignment_id,
         task_id,
         from_employee_id,
         to_employee_id,
         reason,
         triggered_by_event_id,
         thread_id,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    .bind(
      `reassign_${crypto.randomUUID().split("-")[0]}`,
      args.taskId,
      args.fromEmployeeId,
      args.toEmployeeId,
      args.reason,
      args.triggeredByEventId ?? null,
      args.threadId ?? null,
    )
    .run();
}