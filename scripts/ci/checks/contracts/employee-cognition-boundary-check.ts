/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const FORBIDDEN_PUBLIC_FIELDS = [
  "basePrompt",
  "decisionStyle",
  "collaborationStyle",
  "identitySeed",
  "portraitPrompt",
  "promptVersion",
  "base_prompt",
  "decision_style",
  "collaboration_style",
  "identity_seed",
  "portrait_prompt",
  "prompt_version",
];

const FORBIDDEN_PRIVATE_DECISION_FIELDS = [
  "internalMonologue",
  "internal_monologue",
];

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private cognition field ${field}`);
    }
  }
}

function assertEmployeeProjectionPrivacy(employee: Record<string, unknown>, index: number): void {
  const surface = `/agent/employees employee[${index}]`;
  assertFieldsAbsent(employee, FORBIDDEN_PUBLIC_FIELDS, surface);

  if (employee.publicProfile && typeof employee.publicProfile === "object") {
    assertFieldsAbsent(employee.publicProfile, FORBIDDEN_PUBLIC_FIELDS, `${surface}.publicProfile`);
  }
}

async function findCompletedOrFailedTask(client: ReturnType<typeof createOperatorAgentClient>): Promise<any | null> {
  for (const status of ["completed", "failed"] as const) {
    const response = await client.listTasks({ status, limit: 20 });
    if (!response?.ok) {
      throw new Error(`Failed to list ${status} tasks: ${JSON.stringify(response)}`);
    }

    if (Array.isArray(response.tasks) && response.tasks.length > 0) {
      return response.tasks[0];
    }
  }

  return null;
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  let employeesResponse;
  try {
    employeesResponse = await client.listEmployees();
  } catch (err) {
    if (handleOperatorAgentSoftSkip("employee-cognition-boundary-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  if (!employeesResponse.ok) {
    throw new Error("/agent/employees did not return ok=true");
  }

  if (!Array.isArray(employeesResponse.employees)) {
    throw new Error("/agent/employees returned no employees array");
  }

  employeesResponse.employees.forEach((employee: Record<string, unknown>, index: number) => {
    assertEmployeeProjectionPrivacy(employee, index);
  });

  const task = await findCompletedOrFailedTask(client);
  if (!task?.id) {
    console.warn("[warn] employee-cognition-boundary-check skipped: no completed or failed tasks available");
    process.exit(0);
  }

  const taskDetail = await client.getTask(task.id);
  if (!taskDetail?.ok) {
    throw new Error(`Failed to fetch task detail for ${task.id}: ${JSON.stringify(taskDetail)}`);
  }

  if (taskDetail.decision) {
    assertFieldsAbsent(
      taskDetail.decision,
      FORBIDDEN_PRIVATE_DECISION_FIELDS,
      "/agent/tasks/:id decision",
    );
  }

  console.log("employee-cognition-boundary-check passed", {
    taskId: task.id,
    employeeCount: employeesResponse.count,
  });
}

main().catch((error) => {
  console.error("employee-cognition-boundary-check failed");
  console.error(error);
  process.exit(1);
});