/* eslint-disable no-console */

import { execFileSync } from "node:child_process";

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "task-reassignment-continuity-check";
const TEAM_ID = "team_validation";
const ROLE_ID = "validation-engineer";
const COMPANY_ID = "company_internal_aep";
const CREATED_BY_EMPLOYEE_ID = "emp_infra_ops_manager_01";

type SqlRow = Record<string, unknown>;

type ExecuteJson = {
  result?: Array<{
    results?: SqlRow[];
    success?: boolean;
  }>;
  success?: boolean;
  errors?: Array<{ message?: string }>;
};

type ExecuteJsonResult = {
  results?: SqlRow[];
  success?: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function execSql(sql: string): SqlRow[] {
  const wranglerConfigPath = requireEnv("WRANGLER_CONFIG_PATH");
  const databaseRef = process.env.D1_DATABASE_REF ?? "OPERATOR_AGENT_DB";
  const executionLocation = process.env.WRANGLER_D1_EXECUTION_LOCATION;

  if (executionLocation === "remote") {
    requireEnv("CLOUDFLARE_API_TOKEN");
    requireEnv("CLOUDFLARE_ACCOUNT_ID");
  }

  const args = [
    "wrangler",
    "d1",
    "execute",
    databaseRef,
    "--config",
    wranglerConfigPath,
  ];

  if (executionLocation === "local") {
    args.push("--local");
  } else if (executionLocation === "remote") {
    args.push("--remote");
  }

  const cfEnv = process.env.CF_ENV;
  if (cfEnv) {
    args.push("--env", cfEnv);
  }

  args.push("--command", sql, "--json");

  const output = execFileSync("npx", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const parsed = JSON.parse(output) as ExecuteJson | ExecuteJsonResult[];
  if (!Array.isArray(parsed) && (parsed.success === false || parsed.errors?.length)) {
    throw new Error(`wrangler d1 execute failed for SQL: ${sql}`);
  }

  const result = Array.isArray(parsed) ? parsed[0] : parsed.result?.[0];
  if (!result || result.success === false) {
    throw new Error(`No SQL result returned for query: ${sql}`);
  }

  return result.results ?? [];
}

function getSingleRow(sql: string): SqlRow {
  const rows = execSql(sql);
  if (rows.length < 1) {
    throw new Error(`Expected at least one row for query: ${sql}`);
  }

  return rows[0];
}

function assertTaskAssignment(taskId: string, expectedEmployeeId: string): void {
  const row = getSingleRow(
    `SELECT assigned_employee_id
     FROM tasks
     WHERE id = ${sqlLiteral(taskId)}
     LIMIT 1`,
  );

  if (String(row.assigned_employee_id ?? "") !== expectedEmployeeId) {
    throw new Error(
      `Expected task ${taskId} assigned_employee_id=${expectedEmployeeId}, got ${String(row.assigned_employee_id ?? "<missing>")}`,
    );
  }
}

function assertReassignmentRecord(args: {
  taskId: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  reason: string;
  expectedEventType: string;
}): void {
  const eventRow = getSingleRow(
    `SELECT event_id
     FROM employee_employment_events
     WHERE employee_id = ${sqlLiteral(args.fromEmployeeId)}
       AND event_type = ${sqlLiteral(args.expectedEventType)}
     ORDER BY created_at DESC
     LIMIT 1`,
  );

  const eventId = String(eventRow.event_id ?? "");
  if (!eventId) {
    throw new Error(
      `Expected lifecycle event ${args.expectedEventType} for ${args.fromEmployeeId}`,
    );
  }

  const reassignmentRow = getSingleRow(
    `SELECT from_employee_id, to_employee_id, reason, triggered_by_event_id
     FROM task_reassignments
     WHERE task_id = ${sqlLiteral(args.taskId)}
     ORDER BY created_at DESC
     LIMIT 1`,
  );

  if (String(reassignmentRow.from_employee_id ?? "") !== args.fromEmployeeId) {
    throw new Error(
      `Expected reassignment.from_employee_id=${args.fromEmployeeId}, got ${String(reassignmentRow.from_employee_id ?? "<missing>")}`,
    );
  }

  if (String(reassignmentRow.to_employee_id ?? "") !== args.toEmployeeId) {
    throw new Error(
      `Expected reassignment.to_employee_id=${args.toEmployeeId}, got ${String(reassignmentRow.to_employee_id ?? "<missing>")}`,
    );
  }

  if (String(reassignmentRow.reason ?? "") !== args.reason) {
    throw new Error(
      `Expected reassignment.reason=${args.reason}, got ${String(reassignmentRow.reason ?? "<missing>")}`,
    );
  }

  if (String(reassignmentRow.triggered_by_event_id ?? "") !== eventId) {
    throw new Error(
      `Expected reassignment.triggered_by_event_id=${eventId}, got ${String(reassignmentRow.triggered_by_event_id ?? "<missing>")}`,
    );
  }
}

function cleanup(ids: {
  employeeIds: string[];
  taskIds: string[];
}): void {
  if (ids.taskIds.length > 0) {
    execSql(
      `DELETE FROM task_reassignments WHERE task_id IN (${ids.taskIds.map(sqlLiteral).join(", ")})`,
    );
    execSql(
      `DELETE FROM task_dependencies WHERE task_id IN (${ids.taskIds.map(sqlLiteral).join(", ")}) OR depends_on_task_id IN (${ids.taskIds.map(sqlLiteral).join(", ")})`,
    );
    execSql(
      `DELETE FROM task_artifacts WHERE task_id IN (${ids.taskIds.map(sqlLiteral).join(", ")})`,
    );
    execSql(
      `DELETE FROM tasks WHERE id IN (${ids.taskIds.map(sqlLiteral).join(", ")})`,
    );
  }

  if (ids.employeeIds.length > 0) {
    execSql(
      `DELETE FROM employee_employment_events WHERE employee_id IN (${ids.employeeIds.map(sqlLiteral).join(", ")})`,
    );
    execSql(
      `DELETE FROM employee_public_links WHERE employee_id IN (${ids.employeeIds.map(sqlLiteral).join(", ")})`,
    );
    execSql(
      `DELETE FROM employee_visual_identity WHERE employee_id IN (${ids.employeeIds.map(sqlLiteral).join(", ")})`,
    );
    execSql(
      `DELETE FROM employee_personas WHERE employee_id IN (${ids.employeeIds.map(sqlLiteral).join(", ")})`,
    );
    execSql(
      `DELETE FROM employee_prompt_profiles WHERE employee_id IN (${ids.employeeIds.map(sqlLiteral).join(", ")})`,
    );
    execSql(
      `DELETE FROM employees_catalog WHERE id IN (${ids.employeeIds.map(sqlLiteral).join(", ")})`,
    );
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/tasks");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const suffix = `${Date.now()}`;
  const replacementEmployeeId = `emp_reassign_target_${suffix}`;
  const leaveEmployeeId = `emp_reassign_leave_${suffix}`;
  const terminateEmployeeId = `emp_reassign_term_${suffix}`;
  const employeeIds = [replacementEmployeeId, leaveEmployeeId, terminateEmployeeId];
  const taskIds: string[] = [];

  try {
    for (const employeeId of employeeIds) {
      const created = await client.createEmployee({
        employeeId,
        companyId: COMPANY_ID,
        teamId: TEAM_ID,
        roleId: ROLE_ID,
        employeeName: `${CHECK_NAME}-${employeeId}`,
        employmentStatus: "active",
        runtimeStatus: "planned",
        schedulerMode: "manual_only",
        reason: `${CHECK_NAME} seed employee`,
        approvedBy: "ci-task-reassignment-check",
      });

      if (!created?.ok || created.employeeId !== employeeId) {
        throw new Error(`Failed to create employee ${employeeId}: ${JSON.stringify(created)}`);
      }
    }

    const leaveTask = await client.createTask({
      companyId: COMPANY_ID,
      originatingTeamId: TEAM_ID,
      assignedTeamId: TEAM_ID,
      assignedEmployeeId: leaveEmployeeId,
      createdByEmployeeId: CREATED_BY_EMPLOYEE_ID,
      taskType: "validate-deployment",
      title: `${CHECK_NAME} leave continuity`,
      payload: { source: CHECK_NAME, case: "leave" },
    });

    if (!leaveTask?.ok || typeof leaveTask.taskId !== "string") {
      throw new Error(`Failed to create leave task: ${JSON.stringify(leaveTask)}`);
    }
    taskIds.push(leaveTask.taskId);

    const leaveResult = await client.runEmployeeLifecycleAction(
      leaveEmployeeId,
      "start-leave",
      {
        reason: `${CHECK_NAME} leave continuity`,
        threadId: `thread_${suffix}_leave`,
      },
    );

    if (!leaveResult?.ok || leaveResult.employmentStatus !== "on_leave") {
      throw new Error(`Expected start-leave to succeed: ${JSON.stringify(leaveResult)}`);
    }

    assertTaskAssignment(leaveTask.taskId, replacementEmployeeId);
    assertReassignmentRecord({
      taskId: leaveTask.taskId,
      fromEmployeeId: leaveEmployeeId,
      toEmployeeId: replacementEmployeeId,
      reason: "employee_unavailable",
      expectedEventType: "went_on_leave",
    });

    const terminateTask = await client.createTask({
      companyId: COMPANY_ID,
      originatingTeamId: TEAM_ID,
      assignedTeamId: TEAM_ID,
      assignedEmployeeId: terminateEmployeeId,
      createdByEmployeeId: CREATED_BY_EMPLOYEE_ID,
      taskType: "validate-deployment",
      title: `${CHECK_NAME} terminate continuity`,
      payload: { source: CHECK_NAME, case: "terminate" },
    });

    if (!terminateTask?.ok || typeof terminateTask.taskId !== "string") {
      throw new Error(`Failed to create terminate task: ${JSON.stringify(terminateTask)}`);
    }
    taskIds.push(terminateTask.taskId);

    const terminateResult = await client.runEmployeeLifecycleAction(
      terminateEmployeeId,
      "terminate",
      {
        reason: `${CHECK_NAME} termination continuity`,
        approvedBy: "ci-task-reassignment-check",
        threadId: `thread_${suffix}_terminate`,
      },
    );

    if (!terminateResult?.ok || terminateResult.employmentStatus !== "terminated") {
      throw new Error(`Expected terminate to succeed: ${JSON.stringify(terminateResult)}`);
    }

    assertTaskAssignment(terminateTask.taskId, replacementEmployeeId);
    assertReassignmentRecord({
      taskId: terminateTask.taskId,
      fromEmployeeId: terminateEmployeeId,
      toEmployeeId: replacementEmployeeId,
      reason: "employee_terminated",
      expectedEventType: "terminated",
    });

    console.log(`- PASS: ${CHECK_NAME} verified leave and terminate reassignment continuity.`);
    console.log(CHECK_NAME, {
      replacementEmployeeId,
      leaveEmployeeId,
      terminateEmployeeId,
      leaveTaskId: leaveTask.taskId,
      terminateTaskId: terminateTask.taskId,
    });
  } finally {
    try {
      cleanup({ employeeIds, taskIds });
    } catch (error) {
      console.warn(`- WARN: ${CHECK_NAME} cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});